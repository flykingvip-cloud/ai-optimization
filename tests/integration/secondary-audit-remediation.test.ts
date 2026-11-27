import { generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OptimizationDatabase } from "../../packages/shared-contracts/src/db.js";
import type { AuthContext, DatasetCase, OptimizationArtifact, TelemetryEvent } from "../../packages/shared-contracts/src/index.js";
import { BoundedTelemetryClient } from "../../packages/telemetry-sdk/src/index.js";
import { ArtifactRegistryService } from "../../services/artifact-registry/src/index.js";
import { DatasetManagementService } from "../../services/dataset-management/src/index.js";
import { EvaluationEngineService } from "../../services/evaluation-engine/src/index.js";
import { detectJudgeDrift } from "../../services/evaluation-engine/src/reliability.js";
import {
  adjustPValues,
  computeAchievedPower,
  computeRequiredSampleSizePerArm,
  ExperimentEngineService,
} from "../../services/experiment-engine/src/index.js";
import { createOptimizationHttpServer } from "../../services/http-api/src/server.js";
import { TelemetryIngestionService } from "../../services/telemetry-ingestion/src/index.js";

const AUTH: AuthContext = { subjectId: "u1", tenantId: "tenant_a", roles: ["operator"] };

function signEdDsaJwt(kid: string, payload: Record<string, unknown>, privateKeyPem: string): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const header = b64({ alg: "EdDSA", typ: "JWT", kid });
  const body = b64(payload);
  const sig = sign(null, Buffer.from(`${header}.${body}`, "utf8"), privateKeyPem).toString("base64url");
  return `${header}.${body}.${sig}`;
}

describe("Secondary Code Review Remediations (P0-06/07 & P1-07/08/09/10)", () => {
  it("P0-06 rejects tampering of ANY security-critical metadata field on OptimizationArtifact", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const registry = new ArtifactRegistryService();
    registry.registerTrustedKey("k1", pubPem);

    const art = registry.createSignedArtifact(
      AUTH,
      {
        artifactId: "art_full_sign",
        artifactType: "prompt_template",
        artifactVersion: "1.0.0",
        schemaVersion: "1.0.0",
        targetScope: { agentIds: ["bot_1"], minOpenBotVersion: "2026.11.0" },
        sourceExperimentId: "exp_1",
        evaluationReportRef: "eval_rep_1",
        datasetVersion: "ds_1@v1",
        createdAt: "2026-11-27T00:00:00Z",
        issuedAt: "2026-11-27T00:00:00Z",
        expiresAt: "2026-12-27T00:00:00Z",
        rollbackTargetArtifactId: "art_0",
        keyId: "k1",
        issuer: "ai-opt-prod",
        approvalPolicy: "human_required",
        monotonicEpoch: 10,
        payload: { prompt: "be concise" },
      },
      privPem,
    );

    const ctx = {
      expectedTenantId: "tenant_a",
      targetAgentId: "bot_1",
      openBotVersion: "2026.11.1",
      lastAppliedEpoch: 9,
      hasHumanApproval: true,
      nowIso: "2026-11-28T00:00:00Z",
    };
    expect(registry.verifyForOpenBot(art, ctx)).toEqual({ valid: true });

    const tamperedVariants: OptimizationArtifact[] = [
      { ...art, approvalPolicy: "policy_gate" },
      { ...art, sourceExperimentId: "exp_fake" },
      { ...art, evaluationReportRef: "eval_fake" },
      { ...art, datasetVersion: "ds_fake@v99" },
      { ...art, issuer: "attacker" },
      { ...art, rollbackTargetArtifactId: null },
    ];
    for (const tampered of tamperedVariants) {
      expect(registry.verifyForOpenBot(tampered, ctx)).toEqual({
        valid: false,
        reason: "invalid_signature",
      });
    }
  });

  it("P0-07 enforces EdDSA JWT/OIDC and JWKS key rotation on real HTTP server", async () => {
    const k1 = generateKeyPairSync("ed25519");
    const k2 = generateKeyPairSync("ed25519");
    const db = new OptimizationDatabase(":memory:");
    db.migrate();

    const server = createOptimizationHttpServer({
      jwtConfig: {
        expectedIssuer: "https://auth.openbot.love",
        expectedAudience: "ai-optimization",
        publicKeysByKid: {
          "jwks-1": k1.publicKey.export({ type: "spki", format: "pem" }).toString(),
          "jwks-2": k2.publicKey.export({ type: "spki", format: "pem" }).toString(),
        },
      },
      telemetry: new TelemetryIngestionService(db),
      datasets: new DatasetManagementService(db),
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const unauth = await fetch(`${baseUrl}/v1/telemetry/events`, { method: "POST", body: "{}" });
      expect(unauth.status).toBe(401);

      const now = Math.floor(Date.now() / 1000);
      const token1 = signEdDsaJwt(
        "jwks-1",
        {
          iss: "https://auth.openbot.love",
          aud: "ai-optimization",
          sub: "svc_openbot",
          tenantId: "tenant_a",
          principalType: "service",
          roles: ["service"],
          exp: now + 300,
        },
        k1.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      );

      const okRes = await fetch(`${baseUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token1}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: "1.0.0",
          eventId: "e_http_1",
          idempotencyKey: "k_http_1",
          eventType: "runtime.run.completed",
          occurredAt: "2026-11-27T00:00:00Z",
          tenantId: "tenant_a",
          source: { system: "openbot", component: "gateway" },
          traceContext: { traceId: "tr_1", runId: "run_1" },
          redaction: { applied: true, policy: "v1" },
          payload: { status: "ok" },
        }),
      });
      expect(okRes.status).toBe(202);

      // Rotated key jwks-2
      const token2 = signEdDsaJwt(
        "jwks-2",
        {
          iss: "https://auth.openbot.love",
          aud: "ai-optimization",
          sub: "svc_openbot",
          tenantId: "tenant_b",
          principalType: "service",
          roles: ["service"],
          exp: now + 300,
        },
        k2.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      );
      const crossTenant = await fetch(`${baseUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token2}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: "1.0.0",
          eventId: "e_http_2",
          idempotencyKey: "k_http_2",
          eventType: "runtime.run.completed",
          occurredAt: "2026-11-27T00:00:00Z",
          tenantId: "tenant_a",
          source: { system: "openbot", component: "gateway" },
          traceContext: { traceId: "tr_2", runId: "run_2" },
          redaction: { applied: true, policy: "v1" },
          payload: { status: "ok" },
        }),
      });
      expect(crossTenant.status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    }
  });

  it("P1-07 persists all 5 core services across SQLite reopen", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-opt-persist-"));
    const dbPath = path.join(tmpDir, "all-services.db");
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    const db1 = new OptimizationDatabase(dbPath);
    db1.migrate();
    const tel1 = new TelemetryIngestionService(db1);
    const ds1 = new DatasetManagementService(db1);
    const eval1 = new EvaluationEngineService(db1);
    const exp1 = new ExperimentEngineService(db1);
    const art1 = new ArtifactRegistryService(db1);

    tel1.ingest(AUTH, {
      schemaVersion: "1.0.0",
      eventId: "e_db",
      idempotencyKey: "k_db",
      eventType: "runtime.run.completed",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_a",
      source: { system: "openbot", component: "runner" },
      traceContext: { traceId: "tr1", runId: "r1" },
      redaction: { applied: true, policy: "v1" },
      payload: {},
    });
    const dc: DatasetCase = {
      caseId: "c_db",
      datasetId: "ds_db",
      datasetVersion: "v1",
      tenantId: "tenant_a",
      split: "golden",
      contentHash: "c".repeat(64),
      inputSnapshotRef: "snap://db",
      labels: {},
      sourceAuthorization: { authorized: true, policyRef: "p1", subjectId: "u1" },
      redactionStatus: "redacted",
      reviewStatus: "approved",
      createdAt: "2026-11-27T00:00:00Z",
    };
    ds1.publishVersion(AUTH, { datasetId: "ds_db", version: "v1", split: "golden", cases: [dc] });
    eval1.evaluateByRules(AUTH, { runId: "r1", httpStatus: 200, outputText: "good", citations: [], toolCalls: [] });
    exp1.register(AUTH, {
      experimentId: "exp_db",
      experimentType: "online_ab",
      baselineVersion: "v1",
      candidateVersion: "v2",
      randomizationUnit: "run_id",
      allocationRatio: 0.5,
      sampleSizeTarget: 10,
      minimumDetectableEffect: 0.1,
      confidenceLevel: 0.95,
      statisticalPower: 0.8,
      primaryMetric: "correctness",
      guardrailMetrics: [],
      stoppingRule: "none",
      multipleComparisonPolicy: "fdr_bh",
    });
    art1.createSignedArtifact(
      AUTH,
      {
        artifactId: "art_db",
        artifactType: "prompt_template",
        artifactVersion: "1.0.0",
        schemaVersion: "1.0.0",
        targetScope: { agentIds: ["bot_1"], minOpenBotVersion: "2026.11.0" },
        sourceExperimentId: "exp_db",
        evaluationReportRef: "rep_db",
        datasetVersion: "ds_db@v1",
        createdAt: "2026-11-27T00:00:00Z",
        issuedAt: "2026-11-27T00:00:00Z",
        expiresAt: "2026-12-27T00:00:00Z",
        rollbackTargetArtifactId: null,
        keyId: "k1",
        issuer: "ai-opt",
        approvalPolicy: "human_required",
        monotonicEpoch: 1,
        payload: { x: 1 },
      },
      privPem,
    );
    db1.close();

    const db2 = new OptimizationDatabase(dbPath);
    expect(new TelemetryIngestionService(db2).listForTenant(AUTH)).toHaveLength(1);
    expect(new DatasetManagementService(db2).getVersion(AUTH, "ds_db", "v1").cases).toHaveLength(1);
    expect(new EvaluationEngineService(db2).listForTenant(AUTH)).toHaveLength(1);
    expect(
      new ExperimentEngineService(db2).evaluateOutcome(AUTH, {
        experimentId: "exp_db",
        sampleSizeActual: 5,
        observedEffect: 0.2,
        rawPValues: [0.01],
        guardrailBreached: false,
      }).conclusion,
    ).toBe("inconclusive");
    const art2 = new ArtifactRegistryService(db2);
    art2.registerTrustedKey("k1", pubPem);
    const loadedArt = art2.getArtifact(AUTH, "art_db");
    expect(loadedArt).not.toBeNull();
    expect(
      art2.verifyForOpenBot(loadedArt!, {
        expectedTenantId: "tenant_a",
        targetAgentId: "bot_1",
        openBotVersion: "2026.11.0",
        lastAppliedEpoch: 0,
        hasHumanApproval: true,
        nowIso: "2026-11-28T00:00:00Z",
      }),
    ).toEqual({ valid: true });
    db2.close();
  });

  it("P1-08 recovers valid records when WAL has corrupt trailing line and evicts oldest under maxWalBytes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-opt-wal-crash-"));
    const walPath = path.join(tmpDir, "wal.jsonl");
    const mkEvt = (id: string): TelemetryEvent => ({
      schemaVersion: "1.0.0",
      eventId: id,
      idempotencyKey: id,
      eventType: "runtime.run.completed",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_a",
      source: { system: "openbot", component: "runner" },
      traceContext: { traceId: "tr", runId: id },
      redaction: { applied: true, policy: "v1" },
      payload: { status: "ok" },
    });

    fs.writeFileSync(walPath, `${JSON.stringify(mkEvt("e_valid"))}\n{"corrupt_partial":`, "utf8");
    const recoveredClient = new BoundedTelemetryClient({
      walFilePath: walPath,
      maxWalBytes: 400,
      transport: { async send() {} },
    });
    expect(recoveredClient.getMetrics().queuedCount).toBe(1);
    recoveredClient.enqueue(mkEvt("e_newest"));
    expect(recoveredClient.getMetrics().droppedCount).toBeGreaterThanOrEqual(1);
    expect(recoveredClient.getMetrics().walBytes).toBeLessThanOrEqual(400);
  });

  it("P1-09/10 computes statistical power, FDR/Bonferroni, and detects zero-mean PSI distribution drift", () => {
    const reqN = computeRequiredSampleSizePerArm(0.05, 0.95, 0.8);
    expect(reqN).toBeGreaterThan(1000);
    expect(computeAchievedPower(reqN, 0.05, 0.95)).toBeGreaterThanOrEqual(0.79);

    expect(adjustPValues([0.01, 0.04], "bonferroni")).toEqual([0.02, 0.08]);
    expect(adjustPValues([0.01, 0.04], "fdr_bh")).toEqual([0.02, 0.04]);

    // Same mean (0.5), completely different distribution (peaked at 0.5 vs bimodal 0.05/0.95)
    const baseline = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const bimodal = [0.05, 0.05, 0.05, 0.95, 0.95, 0.95];
    const drift = detectJudgeDrift(baseline, bimodal);
    expect(drift.meanShift).toBe(0);
    expect(drift.psi).toBeGreaterThan(0.25);
    expect(drift.drifted).toBe(true);
  });
});
