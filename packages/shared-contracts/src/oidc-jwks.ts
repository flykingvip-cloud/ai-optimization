import { createPublicKey, type webcrypto } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { AuthError, verifyJwtAuth, type JwtVerifierConfig } from "./auth.js";
import type { AuthContext } from "./index.js";

/**
 * Hardened OIDC Discovery + JWKS client trust policy
 * --------------------------------------------------
 * Production default is deny-by-default:
 * - Outbound Discovery/JWKS fetches are allowed only to hosts or CIDRs listed in
 *   `allowedJwksHosts`. An empty/omitted allowlist permits no remote IdP.
 * - HTTP is rejected unless `allowInsecureHttpForLocalhost` is explicitly true
 *   and the host is localhost / 127.0.0.1 / ::1. That flag is a test/dev
 *   escape hatch, never a production default.
 * - After DNS resolution, private, loopback, link-local, CGNAT, multicast,
 *   documentation, and well-known cloud-metadata addresses are rejected.
 *   Private CIDRs may be allowlisted for an enterprise IdP; metadata addresses
 *   cannot be overridden.
 * - Redirects are followed manually, hop-limited, never downgraded from HTTPS
 *   to HTTP, and each target is re-validated against the same policy.
 * - Response bodies are read as a stream and aborted as soon as
 *   `maxResponseBytes` would be exceeded.
 *
 * This client does not itself perform a production identity-provider handshake.
 * Operators must still complete a real IdP integration against a trusted issuer.
 */
export interface OidcJwksOptions {
  readonly issuerUrl: string;
  readonly expectedAudience: string;
  readonly cacheTtlMs?: number;
  readonly negativeCacheMs?: number;
  readonly requestTimeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly maxRedirects?: number;
  /**
   * Explicit allowlist of Discovery/JWKS hostnames (exact, case-insensitive)
   * and/or CIDRs. Production default is empty: no arbitrary public host is
   * reachable until the operator lists the trusted IdP.
   */
  readonly allowedJwksHosts?: readonly string[];
  /**
   * Opt-in only. When true, `localhost`, `127.0.0.1`, and `::1` may be fetched
   * over HTTP or HTTPS for local tests. Never enable this in production.
   */
  readonly allowInsecureHttpForLocalhost?: boolean;
  /**
   * Optional transport hook, intended for tests. Validation of the URL,
   * allowlist, and resolved addresses runs before this function is called,
   * but the validated addresses are not bound to the socket. A custom
   * `fetchFn` that ignores `redirect: "manual"`, performs its own DNS
   * lookup, or connects to a different address is not IP-pinned. The
   * default outbound path uses `pinnedFetch` and is not affected.
   */
  readonly fetchFn?: typeof fetch;
  /** Optional DNS resolver hook so tests can assert address-level SSRF controls without network I/O. */
  readonly dnsLookupFn?: (hostname: string) => Promise<readonly string[]>;
}

interface JwkWithKid extends webcrypto.JsonWebKey {
  readonly kid?: string;
  readonly kty: string;
  readonly crv?: string;
  readonly alg?: string;
  readonly use?: string;
  key_ops?: string[];
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** IPv4 ranges that are not globally reachable and must not be fetched unless explicitly allowlisted. */
const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
] as const;

const BLOCKED_IPV6_CIDRS = [
  "::/128",
  "::1/128",
  "64:ff9b:1::/48",
  "100::/64",
  "2001:db8::/32",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
] as const;

/** Cloud metadata endpoints that can never be allowlisted. */
const HARD_BLOCKED_IPV4_CIDRS = ["169.254.169.0/24", "169.254.170.2/32", "100.100.100.200/32"] as const;
const HARD_BLOCKED_IPV6_CIDRS = ["fd00:ec2::254/128"] as const;

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function normalizeHostname(host: string): string {
  return stripBrackets(host).toLowerCase();
}

function isLocalhostName(host: string): boolean {
  const normalized = normalizeHostname(host);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    n = (n << 8) + value;
  }
  return n >>> 0;
}

function ipv4InCidr(ip: number, cidr: string): boolean {
  const slash = cidr.indexOf("/");
  if (slash < 0) return false;
  const net = parseIpv4(cidr.slice(0, slash));
  const prefix = Number(cidr.slice(slash + 1));
  if (net === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffff_ffff << (32 - prefix)) >>> 0;
  return (ip & mask) === (net & mask);
}

function parseIpv6(ip: string): bigint | null {
  let raw = ip.toLowerCase();
  if (raw.startsWith("[") && raw.endsWith("]")) raw = raw.slice(1, -1);

  const dotted = raw.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const v4 = parseIpv4(dotted[1]!);
    if (v4 === null) return null;
    raw = `${raw.slice(0, raw.length - dotted[1]!.length)}${(v4 >>> 16) & 0xffff}:${v4 & 0xffff}`;
  }

  if (raw.includes(":::")) return null;
  const sides = raw.split("::");
  if (sides.length > 2) return null;

  const parseParts = (side: string): number[] | null => {
    if (side === "") return [];
    const parts = side.split(":");
    const out: number[] = [];
    for (const part of parts) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      out.push(parseInt(part, 16));
    }
    return out;
  };

  let parts: number[];
  if (sides.length === 1) {
    const parsed = parseParts(sides[0]!);
    if (!parsed || parsed.length !== 8) return null;
    parts = parsed;
  } else {
    const head = parseParts(sides[0]!);
    const tail = parseParts(sides[1]!);
    if (!head || !tail) return null;
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    parts = [...head, ...Array<number>(missing).fill(0), ...tail];
  }

  let value = 0n;
  for (const part of parts) {
    value = (value << 16n) + BigInt(part);
  }
  return value;
}

function ipv6InCidr(ip: bigint, cidr: string): boolean {
  const slash = cidr.indexOf("/");
  if (slash < 0) return false;
  const net = parseIpv6(cidr.slice(0, slash));
  const prefix = Number(cidr.slice(slash + 1));
  if (net === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false;
  const shift = 128n - BigInt(prefix);
  const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << shift;
  return (ip & mask) === (net & mask);
}

function ipv4MappedFromIpv6(addr: bigint): number | null {
  // ::ffff:0:0/96 and NAT64 64:ff9b::/96
  if (addr >> 32n === 0xffffn) return Number(addr & 0xffff_ffffn);
  const nat64Prefix = parseIpv6("64:ff9b::");
  if (nat64Prefix !== null && addr >> 32n === nat64Prefix >> 32n) {
    return Number(addr & 0xffff_ffffn);
  }
  return null;
}

function isHardBlockedIp(address: string): boolean {
  const v4 = parseIpv4(address);
  if (v4 !== null) {
    return HARD_BLOCKED_IPV4_CIDRS.some((cidr) => ipv4InCidr(v4, cidr));
  }
  const v6 = parseIpv6(address);
  if (v6 === null) return true;
  if (HARD_BLOCKED_IPV6_CIDRS.some((cidr) => ipv6InCidr(v6, cidr))) return true;
  const mapped = ipv4MappedFromIpv6(v6);
  return mapped !== null && HARD_BLOCKED_IPV4_CIDRS.some((cidr) => ipv4InCidr(mapped, cidr));
}

function isBlockedSpecialIp(address: string): boolean {
  const v4 = parseIpv4(address);
  if (v4 !== null) {
    return BLOCKED_IPV4_CIDRS.some((cidr) => ipv4InCidr(v4, cidr));
  }
  const v6 = parseIpv6(address);
  if (v6 === null) return true;
  if (BLOCKED_IPV6_CIDRS.some((cidr) => ipv6InCidr(v6, cidr))) return true;
  const mapped = ipv4MappedFromIpv6(v6);
  return mapped !== null && BLOCKED_IPV4_CIDRS.some((cidr) => ipv4InCidr(mapped, cidr));
}

function isCidrEntry(entry: string): boolean {
  const slash = entry.indexOf("/");
  if (slash < 0) return false;
  const prefix = Number(entry.slice(slash + 1));
  const network = entry.slice(0, slash);
  if (parseIpv4(network) !== null) return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
  if (parseIpv6(network) !== null) return Number.isInteger(prefix) && prefix >= 0 && prefix <= 128;
  return false;
}

function ipInAllowedCidrs(address: string, allowlist: readonly string[]): boolean {
  const cidrs = allowlist.filter(isCidrEntry);
  const v4 = parseIpv4(address);
  if (v4 !== null) return cidrs.some((cidr) => cidr.includes(".") && ipv4InCidr(v4, cidr));
  const v6 = parseIpv6(address);
  if (v6 === null) return false;
  const mapped = ipv4MappedFromIpv6(v6);
  if (mapped !== null && cidrs.some((cidr) => cidr.includes(".") && ipv4InCidr(mapped, cidr))) {
    return true;
  }
  return cidrs.some((cidr) => !cidr.includes(".") && ipv6InCidr(v6, cidr));
}

function isAllowedSigningJwk(jwk: JwkWithKid): boolean {
  if (!jwk.kid || typeof jwk.kid !== "string" || !jwk.kid.trim()) return false;
  if (jwk.use && jwk.use !== "sig") return false;
  if (jwk.key_ops !== undefined) {
    if (!Array.isArray(jwk.key_ops) || !jwk.key_ops.includes("verify")) return false;
  }
  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    if (jwk.alg && jwk.alg !== "EdDSA" && jwk.alg !== "Ed25519") return false;
    return true;
  }
  if (jwk.kty === "RSA") {
    if (jwk.alg && jwk.alg !== "RS256") return false;
    return true;
  }
  return false;
}

function isTimeoutOrAbort(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || err.name === "AbortError";
}

function defaultLookup(hostname: string): Promise<readonly string[]> {
  return dnsLookup(hostname, { all: true, verbatim: true }).then((records) =>
    records.map((record) => record.address),
  );
}

async function readResponseBodyBounded(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    return "";
  }
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("maxResponseBytes exceeded");
        throw new AuthError("invalid_signature", "OIDC/JWKS response exceeds maxResponseBytes");
      }
      chunks.push(Buffer.from(value));
    }
  } catch (err) {
    if (err instanceof AuthError) throw err;
    try {
      await reader.cancel();
    } catch {
      // The stream may already be cancelled or closed.
    }
    throw err;
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function pinnedFetch(
  urlStr: string,
  addresses: readonly string[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const url = new URL(urlStr);
  const address = addresses[0];
  if (!address) {
    throw new AuthError("invalid_issuer", "OIDC/JWKS hostname could not be resolved");
  }
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
  const hostnameForTls = normalizeHostname(url.hostname);
  const family = isIP(address);

  return new Promise<Response>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
      return;
    }

    const options: https.RequestOptions = {
      protocol: url.protocol,
      hostname: address,
      port,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        Host: url.host,
        Accept: "application/json",
        "Accept-Encoding": "identity",
      },
      timeout: timeoutMs,
    };
    if (family === 4 || family === 6) {
      options.family = family;
    }
    if (isHttps && isIP(hostnameForTls) === 0) {
      options.servername = hostnameForTls;
    }

    const req = lib.request(options, (incoming) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          incoming.on("data", (chunk: Buffer | string) => {
            try {
              controller.enqueue(Buffer.isBuffer(chunk) ? new Uint8Array(chunk) : new TextEncoder().encode(String(chunk)));
            } catch (err) {
              incoming.destroy();
              controller.error(err);
            }
          });
          incoming.on("end", () => {
            try {
              controller.close();
            } catch {
              // already closed
            }
          });
          incoming.on("error", (err) => controller.error(err));
        },
        cancel() {
          incoming.destroy();
        },
      });
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (typeof value === "string") headers.set(key, value);
        else if (Array.isArray(value)) headers.set(key, value.join(", "));
      }
      resolve(
        new Response(stream, {
          status: incoming.statusCode ?? 0,
          statusText: incoming.statusMessage ?? "",
          headers,
        }),
      );
    });

    const onAbort = (): void => {
      const reason = signal?.reason instanceof Error ? signal.reason : new Error("aborted");
      req.destroy(reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    req.on("timeout", () => {
      const timeoutErr = new Error("OIDC/JWKS request timed out");
      timeoutErr.name = "TimeoutError";
      req.destroy(timeoutErr);
    });
    req.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    req.end();
  });
}

/**
 * Hardened OIDC Discovery (/.well-known/openid-configuration) + JWKS fetcher
 * with strict issuer/HTTPS/JWK validation, timeouts, size caps, redirect
 * controls, address-level SSRF guards, and negative caching.
 */
export class OidcJwksClient {
  private readonly issuerUrl: string;
  private readonly expectedAudience: string;
  private readonly cacheTtlMs: number;
  private readonly negativeCacheMs: number;
  private readonly requestTimeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly maxRedirects: number;
  private readonly allowedJwksHosts: readonly string[];
  private readonly allowInsecureHttpForLocalhost: boolean;
  private readonly fetchFn: typeof fetch | undefined;
  private readonly dnsLookupFn: (hostname: string) => Promise<readonly string[]>;

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
    this.maxRedirects = options.maxRedirects ?? 3;
    this.allowedJwksHosts = options.allowedJwksHosts ?? [];
    this.allowInsecureHttpForLocalhost = options.allowInsecureHttpForLocalhost ?? false;
    this.fetchFn = options.fetchFn;
    this.dnsLookupFn = options.dnsLookupFn ?? ((hostname: string) => defaultLookup(hostname));
  }

  private implicitLocalhostAllowed(): boolean {
    return this.allowInsecureHttpForLocalhost;
  }

  private hostIsAllowlisted(hostname: string): boolean {
    const normalized = normalizeHostname(hostname);
    if (this.implicitLocalhostAllowed() && isLocalhostName(normalized)) return true;
    if (isIP(normalized) !== 0 && ipInAllowedCidrs(normalized, this.allowedJwksHosts)) return true;
    return this.allowedJwksHosts.some((entry) => !isCidrEntry(entry) && normalizeHostname(entry) === normalized);
  }

  private addressIsAllowed(address: string, hostname: string): boolean {
    if (isHardBlockedIp(address)) return false;
    if (this.implicitLocalhostAllowed() && isLocalhostName(hostname)) {
      const v4 = parseIpv4(address);
      if (v4 !== null) return ipv4InCidr(v4, "127.0.0.0/8");
      const v6 = parseIpv6(address);
      return v6 !== null && ipv6InCidr(v6, "::1/128");
    }
    if (ipInAllowedCidrs(address, this.allowedJwksHosts)) return !isHardBlockedIp(address);
    return !isBlockedSpecialIp(address);
  }

  private async resolveValidatedAddresses(url: URL, context: string): Promise<readonly string[]> {
    const hostname = normalizeHostname(url.hostname);
    if (isIP(hostname) !== 0) {
      if (!this.addressIsAllowed(hostname, hostname)) {
        throw new AuthError("invalid_issuer", `${context} resolved to a disallowed address`);
      }
      return [hostname];
    }

    let addresses: readonly string[];
    try {
      addresses = await this.dnsLookupFn(hostname);
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError("invalid_issuer", `${context} hostname could not be resolved`);
    }
    if (!addresses.length) {
      throw new AuthError("invalid_issuer", `${context} hostname could not be resolved`);
    }
    for (const address of addresses) {
      if (!this.addressIsAllowed(address, hostname)) {
        throw new AuthError("invalid_issuer", `${context} resolved to a disallowed address`);
      }
    }
    return addresses;
  }

  private async assertTrustedUrl(rawUrl: string, context: string): Promise<readonly string[]> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new AuthError("invalid_issuer", `${context} is not a valid URL`);
    }
    if (parsed.username || parsed.password) {
      throw new AuthError("invalid_issuer", `${context} must not include userinfo credentials`);
    }
    const hostname = normalizeHostname(parsed.hostname);
    const httpLocal =
      this.allowInsecureHttpForLocalhost && parsed.protocol === "http:" && isLocalhostName(hostname);
    if (parsed.protocol === "https:") {
      // allowed, subject to host + address checks
    } else if (httpLocal) {
      // explicit localhost HTTP exception
    } else if (parsed.protocol === "http:") {
      throw new AuthError("invalid_issuer", `${context} must use HTTPS`);
    } else {
      throw new AuthError("invalid_issuer", `${context} must use HTTPS`);
    }
    if (!this.hostIsAllowlisted(hostname)) {
      throw new AuthError(
        "invalid_issuer",
        `${context} host is not in the allowed JWKS host allowlist`,
      );
    }
    return this.resolveValidatedAddresses(parsed, context);
  }

  private async fetchOnce(url: string, addresses: readonly string[]): Promise<Response> {
    const signal = AbortSignal.timeout(this.requestTimeoutMs);
    try {
      if (this.fetchFn) {
        return await this.fetchFn(url, { signal, redirect: "manual", method: "GET" });
      }
      return await pinnedFetch(url, addresses, this.requestTimeoutMs, signal);
    } catch (err) {
      if (isTimeoutOrAbort(err)) {
        throw new AuthError("invalid_signature", "OIDC/JWKS request timed out");
      }
      throw err;
    }
  }

  private async fetchJsonBounded(url: string): Promise<unknown> {
    let current = url;
    let addresses = await this.assertTrustedUrl(current, "OIDC/JWKS URL");

    for (let hop = 0; hop <= this.maxRedirects; hop += 1) {
      const res = await this.fetchOnce(current, addresses);
      if (REDIRECT_STATUSES.has(res.status)) {
        const location = res.headers.get("location");
        if (res.body) {
          await res.body.cancel();
        }
        if (!location) {
          throw new AuthError("invalid_issuer", "OIDC/JWKS redirect is missing a Location header");
        }
        if (hop === this.maxRedirects) {
          throw new AuthError("invalid_issuer", "OIDC/JWKS redirect limit exceeded");
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new AuthError("invalid_issuer", "OIDC/JWKS redirect target is not a valid URL");
        }
        const currentUrl = new URL(current);
        if (currentUrl.protocol === "https:" && next.protocol !== "https:") {
          throw new AuthError("invalid_issuer", "OIDC/JWKS HTTPS to HTTP redirect is not allowed");
        }
        addresses = await this.assertTrustedUrl(next.toString(), "OIDC/JWKS redirect target");
        current = next.toString();
        continue;
      }

      if (!res.ok) {
        if (res.body) {
          await res.body.cancel();
        }
        throw new AuthError("invalid_signature", `OIDC endpoint failed: ${res.status}`);
      }

      const text = await readResponseBodyBounded(res, this.maxResponseBytes);
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new AuthError("invalid_signature", "Malformed OIDC/JWKS JSON");
      }
    }

    throw new AuthError("invalid_issuer", "OIDC/JWKS redirect limit exceeded");
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
          await this.assertTrustedUrl(this.issuerUrl, "OIDC issuer URL");
          const disc = (await this.fetchJsonBounded(
            `${this.issuerUrl}/.well-known/openid-configuration`,
          )) as { issuer?: string; jwks_uri?: string };
          if (!disc.issuer || disc.issuer.replace(/\/+$/, "") !== this.issuerUrl) {
            throw new AuthError("invalid_issuer", "OIDC discovery missing or mismatched issuer");
          }
          if (!disc.jwks_uri) {
            throw new AuthError("invalid_issuer", "OIDC jwks_uri invalid or insecure");
          }
          await this.assertTrustedUrl(disc.jwks_uri, "OIDC jwks_uri");
          this.jwksUri = disc.jwks_uri;
        }

        const jwks = (await this.fetchJsonBounded(this.jwksUri)) as { keys?: JwkWithKid[] };
        if (!Array.isArray(jwks.keys)) {
          throw new AuthError("invalid_signature", "JWKS keys must be an array");
        }
        const nextKeys: Record<string, string> = {};
        const conflictingKids = new Set<string>();
        for (const jwk of jwks.keys) {
          if (!isAllowedSigningJwk(jwk) || !jwk.kid) continue;
          try {
            const keyObj = createPublicKey({ key: jwk, format: "jwk" });
            const pem = keyObj.export({ type: "spki", format: "pem" }).toString();
            const existing = nextKeys[jwk.kid];
            if (existing !== undefined && existing !== pem) {
              // Fail closed: the same kid must not map to two materials.
              conflictingKids.add(jwk.kid);
              delete nextKeys[jwk.kid];
              continue;
            }
            if (!conflictingKids.has(jwk.kid)) {
              nextKeys[jwk.kid] = pem;
            }
          } catch {
            // Skip malformed or unsupported JWK material; do not fail the whole document.
          }
        }
        if (conflictingKids.size > 0) {
          throw new AuthError(
            "invalid_signature",
            "JWKS contained duplicate kid values with conflicting key material",
          );
        }
        if (Object.keys(nextKeys).length === 0) {
          throw new AuthError("invalid_signature", "JWKS contained no usable signing keys");
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
    options: {
      nowSec?: number;
      requireRole?: AuthContext["roles"][number];
      disallowServiceImpersonation?: boolean;
    } = {},
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
