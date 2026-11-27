import { createPublicKey, type webcrypto } from "node:crypto";
import { AuthError, verifyJwtAuth, type JwtVerifierConfig } from "./auth.js";
import type { AuthContext } from "./index.js";

export interface OidcJwksOptions {
  readonly issuerUrl: string;
  readonly expectedAudience: string;
  readonly cacheTtlMs?: number;
  readonly negativeCacheMs?: number;
  readonly requestTimeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly allowInsecureHttpForLocalhost?: boolean;
  readonly fetchFn?: typeof fetch;
}

interface JwkWithKid extends webcrypto.JsonWebKey {
  readonly kid?: string;
  readonly kty: string;
  readonly crv?: string;
  readonly use?: string;
  key_ops?: string[];
}

function isAllowedJwksUrl(rawUrl: string, allowLocalHttp: boolean): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") return true;
    if (
      allowLocalHttp &&
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isAllowedSigningJwk(jwk: JwkWithKid): boolean {
  if (!jwk.kid) return false;
  if (jwk.use && jwk.use !== "sig") return false;
  if (jwk.key_ops && !jwk.key_ops.includes("verify")) return false;
  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") return true;
  if (jwk.kty === "RSA") return true;
  return false;
}

/**
 * Hardened OIDC Discovery (/.well-known/openid-configuration) + JWKS fetcher
 * with strict issuer/HTTPS/JWK validation, timeouts, size caps, and negative caching.
 */
export class OidcJwksClient {
  private readonly issuerUrl: string;
  private readonly expectedAudience: string;
  private readonly cacheTtlMs: number;
  private readonly negativeCacheMs: number;
  private readonly requestTimeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly allowInsecureHttpForLocalhost: boolean;
  private readonly fetchFn: typeof fetch;

  private jwksUri: string | null = null;
  private cachedKeys: Record<string, string> = {};
  private cachedAtMs = 0;
  private lastFailureAtMs = 0;
  private inflightRefresh: Promise<void> | null = null;

  constructor(options: OidcJwksOptions) {
    this.issuerUrl = options.issuerUrl.replace(/\/+$/, "");
    this.expectedAudience = options.expectedAudience;
    this.cacheTtlMs = options.cacheTtlMs ?? 300_000;
    this.negativeCacheMs = options.negativeCacheMs ?? 5_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 3_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 256 * 1024;
    this.allowInsecureHttpForLocalhost = options.allowInsecureHttpForLocalhost ?? false;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async fetchJsonBounded(url: string): Promise<unknown> {
    const res = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    if (!res.ok) {
      throw new AuthError("invalid_signature", `OIDC endpoint failed: ${res.status}`);
    }
    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > this.maxResponseBytes) {
      throw new AuthError("invalid_signature", "OIDC/JWKS response exceeds maxResponseBytes");
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AuthError("invalid_signature", "Malformed OIDC/JWKS JSON");
    }
  }

  private async refreshKeys(): Promise<void> {
    if (this.lastFailureAtMs > 0 && Date.now() - this.lastFailureAtMs < this.negativeCacheMs) {
      throw new AuthError("invalid_signature", "OIDC/JWKS refresh in negative-cache cooldown");
    }
    if (this.inflightRefresh) {
      return this.inflightRefresh;
    }
    this.inflightRefresh = (async () => {
      try {
        if (!this.jwksUri) {
          if (!isAllowedJwksUrl(this.issuerUrl, this.allowInsecureHttpForLocalhost)) {
            throw new AuthError("invalid_issuer", "OIDC issuer URL must use HTTPS");
          }
          const disc = (await this.fetchJsonBounded(
            `${this.issuerUrl}/.well-known/openid-configuration`,
          )) as { issuer?: string; jwks_uri?: string };
          if (!disc.issuer || disc.issuer.replace(/\/+$/, "") !== this.issuerUrl) {
            throw new AuthError("invalid_issuer", "OIDC discovery missing or mismatched issuer");
          }
          if (!disc.jwks_uri || !isAllowedJwksUrl(disc.jwks_uri, this.allowInsecureHttpForLocalhost)) {
            throw new AuthError("invalid_issuer", "OIDC jwks_uri invalid or insecure");
          }
          this.jwksUri = disc.jwks_uri;
        }

        const jwks = (await this.fetchJsonBounded(this.jwksUri)) as { keys?: JwkWithKid[] };
        if (!Array.isArray(jwks.keys)) {
          throw new AuthError("invalid_signature", "JWKS keys must be an array");
        }
        const nextKeys: Record<string, string> = {};
        for (const jwk of jwks.keys) {
          if (!isAllowedSigningJwk(jwk) || !jwk.kid) continue;
          const keyObj = createPublicKey({ key: jwk, format: "jwk" });
          nextKeys[jwk.kid] = keyObj.export({ type: "spki", format: "pem" }).toString();
        }
        this.cachedKeys = nextKeys;
        this.cachedAtMs = Date.now();
        this.lastFailureAtMs = 0;
      } catch (err) {
        this.lastFailureAtMs = Date.now();
        throw err;
      } finally {
        this.inflightRefresh = null;
      }
    })();
    return this.inflightRefresh;
  }

  private extractKid(authorizationHeader: string | undefined): string | undefined {
    if (!authorizationHeader?.startsWith("Bearer ")) return undefined;
    const parts = authorizationHeader.slice("Bearer ".length).trim().split(".");
    if (parts.length !== 3) return undefined;
    try {
      const header = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8")) as { kid?: string };
      return header.kid;
    } catch {
      return undefined;
    }
  }

  async verifyAuthorization(
    authorizationHeader: string | undefined,
    options: { nowSec?: number; requireRole?: AuthContext["roles"][number]; disallowServiceImpersonation?: boolean } = {},
  ): Promise<AuthContext & { readonly principalType: "user" | "service" }> {
    const nowMs = Date.now();
    const kid = this.extractKid(authorizationHeader);
    const cacheExpired = nowMs - this.cachedAtMs >= this.cacheTtlMs;
    const missingKid = Boolean(kid && !this.cachedKeys[kid]);

    if (Object.keys(this.cachedKeys).length === 0 || cacheExpired || missingKid) {
      await this.refreshKeys();
    }

    const cfg: JwtVerifierConfig = {
      expectedIssuer: this.issuerUrl,
      expectedAudience: this.expectedAudience,
      publicKeysByKid: this.cachedKeys,
    };
    return verifyJwtAuth(authorizationHeader, cfg, options);
  }
}
