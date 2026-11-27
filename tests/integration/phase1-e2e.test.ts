import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AuthContext, DatasetCase, TelemetryEvent } from "../../packages/shared-contracts/src/index.js";
import { BoundedTelemetryClient } from "../../packages/telemetry-sdk/src/index.js";
import { ArtifactRegistryService } from "../../services/artifact-registry/src/index.js";
import { DatasetGovernanceError, DatasetManagementService } from "../../services/dataset-management/src/index.js";
import { EvaluationEngineService } from "../../services/evaluation-engine/src/index.js";
import { TelemetryIngestionService } from "../../services/telemetry-ingestion/src/index.js";

const TENANT_A: AuthContext = { subjectId: "subj_a", tenantId: "tenant_a", roles: ["operator"] };
const TENANT_B: AuthContext = { subjectId: "subj_b", tenantId: "tenant_b", roles: ["operator"] };

describe("Phase 1 Core Platform Verification", () => {
  it("isolates OpenBot runtime when Telemetry transport fails and bounds queue", async () => {
    const client = new BoundedTelemetryClient({
      maxQueueItems: 2,
      transport: {
        async send() {
          throw new Error("remote_unavailable");
        },
      },
    });
    const baseEvt = (i: number): TelemetryEvent => ({
      schemaVersion: "1.0.0",
      eventId: `evt_${i}`,
      idempotencyKey: `idem_${i}`,
      eventType: "runtime.run.completed",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_a",
      source: { system: "openbot", component: "agent-runner" },
      traceContext: { traceId: "tr_1", runId: `run_${i}` },
      redaction: { applied: false, policy: "v1" },
      payload: { note: "token=sk-1234567890abcdef" },
    });

    client.enqueue(baseEvt(1));
    client.enqueue(baseEvt(2));
    client.enqueue(baseEvt(3));
    await expect(client.flush()).resolves.toBeUndefined();

    const metrics = client.getMetrics();
    expect(metrics.droppedCount).toBe(1);
    expect(metrics.exportErrorCount).toBe(1);
    expect(metrics.queuedCount).toBe(2);
  });

  it("enforces idempotent ingestion, redaction, and tenant isolation", () => {
    const svc = new TelemetryIngestionService();
    const evt: TelemetryEvent = {
      schemaVersion: "1.0.0",
      eventId: "evt_1",
      idempotencyKey: "run_1:done",
      eventType: "runtime.task_outcome.recorded",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_a",
      source: { system: "openbot", component: "task-outcome" },
      traceContext: { traceId: "tr_1", runId: "run_1" },
      redaction: { applied: true, policy: "v1" },
      payload: { judgement: "success" },
    };

    expect(svc.ingest(TENANT_A, evt)).toEqual({ status: "accepted", duplicate: false });
    expect(svc.ingest(TENANT_A, evt)).toEqual({ status: "accepted", duplicate: true });
    expect(svc.ingest(TENANT_B, evt)).toEqual({ status: "rejected", code: "tenant_mismatch" });
    expect(svc.listForTenant(TENANT_A)).toHaveLength(1);
    expect(svc.listForTenant(TENANT_B)).toHaveLength(0);
  });

  it("enforces Dataset immutability and blocks train_candidate contamination", () => {
    const ds = new DatasetManagementService();
    const goldenCase: DatasetCase = {
      caseId: "c1",
      datasetId: "ds_1",
      datasetVersion: "v1",
      tenantId: "tenant_a",
      split: "golden",
      contentHash: "a".repeat(64),
      inputSnapshotRef: "snap://1",
      labels: { domain: "support" },
      sourceAuthorization: { authorized: true, policyRef: "pol_1", subjectId: "subj_a" },
      redactionStatus: "redacted",
      reviewStatus: "approved",
      createdAt: "2026-11-27T00:00:00Z",
    };

    ds.publishVersion(TENANT_A, { datasetId: "ds_1", version: "v1", split: "golden", cases: [goldenCase] });
    expect(() =>
      ds.publishVersion(TENANT_A, { datasetId: "ds_1", version: "v1", split: "golden", cases: [goldenCase] }),
    ).toThrow(DatasetGovernanceError);

    expect(() =>
      ds.publishVersion(TENANT_A, {
        datasetId: "ds_train",
        version: "v1",
        split: "train_candidate",
        cases: [{ ...goldenCase, datasetId: "ds_train", split: "train_candidate" }],
      }),
    ).toThrow(/overlaps with golden/);
  });

  it("detects HTTP 200 low-quality outputs and routes low-confidence Judge results to human review", async () => {
    const evalSvc = new EvaluationEngineService();
    const badHttp200 = evalSvc.evaluateByRules(TENANT_A, {
      runId: "run_bad",
      httpStatus: 200,
      outputText: "   ",
      citations: [],
      expectedCitations: ["doc_1"],
      toolCalls: [{ name: "search", ok: false }],
    });
    expect(badHttp200.scores.overall).toBe(0);
    expect(badHttp200.evidenceRefs).toContain("empty_output_despite_http_200");

    const lowConfJudge = await evalSvc.evaluateByJudge(
      TENANT_A,
      { runId: "run_ambiguous", httpStatus: 200, outputText: "maybe", citations: [], toolCalls: [] },
      {
        judgeModelVersion: "gemini-judge-v1",
        async evaluate() {
          return {
            correctness: 0.5,
            completeness: 0.5,
            confidence: 0.4,
            reasoningSummary: "ambiguous answer",
            evidenceRefs: ["trace://run_ambiguous"],
          };
        },
      },
    );
    expect(lowConfJudge.evaluationStatus).toBe("needs_human_review");
    expect(lowConfJudge.judgeModelVersion).toBe("gemini-judge-v1");
  });

  it("verifies Ed25519 artifact signature, revocation, expiration, and anti-replay", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

    const registry = new ArtifactRegistryService();
    registry.registerTrustedKey("key-2026-11", pubPem);

    const artifact = registry.createSignedArtifact(
      TENANT_A,
      {
        artifactId: "art_1",
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
        rollbackTargetArtifactId: null,
        keyId: "key-2026-11",
        issuer: "ai-optimization-prod",
        approvalPolicy: "human_required",
        monotonicEpoch: 5,
        payload: { systemPromptAppend: "Always cite sources." },
      },
      privPem,
    );

    expect(
      registry.verifyForOpenBot(artifact, {
        expectedTenantId: "tenant_a",
        openBotVersion: "2026.11.1",
        lastAppliedEpoch: 4,
        nowIso: "2026-11-28T00:00:00Z",
      }),
    ).toEqual({ valid: true });

    expect(
      registry.verifyForOpenBot(artifact, {
        expectedTenantId: "tenant_a",
        openBotVersion: "2026.11.1",
        lastAppliedEpoch: 5,
        nowIso: "2026-11-28T00:00:00Z",
      }),
    ).toEqual({ valid: false, reason: "replay_detected" });

    expect(
      registry.verifyForOpenBot(artifact, {
        expectedTenantId: "tenant_a",
        openBotVersion: "2026.11.1",
        lastAppliedEpoch: 4,
        nowIso: "2027-01-01T00:00:00Z",
      }),
    ).toEqual({ valid: false, reason: "expired" });

    registry.revokeArtifact(TENANT_A, "art_1");
    expect(
      registry.verifyForOpenBot(artifact, {
        expectedTenantId: "tenant_a",
        openBotVersion: "2026.11.1",
        lastAppliedEpoch: 4,
        nowIso: "2026-11-28T00:00:00Z",
      }),
    ).toEqual({ valid: false, reason: "revoked" });
  });
});
