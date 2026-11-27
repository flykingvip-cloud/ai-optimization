import { generateKeyPairSync, sign } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { AuthError } from "../../packages/shared-contracts/src/auth.js";
import { OptimizationDatabase } from "../../packages/shared-contracts/src/db.js";
import { OidcJwksClient } from "../../packages/shared-contracts/src/oidc-jwks.js";
import { DatasetManagementService } from "../../services/dataset-management/src/index.js";
import { createOptimizationHttpServer } from "../../services/http-api/src/server.js";
import { TelemetryIngestionService } from "../../services/telemetry-ingestion/src/index.js";

const PUBLIC_TEST_IP = "93.184.216.34";
const REMOTE_ISSUER = "https://idp.example.com";

function signEdDsa(kid: string, payload: Record<string, unknown>, privateKeyPem: string): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const header = b64({ alg: "EdDSA", typ: "JWT", kid });
  const body = b64(payload);
  const sig = sign(null, Buffer.from(`${header}.${body}`, "utf8"), privateKeyPem).toString("base64url");
  return `${header}.${body}.${sig}`;
}

function publicDnsLookup(): (hostname: string) => Promise<readonly string[]> {
  return async () => [PUBLIC_TEST_IP];
}

function serviceClaims(issuer: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: issuer,
    aud: "ai-optimization",
    sub: "svc_openbot_sandbox",
    tenantId: "tenant_sandbox",
    principalType: "service",
    roles: ["service"],
    exp: now + 300,
    ...extra,
  };
}

function telemetryEvent(id: string, tenantId = "tenant_sandbox"): string {
  return JSON.stringify({
    schemaVersion: "1.0.0",
    eventId: id,
    idempotencyKey: id,
    eventType: "runtime.run.completed",
    occurredAt: "2026-11-27T00:00:00Z",
    tenantId,
    source: { system: "openbot", component: "sandbox-runner" },
    traceContext: { traceId: "tr_oidc", runId: id },
    redaction: { applied: true, policy: "v1" },
    payload: { status: "ok" },
  });
}

async function expectAuthError(
  promise: Promise<unknown>,
  code: AuthError["code"],
  messagePattern: RegExp,
): Promise<AuthError> {
  try {
    await promise;
    throw new Error(`expected AuthError(${code}) but the promise resolved`);
  } catch (err) {
    expect(err).toBeInstanceOf(AuthError);
    const authErr = err as AuthError;
    expect(authErr.code).toBe(code);
    expect(authErr.message).toMatch(messagePattern);
    return authErr;
  }
}

describe("M4-02 Hardened OIDC Discovery, JWKS Caching & Key Rotation", () => {
  it("discovers JWKS over opt-in localhost HTTP, ignores use=enc keys, and rotates on a new kid", async () => {
    const k1 = generateKeyPairSync("ed25519");
    const k2 = generateKeyPairSync("ed25519");
    const encKey = generateKeyPairSync("ed25519");
    const jwk1 = { ...k1.publicKey.export({ format: "jwk" }), kid: "rot-1", use: "sig" };
    const jwk2 = { ...k2.publicKey.export({ format: "jwk" }), kid: "rot-2", use: "sig" };
    const jwkEnc = { ...encKey.publicKey.export({ format: "jwk" }), kid: "enc-only", use: "enc" };

    let activeKeys = [jwk1, jwkEnc];
    let discoveryHits = 0;
    let jwksHits = 0;

    const idpServer = http.createServer((req, res) => {
      const issuer = `http://127.0.0.1:${(idpServer.address() as AddressInfo).port}`;
      if (req.url === "/.well-known/openid-configuration") {
        discoveryHits += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ issuer, jwks_uri: `${issuer}/jwks.json` }));
        return;
      }
      if (req.url === "/jwks.json") {
        jwksHits += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ keys: activeKeys }));
        return;
      }
      res.writeHead(404).end();
    });

    await new Promise<void>((resolve) => idpServer.listen(0, "127.0.0.1", resolve));
    const issuerUrl = `http://127.0.0.1:${(idpServer.address() as AddressInfo).port}`;

    const db = new OptimizationDatabase(":memory:");
    db.migrate();
    const oidcClient = new OidcJwksClient({
      issuerUrl,
      expectedAudience: "ai-optimization",
      allowInsecureHttpForLocalhost: true,
    });
    const apiServer = createOptimizationHttpServer({
      oidcClient,
      telemetry: new TelemetryIngestionService(db),
      datasets: new DatasetManagementService(db),
    });
    await new Promise<void>((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
    const apiUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;

    try {
      const tok1 = signEdDsa(
        "rot-1",
        serviceClaims(issuerUrl),
        k1.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      );
      expect(
        (
          await fetch(`${apiUrl}/v1/telemetry/events`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tok1}`, "Content-Type": "application/json" },
            body: telemetryEvent("e_1"),
          })
        ).status,
      ).toBe(202);
      expect(discoveryHits).toBe(1);
      expect(jwksHits).toBe(1);

      const tokEnc = signEdDsa(
        "enc-only",
        serviceClaims(issuerUrl),
        encKey.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      );
      expect(
        (
          await fetch(`${apiUrl}/v1/telemetry/events`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokEnc}`, "Content-Type": "application/json" },
            body: telemetryEvent("e_enc"),
          })
        ).status,
      ).toBe(401);

      activeKeys = [jwk1, jwk2];
      const tok2 = signEdDsa(
        "rot-2",
        serviceClaims(issuerUrl),
        k2.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      );
      expect(
        (
          await fetch(`${apiUrl}/v1/telemetry/events`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tok2}`, "Content-Type": "application/json" },
            body: telemetryEvent("e_2"),
          })
        ).status,
      ).toBe(202);
      // enc-only is an unknown kid after filtering, so verify refreshes JWKS
      // before rejecting; rotation then triggers one more fetch.
      expect(jwksHits).toBe(3);
    } finally {
      await new Promise<void>((resolve) => apiServer.close(() => resolve()));
      await new Promise<void>((resolve) => idpServer.close(() => resolve()));
      db.close();
    }
  });

  it("rejects expired tokens with HTTP 401 and distinguishes them from cross-tenant authorization failures (HTTP 403)", async () => {
    const key = generateKeyPairSync("ed25519");
    const jwk = { ...key.publicKey.export({ format: "jwk" }), kid: "rot-1", use: "sig" };
    const idpServer = http.createServer((req, res) => {
      const issuer = `http://127.0.0.1:${(idpServer.address() as AddressInfo).port}`;
      if (req.url === "/.well-known/openid-configuration") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ issuer, jwks_uri: `${issuer}/jwks.json` }));
        return;
      }
      if (req.url === "/jwks.json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => idpServer.listen(0, "127.0.0.1", resolve));
    const issuerUrl = `http://127.0.0.1:${(idpServer.address() as AddressInfo).port}`;

    const db = new OptimizationDatabase(":memory:");
    db.migrate();
    const oidcClient = new OidcJwksClient({
      issuerUrl,
      expectedAudience: "ai-optimization",
      allowInsecureHttpForLocalhost: true,
    });
    const apiServer = createOptimizationHttpServer({
      oidcClient,
      telemetry: new TelemetryIngestionService(db),
      datasets: new DatasetManagementService(db),
    });
    await new Promise<void>((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
    const apiUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;
    const pem = key.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    try {
      const now = Math.floor(Date.now() / 1000);
      const expiredTok = signEdDsa("rot-1", serviceClaims(issuerUrl, { exp: now - 30 }), pem);
      const expiredRes = await fetch(`${apiUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${expiredTok}`, "Content-Type": "application/json" },
        body: telemetryEvent("e_expired"),
      });
      expect(expiredRes.status).toBe(401);
      await expect(expiredRes.json()).resolves.toMatchObject({ error: "token_expired" });

      const validTok = signEdDsa("rot-1", serviceClaims(issuerUrl), pem);
      const crossTenantRes = await fetch(`${apiUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${validTok}`, "Content-Type": "application/json" },
        body: telemetryEvent("e_cross", "tenant_other"),
      });
      expect(crossTenantRes.status).toBe(403);

      await expectAuthError(
        oidcClient.verifyAuthorization(`Bearer ${validTok}`, { requireRole: "approver" }),
        "insufficient_permissions",
        /approver/,
      );
    } finally {
      await new Promise<void>((resolve) => apiServer.close(() => resolve()));
      await new Promise<void>((resolve) => idpServer.close(() => resolve()));
      db.close();
    }
  });

  it("rejects a non-HTTPS issuer URL", async () => {
    const client = new OidcJwksClient({
      issuerUrl: "http://evil.example.com",
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["evil.example.com"],
      dnsLookupFn: publicDnsLookup(),
      fetchFn: async () => {
        throw new Error("issuer URL must be rejected before fetch");
      },
    });
    await expectAuthError(client.verifyAuthorization("Bearer a.b.c"), "invalid_issuer", /must use HTTPS/);
  });

  it("does not allow localhost HTTP unless allowInsecureHttpForLocalhost is explicitly enabled", async () => {
    const client = new OidcJwksClient({
      issuerUrl: "http://127.0.0.1:65535",
      expectedAudience: "ai-optimization",
      fetchFn: async () => {
        throw new Error("localhost HTTP must stay opt-in");
      },
    });
    await expectAuthError(client.verifyAuthorization("Bearer a.b.c"), "invalid_issuer", /must use HTTPS/);
  });

  it("rejects a missing discovery issuer and a mismatched discovery issuer", async () => {
    const missingIssuer = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      fetchFn: async () =>
        new Response(JSON.stringify({ jwks_uri: `${REMOTE_ISSUER}/jwks.json` }), { status: 200 }),
    });
    await expectAuthError(
      missingIssuer.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /missing or mismatched issuer/,
    );

    const mismatchedIssuer = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      fetchFn: async () =>
        new Response(
          JSON.stringify({ issuer: "https://other.example.com", jwks_uri: `${REMOTE_ISSUER}/jwks.json` }),
          { status: 200 },
        ),
    });
    await expectAuthError(
      mismatchedIssuer.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /missing or mismatched issuer/,
    );
  });

  it("rejects a non-HTTPS jwks_uri even when the discovery issuer is HTTPS", async () => {
    let jwksFetched = false;
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      async fetchFn(input) {
        const url = String(input);
        if (url.includes("openid-configuration")) {
          return new Response(
            JSON.stringify({ issuer: REMOTE_ISSUER, jwks_uri: "http://idp.example.com/jwks.json" }),
            { status: 200 },
          );
        }
        jwksFetched = true;
        return new Response(JSON.stringify({ keys: [] }), { status: 200 });
      },
    });
    await expectAuthError(
      client.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /jwks_uri must use HTTPS/,
    );
    expect(jwksFetched).toBe(false);
  });

  it("denies fetches to a public HTTPS host that is not in the JWKS allowlist", async () => {
    let fetched = false;
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      dnsLookupFn: publicDnsLookup(),
      fetchFn: async () => {
        fetched = true;
        return new Response("{}", { status: 200 });
      },
    });
    await expectAuthError(
      client.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /allowlist/,
    );
    expect(fetched).toBe(false);
  });

  it("rejects a JWKS or discovery hostname that resolves to a private or metadata address", async () => {
    let fetched = false;
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: async () => ["169.254.169.254"],
      fetchFn: async () => {
        fetched = true;
        return new Response("{}", { status: 200 });
      },
    });
    await expectAuthError(
      client.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /disallowed address/,
    );
    expect(fetched).toBe(false);
  });

  it("rejects cloud metadata addresses even when they appear in the JWKS allowlist", async () => {
    let fetched = false;
    const client = new OidcJwksClient({
      issuerUrl: "https://169.254.169.254",
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["169.254.169.254", "169.254.169.0/24"],
      fetchFn: async () => {
        fetched = true;
        return new Response("{}", { status: 200 });
      },
    });
    await expectAuthError(
      client.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /disallowed address/,
    );
    expect(fetched).toBe(false);
  });

  it("rejects HTTPS to HTTP redirects and redirects to a private or metadata address", async () => {
    const downgrade = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      fetchFn: async () =>
        new Response(null, { status: 302, headers: { Location: "http://idp.example.com/openid-configuration" } }),
    });
    await expectAuthError(
      downgrade.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /HTTPS to HTTP redirect is not allowed/,
    );

    const metadata = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      fetchFn: async () =>
        new Response(null, { status: 302, headers: { Location: "https://169.254.169.254/latest/meta-data" } }),
    });
    await expectAuthError(
      metadata.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /allowlist|disallowed address/,
    );
  });

  it("rejects redirect chains that exceed the configured hop limit", async () => {
    let hops = 0;
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      maxRedirects: 2,
      async fetchFn() {
        hops += 1;
        return new Response(null, {
          status: 302,
          headers: { Location: `${REMOTE_ISSUER}/redirect-${hops}` },
        });
      },
    });
    await expectAuthError(
      client.verifyAuthorization("Bearer a.b.c"),
      "invalid_issuer",
      /redirect limit exceeded/,
    );
    expect(hops).toBe(3);
  });

  it("stops consuming an oversized OIDC/JWKS response at maxResponseBytes without buffering the remainder", async () => {
    const maxBytes = 1024;
    const chunkSize = 256;
    let pulled = 0;
    const wouldProduceBytes = 10 * 1024 * 1024;
    const oversized = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= wouldProduceBytes) {
          controller.close();
          return;
        }
        const chunk = new Uint8Array(chunkSize).fill(0x61);
        pulled += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      maxResponseBytes: maxBytes,
      fetchFn: async () => new Response(oversized, { status: 200, headers: { "Content-Type": "application/json" } }),
    });
    await expectAuthError(
      client.verifyAuthorization("Bearer a.b.c"),
      "invalid_signature",
      /maxResponseBytes/,
    );
    expect(pulled).toBeGreaterThan(maxBytes);
    // The stream would have produced 10 MiB if fully consumed. Cancel may let
    // one or two already-queued chunks through, but must not buffer the rest.
    expect(pulled).toBeLessThan(maxBytes + chunkSize * 8);
    expect(pulled).toBeLessThan(wouldProduceBytes / 10);
  });

  it("rejects malformed OIDC JSON and enforces a failure negative cache", async () => {
    let hits = 0;
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      negativeCacheMs: 60_000,
      fetchFn: async () => {
        hits += 1;
        return new Response("{not-json", { status: 200 });
      },
    });
    await expectAuthError(client.verifyAuthorization("Bearer a.b.c"), "invalid_signature", /Malformed OIDC\/JWKS JSON/);
    await expectAuthError(
      client.verifyAuthorization("Bearer a.b.c"),
      "invalid_signature",
      /negative-cache/,
    );
    expect(hits).toBe(1);
  });

  it("times out a stalled OIDC/JWKS request", async () => {
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      requestTimeoutMs: 50,
      async fetchFn(_input, init) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => resolve(), 10_000);
          init?.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(init.signal?.reason ?? new Error("aborted"));
            },
            { once: true },
          );
        });
        return new Response("{}", { status: 200 });
      },
    });
    await expectAuthError(client.verifyAuthorization("Bearer a.b.c"), "invalid_signature", /timed out/);
  });

  it("coalesces concurrent JWKS refreshes through singleflight", async () => {
    const key = generateKeyPairSync("ed25519");
    const jwk = { ...key.publicKey.export({ format: "jwk" }), kid: "rot-1", use: "sig", key_ops: ["verify"] };
    let inflight = 0;
    let maxInflight = 0;
    let discoveryHits = 0;
    let jwksHits = 0;
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      async fetchFn(input) {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        try {
          await new Promise((resolve) => setTimeout(resolve, 40));
          const url = String(input);
          if (url.includes("openid-configuration")) {
            discoveryHits += 1;
            return new Response(
              JSON.stringify({ issuer: REMOTE_ISSUER, jwks_uri: `${REMOTE_ISSUER}/jwks.json` }),
              { status: 200 },
            );
          }
          jwksHits += 1;
          return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
        } finally {
          inflight -= 1;
        }
      },
    });
    const token = signEdDsa(
      "rot-1",
      serviceClaims(REMOTE_ISSUER),
      key.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    );
    const [first, second] = await Promise.all([
      client.verifyAuthorization(`Bearer ${token}`),
      client.verifyAuthorization(`Bearer ${token}`),
    ]);
    expect(first.tenantId).toBe("tenant_sandbox");
    expect(second.tenantId).toBe("tenant_sandbox");
    expect(discoveryHits).toBe(1);
    expect(jwksHits).toBe(1);
    expect(maxInflight).toBe(1);
  });

  it("filters use=enc, alg-mismatched, key_ops-without-verify, missing-kid, and invalid JWK material, then rejects an unknown kid", async () => {
    const validKey = generateKeyPairSync("ed25519");
    const encKey = generateKeyPairSync("ed25519");
    const algMismatchKey = generateKeyPairSync("ed25519");
    const opsKey = generateKeyPairSync("ed25519");
    const noKidKey = generateKeyPairSync("ed25519");
    const keys = [
      { ...validKey.publicKey.export({ format: "jwk" }), kid: "good", use: "sig", key_ops: ["verify"] },
      { ...encKey.publicKey.export({ format: "jwk" }), kid: "enc-only", use: "enc" },
      { ...algMismatchKey.publicKey.export({ format: "jwk" }), kid: "alg-bad", use: "sig", alg: "RS256" },
      { ...opsKey.publicKey.export({ format: "jwk" }), kid: "sign-only", use: "sig", key_ops: ["sign"] },
      { ...noKidKey.publicKey.export({ format: "jwk" }), use: "sig" },
      { kty: "RSA", kid: "invalid-jwk", use: "sig", n: "!!!", e: "AQAB" },
    ];
    const client = new OidcJwksClient({
      issuerUrl: REMOTE_ISSUER,
      expectedAudience: "ai-optimization",
      allowedJwksHosts: ["idp.example.com"],
      dnsLookupFn: publicDnsLookup(),
      cacheTtlMs: 60_000,
      async fetchFn(input) {
        const url = String(input);
        if (url.includes("openid-configuration")) {
          return new Response(
            JSON.stringify({ issuer: REMOTE_ISSUER, jwks_uri: `${REMOTE_ISSUER}/jwks.json` }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ keys }), { status: 200 });
      },
    });

    const goodTok = signEdDsa(
      "good",
      serviceClaims(REMOTE_ISSUER),
      validKey.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    );
    await expect(client.verifyAuthorization(`Bearer ${goodTok}`)).resolves.toMatchObject({
      tenantId: "tenant_sandbox",
      subjectId: "svc_openbot_sandbox",
    });

    const pemEnc = encKey.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const pemAlg = algMismatchKey.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const pemOps = opsKey.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    await expectAuthError(
      client.verifyAuthorization(`Bearer ${signEdDsa("enc-only", serviceClaims(REMOTE_ISSUER), pemEnc)}`),
      "invalid_signature",
      /Unknown signing key id/,
    );
    await expectAuthError(
      client.verifyAuthorization(`Bearer ${signEdDsa("alg-bad", serviceClaims(REMOTE_ISSUER), pemAlg)}`),
      "invalid_signature",
      /Unknown signing key id/,
    );
    await expectAuthError(
      client.verifyAuthorization(`Bearer ${signEdDsa("sign-only", serviceClaims(REMOTE_ISSUER), pemOps)}`),
      "invalid_signature",
      /Unknown signing key id/,
    );
    await expectAuthError(
      client.verifyAuthorization(`Bearer ${signEdDsa("missing-key", serviceClaims(REMOTE_ISSUER), pemEnc)}`),
      "invalid_signature",
      /Unknown signing key id/,
    );
  });
});
