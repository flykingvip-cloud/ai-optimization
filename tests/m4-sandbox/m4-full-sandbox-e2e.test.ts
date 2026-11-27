import { createHmac, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OptimizationDatabase } from "../../packages/shared-contracts/src/db.js";
import type { AuthContext, OptimizationArtifact, TelemetryEvent } from "../../packages/shared-contracts/src/index.js";
import { BoundedTelemetryClient } from "../../packages/telemetry-sdk/src/index.js";
import { ArtifactRegistryService } from "../../services/artifact-registry/src/index.js";
import { DatasetManagementService } from "../../services/dataset-management/src/index.js";
import { EvaluationEngineService } from "../../services/evaluation-engine/src/index.js";
import { ExperimentEngineService } from "../../services/experiment-engine/src/index.js";
import { createOptimizationHttpServer } from "../../services/http-api/src/server.js";
import { TelemetryIngestionService } from "../../services/telemetry-ingestion/src/index.js";

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64(payload);
  const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

describe("M4-03~06 OpenBot × AI Optimization Sandbox Full E2E", () => {
  it("runs Telemetry WAL fault-isolation, Evaluation, Experiment, Artifact verification, and OpenBot Canary/Rollback governance", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m4-sandbox-"));
    const db = new OptimizationDatabase(path.join(tmpDir, "m4.db"));
    db.migrate();

    const secret = "m4-sandbox-jwt-secret-32-bytes-ok";
    const auth: AuthContext = { subjectId: "svc_openbot", tenantId: "tenant_sandbox", roles: ["service", "operator"] };
    const telemetrySvc = new TelemetryIngestionService(db);
    const datasetSvc = new DatasetManagementService(db);
    const evalSvc = new EvaluationEngineService(db);
    const expSvc = new ExperimentEngineService(db);
    const artSvc = new ArtifactRegistryService(db);

    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    artSvc.registerTrustedKey("m4-key-1", pubPem);

    const token = signHs256(
      {
        iss: "https://auth.openbot.love",
        aud: "ai-optimization",
        sub: "svc_openbot",
        tenantId: "tenant_sandbox",
        principalType: "service",
        roles: ["service", "operator"],
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      secret,
    );

    // M4-03: Simulate AI Optimization unreachable while OpenBot runs
    let targetBaseUrl = "http://127.0.0.1:1"; // unreachable port
    const walClient = new BoundedTelemetryClient({
      walFilePath: path.join(tmpDir, "openbot.wal.jsonl"),
      transport: {
        async send(batch) {
          for (const evt of batch) {
            const res = await fetch(`${targetBaseUrl}/v1/telemetry/events`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify(evt),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          }
        },
      },
    });

    const runEvt: TelemetryEvent = {
      schemaVersion: "1.0.0",
      eventId: "evt_m4_1",
      idempotencyKey: "run_m4_1:done",
      eventType: "runtime.run.completed",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_sandbox",
      source: { system: "openbot", component: "sandbox-agent" },
      traceContext: { traceId: "4bf92f3577b34da6a3ce929d0e0e4736", runId: "run_m4_1", promptVersion: "pmt_v1" },
      redaction: { applied: true, policy: "v1" },
      payload: { status: "ok", latencyMs: 120 },
    };
    walClient.enqueue(runEvt);
    await expect(walClient.flush()).resolves.toBeUndefined();
    expect(walClient.getMetrics().exportErrorCount).toBe(1);
    expect(walClient.getMetrics().queuedCount).toBe(1);

    // Now start AI Optimization HTTP server
    const server = createOptimizationHttpServer({
      jwtConfig: {
        expectedIssuer: "https://auth.openbot.love",
        expectedAudience: "ai-optimization",
        hmacSecret: secret,
      },
      telemetry: telemetrySvc,
      datasets: datasetSvc,
      evaluations: evalSvc,
      artifacts: artSvc,
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    targetBaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    try {
      await walClient.flush();
      expect(walClient.getMetrics().exportedCount).toBe(1);
      expect(telemetrySvc.listForTenant(auth)).toHaveLength(1);

      // M4-04: Evaluation & Experiment
      const evalRes = await fetch(`${targetBaseUrl}/v1/evaluations/rules`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "run_m4_1",
          httpStatus: 200,
          outputText: "",
          citations: [],
          expectedCitations: ["doc_1"],
          toolCalls: [],
        }),
      });
      expect(evalRes.status).toBe(201);
      const evalBody = (await evalRes.json()) as { scores: { overall: number } };
      expect(evalBody.scores.overall).toBeLessThan(0.5);

      expSvc.register(auth, {
        experimentId: "exp_m4",
        experimentType: "offline_benchmark",
        baselineVersion: "pmt_v1",
        candidateVersion: "pmt_v2",
        randomizationUnit: "case_id",
        allocationRatio: 0.5,
        sampleSizeTarget: 1600,
        minimumDetectableEffect: 0.05,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
        primaryMetric: "correctness",
        guardrailMetrics: ["latency_p95"],
        stoppingRule: "guardrail_breach",
        multipleComparisonPolicy: "holm_bonferroni",
      });
      const expOutcome = expSvc.evaluateOutcome(auth, {
        experimentId: "exp_m4",
        sampleSizeActual: 1700,
        observedEffect: 0.09,
        rawPValues: [0.005],
        guardrailBreached: false,
      });
      expect(expOutcome.conclusion).toBe("win");

      // M4-05 & M4-06: Signed Artifact + OpenBot Governance State Machine (Approval -> Canary -> Revoke -> Rollback)
      artSvc.createSignedArtifact(
        auth,
        {
          artifactId: "art_m4_1",
          artifactType: "prompt_template",
          artifactVersion: "2.0.0",
          schemaVersion: "1.0.0",
          targetScope: { agentIds: ["sandbox-bot"], minOpenBotVersion: "2026.11.0", maxOpenBotVersion: "2026.12.0" },
          sourceExperimentId: "exp_m4",
          evaluationReportRef: "eval_rep_m4",
          datasetVersion: "ds_m4@v1",
          createdAt: "2026-11-27T00:00:00Z",
          issuedAt: "2026-11-27T00:00:00Z",
          expiresAt: "2026-12-27T00:00:00Z",
          rollbackTargetArtifactId: "art_m4_0",
          keyId: "m4-key-1",
          issuer: "ai-optimization-sandbox",
          approvalPolicy: "human_required",
          monotonicEpoch: 1,
          payload: { systemPromptAppend: "Verify citations before answering." },
        },
        privPem,
      );

      const bundleRes = await fetch(`${targetBaseUrl}/v1/artifacts/art_m4_1/bundle`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(bundleRes.status).toBe(200);
      const bundle = (await bundleRes.json()) as OptimizationArtifact;

      // OpenBot verifies and deploys Canary
      expect(
        artSvc.verifyForOpenBot(bundle, {
          expectedTenantId: "tenant_sandbox",
          targetAgentId: "sandbox-bot",
          openBotVersion: "2026.11.5",
          lastAppliedEpoch: 0,
          hasHumanApproval: true,
          nowIso: "2026-11-28T00:00:00Z",
        }),
      ).toEqual({ valid: true });

      // OpenBot reports deployment.completed back to AI Optimization
      walClient.enqueue({
        schemaVersion: "1.0.0",
        eventId: "evt_deploy_m4_1",
        idempotencyKey: "deploy_m4_1:canary",
        eventType: "deployment.completed",
        occurredAt: "2026-11-27T00:05:00Z",
        tenantId: "tenant_sandbox",
        source: { system: "openbot", component: "evolution-control" },
        traceContext: { traceId: "tr_dep_1", runId: "dep_1" },
        redaction: { applied: true, policy: "v1" },
        payload: { artifactId: "art_m4_1", deploymentStatus: "CANARY" },
      });
      await walClient.flush();

      // AI Optimization revokes artifact -> OpenBot sees 410 revoked and executes rollback
      const revokeRes = await fetch(`${targetBaseUrl}/v1/artifacts/art_m4_1/revocations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(revokeRes.status).toBe(200);

      const bundleAfterRevoke = await fetch(`${targetBaseUrl}/v1/artifacts/art_m4_1/bundle`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(bundleAfterRevoke.status).toBe(410);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      db.close();
    }
  });
});
