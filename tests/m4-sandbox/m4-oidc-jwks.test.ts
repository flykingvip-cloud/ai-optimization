import { generateKeyPairSync, sign } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { OptimizationDatabase } from "../../packages/shared-contracts/src/db.js";
import { OidcJwksClient } from "../../packages/shared-contracts/src/oidc-jwks.js";
import { DatasetManagementService } from "../../services/dataset-management/src/index.js";
import { createOptimizationHttpServer } from "../../services/http-api/src/server.js";
import { TelemetryIngestionService } from "../../services/telemetry-ingestion/src/index.js";

function signEdDsa(kid: string, payload: Record<string, unknown>, privateKeyPem: string): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const header = b64({ alg: "EdDSA", typ: "JWT", kid });
  const body = b64(payload);
  const sig = sign(null, Buffer.from(`${header}.${body}`, "utf8"), privateKeyPem).toString("base64url");
  return `${header}.${body}.${sig}`;
}

describe("M4-02 Real OIDC Discovery, JWKS Caching & Key Rotation", () => {
  it("discovers JWKS over HTTP, caches keys, rotates on new kid, and rejects expired/cross-tenant tokens", async () => {
    const k1 = generateKeyPairSync("ed25519");
    const k2 = generateKeyPairSync("ed25519");
    const jwk1 = { ...k1.publicKey.export({ format: "jwk" }), kid: "rot-1", use: "sig" };
    const jwk2 = { ...k2.publicKey.export({ format: "jwk" }), kid: "rot-2", use: "sig" };

    let activeKeys = [jwk1];
    let discoveryHits = 0;
    let jwksHits = 0;

    const idpServer = http.createServer((req, res) => {
      const addr = idpServer.address() as AddressInfo;
      const issuer = `http://127.0.0.1:${addr.port}`;
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

    await new Promise<void>((r) => idpServer.listen(0, "127.0.0.1", r));
    const idpPort = (idpServer.address() as AddressInfo).port;
    const issuerUrl = `http://127.0.0.1:${idpPort}`;

    const db = new OptimizationDatabase(":memory:");
    db.migrate();
    const oidcClient = new OidcJwksClient({ issuerUrl, expectedAudience: "ai-optimization" });
    const apiServer = createOptimizationHttpServer({
      oidcClient,
      telemetry: new TelemetryIngestionService(db),
      datasets: new DatasetManagementService(db),
    });
    await new Promise<void>((r) => apiServer.listen(0, "127.0.0.1", r));
    const apiUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;

    try {
      const now = Math.floor(Date.now() / 1000);
      const evt = (id: string, tenantId = "tenant_sandbox") =>
        JSON.stringify({
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

      const tok1 = signEdDsa(
        "rot-1",
        {
          iss: issuerUrl,
          aud: "ai-optimization",
          sub: "svc_openbot_sandbox",
          tenantId: "tenant_sandbox",
          principalType: "service",
          roles: ["service"],
          exp: now + 300,
        },
        k1.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      );

      const res1 = await fetch(`${apiUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok1}`, "Content-Type": "application/json" },
        body: evt("e_1"),
      });
      expect(res1.status).toBe(202);
      expect(discoveryHits).toBe(1);
      expect(jwksHits).toBe(1);

      // Rotate key: add rot-2 to IdP JWKS endpoint
      activeKeys = [jwk1, jwk2];
      const tok2 = signEdDsa(
        "rot-2",
        {
          iss: issuerUrl,
          aud: "ai-optimization",
          sub: "svc_openbot_sandbox",
          tenantId: "tenant_sandbox",
          principalType: "service",
          roles: ["service"],
          exp: now + 300,
        },
        k2.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      );
      const res2 = await fetch(`${apiUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok2}`, "Content-Type": "application/json" },
        body: evt("e_2"),
      });
      expect(res2.status).toBe(202);
      expect(jwksHits).toBe(2);

      // Expired token -> 401
      const expiredTok = signEdDsa(
        "rot-2",
        {
          iss: issuerUrl,
          aud: "ai-optimization",
          sub: "svc_openbot_sandbox",
          tenantId: "tenant_sandbox",
          principalType: "service",
          exp: now - 10,
        },
        k2.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      );
      const resExpired = await fetch(`${apiUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${expiredTok}`, "Content-Type": "application/json" },
        body: evt("e_3"),
      });
      expect(resExpired.status).toBe(401);

      // Cross-tenant -> 403
      const resCross = await fetch(`${apiUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok2}`, "Content-Type": "application/json" },
        body: evt("e_4", "tenant_other"),
      });
      expect(resCross.status).toBe(403);
    } finally {
      await new Promise<void>((r) => apiServer.close(() => r()));
      await new Promise<void>((r) => idpServer.close(() => r()));
      db.close();
    }
  });
});
