import { createHmac, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuthError, verifyJwtAuth, type JwtVerifierConfig } from "../../packages/shared-contracts/src/auth.js";
import type { AuthContext, DatasetCase, TelemetryEvent } from "../../packages/shared-contracts/src/index.js";
import { BoundedTelemetryClient } from "../../packages/telemetry-sdk/src/index.js";
import { ArtifactRegistryService } from "../../services/artifact-registry/src/index.js";
import { DatasetGovernanceError, DatasetManagementService } from "../../services/dataset-management/src/index.js";

function signHs256Jwt(header: Record<string, unknown>, payload: Record<string, unknown>, secret: string): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const h = b64(header);
  const p = b64(payload);
  const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

describe("P0-02/03/04/05 Security, Auth, PII Scan, Redaction & Artifact Trust", () => {
  const jwtCfg: JwtVerifierConfig = {
    expectedIssuer: "https://auth.openbot.love",
    expectedAudience: "ai-optimization",
    hmacSecret: "test-secret-key-32-bytes-minimum",
  };

  it("P0-02 enforces JWT/OIDC verification, expiry, nbf, issuer, audience, and role", () => {
    const now = 1_700_000_000;
    const validToken = signHs256Jwt(
      { alg: "HS256", typ: "JWT" },
      {
        iss: "https://auth.openbot.love",
        aud: "ai-optimization",
        sub: "user_1",
        tenantId: "tenant_a",
        principalType: "user",
        roles: ["operator"],
        nbf: now - 10,
        exp: now + 300,
      },
      jwtCfg.hmacSecret!,
    );
    const ctx = verifyJwtAuth(`Bearer ${validToken}`, jwtCfg, { nowSec: now, requireRole: "operator" });
    expect(ctx.tenantId).toBe("tenant_a");
    expect(ctx.subjectId).toBe("user_1");

    expect(() => verifyJwtAuth(undefined, jwtCfg)).toThrow(AuthError);
    expect(() => verifyJwtAuth(`Bearer ${validToken}`, jwtCfg, { nowSec: now + 400 })).toThrow(/expired/);
    expect(() => verifyJwtAuth(`Bearer ${validToken}`, jwtCfg, { nowSec: now - 20 })).toThrow(/not yet active/);

    const svcImpersonation = signHs256Jwt(
      { alg: "HS256" },
      {
        iss: "https://auth.openbot.love",
        aud: "ai-optimization",
        sub: "svc_1",
        tenantId: "tenant_a",
        principalType: "service",
        actAsUser: "user_1",
        exp: now + 300,
      },
      jwtCfg.hmacSecret!,
    );
    expect(() =>
      verifyJwtAuth(`Bearer ${svcImpersonation}`, jwtCfg, { nowSec: now, disallowServiceImpersonation: true }),
    ).toThrow(/impersonate/);
  });

  it("P0-03 actively blocks DatasetCase with nested secret or PII even if client claims redacted", () => {
    const ds = new DatasetManagementService();
    const auth: AuthContext = { subjectId: "u1", tenantId: "tenant_a", roles: ["operator"] };
    const spoofedCase: DatasetCase & { contentPayload?: unknown } = {
      caseId: "c_leak",
      datasetId: "ds_1",
      datasetVersion: "v1",
      tenantId: "tenant_a",
      split: "golden",
      contentHash: "b".repeat(64),
      inputSnapshotRef: "snap://ok",
      labels: { nested: "ok" },
      sourceAuthorization: { authorized: true, policyRef: "pol_1", subjectId: "u1" },
      redactionStatus: "redacted",
      reviewStatus: "approved",
      createdAt: "2026-11-27T00:00:00Z",
      contentPayload: { nested: { secret: "sk-proj-1234567890abcdef" } },
    };

    expect(() =>
      ds.publishVersion(auth, { datasetId: "ds_1", version: "v1", split: "golden", cases: [spoofedCase] }),
    ).toThrow(DatasetGovernanceError);
  });

  it("P0-04 strips unauthorized Telemetry fields via allowlist and redacts allowed strings", async () => {
    const sent: TelemetryEvent[] = [];
    const client = new BoundedTelemetryClient({
      transport: {
        async send(batch) {
          sent.push(...batch);
        },
      },
    });
    client.enqueue({
      schemaVersion: "1.0.0",
      eventId: "e1",
      idempotencyKey: "k1",
      eventType: "runtime.run.completed",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_a",
      source: { system: "openbot", component: "runner" },
      traceContext: { traceId: "t1", runId: "r1" },
      redaction: { applied: false, policy: "none" },
      payload: {
        status: "ok",
        rawPrompt: "SECRET USER PROMPT",
        apiKey: "sk-1234567890",
        errorCode: "contact admin@acme.com",
      },
    });
    await client.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.payload).toEqual({
      status: "ok",
      errorCode: "contact ***@***",
    });
    expect(sent[0]!.payload).not.toHaveProperty("rawPrompt");
    expect(sent[0]!.payload).not.toHaveProperty("apiKey");
  });

  it("P0-05 enforces maxOpenBotVersion, agentIds scope, and approvalPolicy", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const registry = new ArtifactRegistryService();
    registry.registerTrustedKey("k1", pubPem);
    const auth: AuthContext = { subjectId: "u1", tenantId: "tenant_a", roles: ["operator"] };

    const art = registry.createSignedArtifact(
      auth,
      {
        artifactId: "art_scope",
        artifactType: "prompt_template",
        artifactVersion: "1.0.0",
        schemaVersion: "1.0.0",
        targetScope: { agentIds: ["bot_1"], minOpenBotVersion: "2026.11.0", maxOpenBotVersion: "2026.12.0" },
        sourceExperimentId: "exp_1",
        evaluationReportRef: "rep_1",
        datasetVersion: "ds_1@v1",
        createdAt: "2026-11-27T00:00:00Z",
        issuedAt: "2026-11-27T00:00:00Z",
        expiresAt: "2026-12-27T00:00:00Z",
        rollbackTargetArtifactId: null,
        keyId: "k1",
        issuer: "ai-opt",
        approvalPolicy: "human_required",
        monotonicEpoch: 2,
        payload: { append: "cite" },
      },
      privPem,
    );

    expect(
      registry.verifyForOpenBot(art, {
        expectedTenantId: "tenant_a",
        targetAgentId: "bot_2",
        openBotVersion: "2026.11.5",
        lastAppliedEpoch: 1,
        hasHumanApproval: true,
        nowIso: "2026-11-28T00:00:00Z",
      }),
    ).toEqual({ valid: false, reason: "agent_scope_mismatch" });

    expect(
      registry.verifyForOpenBot(art, {
        expectedTenantId: "tenant_a",
        targetAgentId: "bot_1",
        openBotVersion: "2027.1.0",
        lastAppliedEpoch: 1,
        hasHumanApproval: true,
        nowIso: "2026-11-28T00:00:00Z",
      }),
    ).toEqual({ valid: false, reason: "incompatible_openbot_version" });

    expect(
      registry.verifyForOpenBot(art, {
        expectedTenantId: "tenant_a",
        targetAgentId: "bot_1",
        openBotVersion: "2026.11.5",
        lastAppliedEpoch: 1,
        hasHumanApproval: false,
        nowIso: "2026-11-28T00:00:00Z",
      }),
    ).toEqual({ valid: false, reason: "approval_required" });
  });
});
