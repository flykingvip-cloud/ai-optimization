import { createHmac, generateKeyPairSync } from "node:crypto";
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

type ProposalStatus =
  | "DISCOVERED"
  | "SUGGESTED"
  | "PENDING_AUTHORITY"
  | "APPROVED_FOR_EXPERIMENT"
  | "EXPERIMENTING"
  | "APPROVED_FOR_APPLICATION"
  | "CANARY"
  | "VERIFIED"
  | "PROMOTED"
  | "ROLLED_BACK";

/**
 * Loads OpenBot's real `transitionEvolutionProposal` when running in the dual-repo
 * local workspace, or uses the identical frozen state-machine transition table in CI.
 */
async function loadOpenBotTransitionFn(): Promise<
  (from: ProposalStatus, command: string) => { ok: true; next: ProposalStatus } | { ok: false; code: string }
> {
  const localOpenBotPath = path.resolve(
    import.meta.dirname,
    "../../../openbot/packages/evolution-core/src/state-machine.ts",
  );
  if (fs.existsSync(localOpenBotPath)) {
    const mod = (await import(localOpenBotPath)) as {
      transitionEvolutionProposal: (
        from: ProposalStatus,
        command: string,
      ) => { ok: true; next: ProposalStatus } | { ok: false; code: string };
    };
    return mod.transitionEvolutionProposal;
  }
  const TABLE: Record<string, ProposalStatus> = {
    "DISCOVERED:suggest": "SUGGESTED",
    "SUGGESTED:submit": "PENDING_AUTHORITY",
    "PENDING_AUTHORITY:authorize": "APPROVED_FOR_EXPERIMENT",
    "APPROVED_FOR_EXPERIMENT:start_experiment": "EXPERIMENTING",
    "EXPERIMENTING:approve_application": "APPROVED_FOR_APPLICATION",
    "APPROVED_FOR_APPLICATION:apply_canary": "CANARY",
    "CANARY:verify": "VERIFIED",
    "CANARY:rollback": "ROLLED_BACK",
    "VERIFIED:promote": "PROMOTED",
    "ROLLED_BACK:rollback": "ROLLED_BACK",
  };
  return (from, command) => {
    if (from === "ROLLED_BACK" && command !== "rollback") {
      return { ok: false, code: "terminal" };
    }
    const next = TABLE[`${from}:${command}`];
    return next ? { ok: true, next } : { ok: false, code: "illegal_transition" };
  };
}

describe("M4-03~06 OpenBot × AI Optimization Sandbox Full E2E (with Crash Recovery, Dataset HTTP & State Machine)", () => {
  it("verifies WAL process crash recovery, Dataset HTTP governance, Evaluation, Experiment, Artifact & OpenBot state machine Canary/Rollback", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m4-sandbox-full-"));
    const walPath = path.join(tmpDir, "openbot.wal.jsonl");
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
    artSvc.registerTrustedKey("m4-key-1", publicKey.export({ type: "spki", format: "pem" }).toString());
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

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

    // M4-03 Part 1: Client A writes WAL while server is down, then crashes (discarded)
    const clientA = new BoundedTelemetryClient({
      walFilePath: walPath,
      transport: {
        async send() {
          throw new Error("server_down");
        },
      },
    });
    const runEvt: TelemetryEvent = {
      schemaVersion: "1.0.0",
      eventId: "evt_m4_crash_1",
      idempotencyKey: "run_m4_crash_1:done",
      eventType: "runtime.run.completed",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_sandbox",
      source: { system: "openbot", component: "sandbox-agent" },
      traceContext: { traceId: "4bf92f3577b34da6a3ce929d0e0e4736", runId: "run_m4_crash_1", promptVersion: "pmt_v1" },
      redaction: { applied: true, policy: "v1" },
      payload: { status: "ok", latencyMs: 120 },
    };
    clientA.enqueue(runEvt);
    await clientA.flush();
    // Simulate crash mid-write with corrupt trailing line
    fs.appendFileSync(walPath, '{"corrupt_partial_crash":', "utf8");

    // Start AI Optimization HTTP Server
    const server = createOptimizationHttpServer({
      jwtConfig: { expectedIssuer: "https://auth.openbot.love", expectedAudience: "ai-optimization", hmacSecret: secret },
      telemetry: telemetrySvc,
      datasets: datasetSvc,
      evaluations: evalSvc,
      artifacts: artSvc,
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    try {
      // M4-03 Part 2: Client B restarts from same WAL path and flushes to live server
      const sendBatch = async (batch: readonly TelemetryEvent[]) => {
        for (const evt of batch) {
          const res = await fetch(`${baseUrl}/v1/telemetry/events`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(evt),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }
      };
      const clientB = new BoundedTelemetryClient({ walFilePath: walPath, transport: { send: sendBatch } });
      await clientB.flush();
      expect(clientB.getMetrics().exportedCount).toBe(1);
      expect(telemetrySvc.listForTenant(auth)).toHaveLength(1);

      // Duplicate delivery must be idempotent
      const dupRes = await fetch(`${baseUrl}/v1/telemetry/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(runEvt),
      });
      expect(dupRes.status).toBe(202);
      expect(await dupRes.json()).toEqual({ status: "accepted", duplicate: true });
      expect(telemetrySvc.listForTenant(auth)).toHaveLength(1);

      // M4-04 Part 1: Dataset HTTP Governance (publish, immutable 409, unauthorized 400, PII 400, cross-tenant 403)
      const goldenCase: DatasetCase = {
        caseId: "c_m4_1",
        datasetId: "ds_m4",
        datasetVersion: "v1",
        tenantId: "tenant_sandbox",
        split: "golden",
        contentHash: "d".repeat(64),
        inputSnapshotRef: "snap://m4/1",
        labels: { topic: "finance" },
        sourceAuthorization: { authorized: true, policyRef: "pol_m4", subjectId: "svc_openbot" },
        redactionStatus: "redacted",
        reviewStatus: "approved",
        createdAt: "2026-11-27T00:00:00Z",
      };
      const dsOk = await fetch(`${baseUrl}/v1/datasets/ds_m4`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: "ds_m4", version: "v1", split: "golden", cases: [goldenCase] }),
      });
      expect(dsOk.status).toBe(201);

      const dsImmutable = await fetch(`${baseUrl}/v1/datasets/ds_m4`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: "ds_m4", version: "v1", split: "golden", cases: [goldenCase] }),
      });
      expect(dsImmutable.status).toBe(409);

      const dsPii = await fetch(`${baseUrl}/v1/datasets/ds_m4`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: "ds_m4",
          version: "v2",
          split: "golden",
          cases: [{ ...goldenCase, caseId: "c_pii", datasetVersion: "v2", inputSnapshotRef: "sk-1234567890abcdef" }],
        }),
      });
      expect(dsPii.status).toBe(400);

      const dsCrossTenant = await fetch(`${baseUrl}/v1/datasets/ds_m4`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: "ds_m4",
          version: "v3",
          split: "golden",
          cases: [{ ...goldenCase, tenantId: "other_tenant" }],
        }),
      });
      expect(dsCrossTenant.status).toBe(403);

      // M4-04 Part 2: Evaluation & Experiment
      const evalRes = await fetch(`${baseUrl}/v1/evaluations/rules`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "run_m4_crash_1",
          datasetCaseId: "c_m4_1",
          httpStatus: 200,
          outputText: "",
          citations: [],
          expectedCitations: ["doc_1"],
          toolCalls: [],
        }),
      });
      expect(evalRes.status).toBe(201);

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
      expect(
        expSvc.evaluateOutcome(auth, {
          experimentId: "exp_m4",
          sampleSizeActual: 1700,
          observedEffect: 0.09,
          rawPValues: [0.005],
          guardrailBreached: false,
        }).conclusion,
      ).toBe("win");

      // M4-05 & M4-06: Artifact + Real OpenBot State Machine Execution (Canary -> Revoke -> Rollback)
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
          payload: { systemPromptAppend: "Verify citations." },
        },
        privPem,
      );

      const bundle = (await (
        await fetch(`${baseUrl}/v1/artifacts/art_m4_1/bundle`, { headers: { Authorization: `Bearer ${token}` } })
      ).json()) as OptimizationArtifact;

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

      const transition = await loadOpenBotTransitionFn();
      let state: ProposalStatus = "APPROVED_FOR_APPLICATION";
      const canaryStep = transition(state, "apply_canary");
      expect(canaryStep).toEqual({ ok: true, next: "CANARY" });
      if (canaryStep.ok) state = canaryStep.next;

      // AI Optimization revokes artifact
      expect(
        (
          await fetch(`${baseUrl}/v1/artifacts/art_m4_1/revocations`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status,
      ).toBe(200);
      // Repeated revocation is safe
      expect(
        (
          await fetch(`${baseUrl}/v1/artifacts/art_m4_1/revocations`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status,
      ).toBe(200);

      // OpenBot detects 410 revoked and executes state machine rollback to rollbackTargetArtifactId
      const bundleAfterRevoke = await fetch(`${baseUrl}/v1/artifacts/art_m4_1/bundle`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(bundleAfterRevoke.status).toBe(410);

      const rollbackStep = transition(state, "rollback");
      expect(rollbackStep).toEqual({ ok: true, next: "ROLLED_BACK" });
      if (rollbackStep.ok) state = rollbackStep.next;

      // Terminal ROLLED_BACK cannot promote or activate
      expect(transition(state, "promote").ok).toBe(false);

      clientB.enqueue({
        schemaVersion: "1.0.0",
        eventId: "evt_rollback_m4_1",
        idempotencyKey: "deploy_m4_1:rollback",
        eventType: "deployment.rollback.completed",
        occurredAt: "2026-11-27T00:10:00Z",
        tenantId: "tenant_sandbox",
        source: { system: "openbot", component: "evolution-control" },
        traceContext: { traceId: "tr_dep_rb", runId: "dep_rb_1" },
        redaction: { applied: true, policy: "v1" },
        payload: { artifactId: bundle.rollbackTargetArtifactId, deploymentStatus: state },
      });
      await clientB.flush();
      expect(telemetrySvc.listForTenant(auth).some((e) => e.eventType === "deployment.rollback.completed")).toBe(true);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      db.close();
    }
  });
});
