import { createPublicKey, type webcrypto } from "node:crypto";
import { AuthError, verifyJwtAuth, type JwtVerifierConfig } from "./auth.js";
import type { AuthContext } from "./index.js";

export interface OidcJwksOptions {
  readonly issuerUrl: string;
  readonly expectedAudience: string;
  readonly cacheTtlMs?: number;
  readonly fetchFn?: typeof fetch;
}

interface JwkWithKid extends webcrypto.JsonWebKey {
  readonly kid?: string;
  readonly kty: string;
}

/**
 * Real OIDC Discovery (/.well-known/openid-configuration) + JWKS fetcher
 * with TTL caching and single-flight refresh on key rotation (unknown kid).
 */
export class OidcJwksClient {
  private readonly issuerUrl: string;
  private readonly expectedAudience: string;
  private readonly cacheTtlMs: number;
  private readonly fetchFn: typeof fetch;

  private jwksUri: string | null = null;
  private cachedKeys: Record<string, string> = {};
  private cachedAtMs = 0;
  private inflightRefresh: Promise<void> | null = null;

  constructor(options: OidcJwksOptions) {
    this.issuerUrl = options.issuerUrl.replace(/\/+$/, "");
    this.expectedAudience = options.expectedAudience;
    this.cacheTtlMs = options.cacheTtlMs ?? 300_000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async refreshKeys(): Promise<void> {
    if (this.inflightRefresh) {
      return this.inflightRefresh;
    }
    this.inflightRefresh = (async () => {
      try {
        if (!this.jwksUri) {
          const discRes = await this.fetchFn(`${this.issuerUrl}/.well-known/openid-configuration`);
          if (!discRes.ok) {
            throw new AuthError("invalid_signature", `OIDC discovery failed: ${discRes.status}`);
          }
          const disc = (await discRes.json()) as { issuer?: string; jwks_uri?: string };
          if (!disc.jwks_uri || (disc.issuer && disc.issuer.replace(/\/+$/, "") !== this.issuerUrl)) {
            throw new AuthError("invalid_issuer", "OIDC discovery issuer/jwks_uri mismatch");
          }
          this.jwksUri = disc.jwks_uri;
        }

        const jwksRes = await this.fetchFn(this.jwksUri);
        if (!jwksRes.ok) {
          throw new AuthError("invalid_signature", `JWKS fetch failed: ${jwksRes.status}`);
        }
        const jwks = (await jwksRes.json()) as { keys?: JwkWithKid[] };
        const nextKeys: Record<string, string> = {};
        for (const jwk of jwks.keys ?? []) {
          if (!jwk.kid) continue;
          const keyObj = createPublicKey({ key: jwk, format: "jwk" });
          nextKeys[jwk.kid] = keyObj.export({ type: "spki", format: "pem" }).toString();
        }
        this.cachedKeys = nextKeys;
        this.cachedAtMs = Date.now();
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
