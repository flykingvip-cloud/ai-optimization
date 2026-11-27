import { createHmac, timingSafeEqual, verify } from "node:crypto";
import type { AuthContext } from "./index.js";

export interface JwtVerifierConfig {
  readonly expectedIssuer: string;
  readonly expectedAudience: string;
  readonly publicKeysByKid?: Readonly<Record<string, string>>;
  readonly hmacSecret?: string;
}

export class AuthError extends Error {
  constructor(
    public readonly code:
      | "missing_token"
      | "malformed_token"
      | "invalid_signature"
      | "token_expired"
      | "token_not_active"
      | "invalid_issuer"
      | "invalid_audience"
      | "missing_tenant_claim"
      | "principal_impersonation_forbidden"
      | "insufficient_permissions",
    message: string,
  ) {
    super(message);
  }
}

function base64UrlDecode(segment: string): Buffer {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

export function verifyJwtAuth(
  authorizationHeader: string | undefined,
  config: JwtVerifierConfig,
  options: { nowSec?: number; requireRole?: AuthContext["roles"][number]; disallowServiceImpersonation?: boolean } = {},
): AuthContext & { readonly principalType: "user" | "service" } {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    throw new AuthError("missing_token", "Missing Bearer token");
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthError("malformed_token", "JWT must have 3 segments");
  }
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8")) as { alg?: string; kid?: string };
    claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new AuthError("malformed_token", "Invalid JWT JSON");
  }

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");
  const signature = base64UrlDecode(sigB64);

  if (header.alg === "HS256") {
    if (!config.hmacSecret) {
      throw new AuthError("invalid_signature", "HS256 secret not configured");
    }
    const expected = createHmac("sha256", config.hmacSecret).update(signingInput).digest();
    if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) {
      throw new AuthError("invalid_signature", "Invalid HS256 signature");
    }
  } else if (header.alg === "EdDSA" || header.alg === "RS256") {
    const pubKey = header.kid ? config.publicKeysByKid?.[header.kid] : undefined;
    if (!pubKey) {
      throw new AuthError("invalid_signature", "Unknown signing key id");
    }
    const alg = header.alg === "EdDSA" ? null : "RSA-SHA256";
    if (!verify(alg, signingInput, pubKey, signature)) {
      throw new AuthError("invalid_signature", "Invalid asymmetric signature");
    }
  } else {
    throw new AuthError("invalid_signature", `Unsupported alg: ${String(header.alg)}`);
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || nowSec >= claims.exp) {
    throw new AuthError("token_expired", "Token expired");
  }
  if (typeof claims.nbf === "number" && nowSec < claims.nbf) {
    throw new AuthError("token_not_active", "Token not yet active (nbf)");
  }
  if (claims.iss !== config.expectedIssuer) {
    throw new AuthError("invalid_issuer", "Issuer mismatch");
  }
  const aud = claims.aud;
  const audOk = Array.isArray(aud) ? aud.includes(config.expectedAudience) : aud === config.expectedAudience;
  if (!audOk) {
    throw new AuthError("invalid_audience", "Audience mismatch");
  }
  if (typeof claims.sub !== "string" || !claims.sub.trim() || typeof claims.tenantId !== "string" || !claims.tenantId.trim()) {
    throw new AuthError("missing_tenant_claim", "Missing sub or tenantId claim");
  }

  const principalType = claims.principalType === "service" ? "service" : "user";
  if (options.disallowServiceImpersonation && principalType === "service" && claims.actAsUser) {
    throw new AuthError("principal_impersonation_forbidden", "Service principal cannot impersonate user");
  }

  const roles = Array.isArray(claims.roles)
    ? (claims.roles.filter((r): r is AuthContext["roles"][number] =>
        typeof r === "string" && ["owner", "operator", "approver", "service"].includes(r),
      ))
    : [];

  if (options.requireRole && !roles.includes(options.requireRole)) {
    throw new AuthError("insufficient_permissions", `Missing required role: ${options.requireRole}`);
  }

  return {
    subjectId: claims.sub,
    tenantId: claims.tenantId,
    roles,
    principalType,
  };
}
