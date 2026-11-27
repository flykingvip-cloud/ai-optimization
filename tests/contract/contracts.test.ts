import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { ContractValidator } from "../../packages/shared-contracts/src/validator.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const validator = new ContractValidator(path.join(ROOT, "contracts/json-schema"));

describe("P0-01 Frozen Contracts & Ajv 2020-12 Validation", () => {
  it("validates valid TelemetryEvent and rejects missing/extra/invalid fields", () => {
    const validEvent = {
      schemaVersion: "1.0.0",
      eventId: "evt_1",
      idempotencyKey: "idem_1",
      eventType: "runtime.run.completed",
      occurredAt: "2026-11-27T00:00:00Z",
      tenantId: "tenant_a",
      source: { system: "openbot", component: "agent-runner" },
      traceContext: { traceId: "tr_1", runId: "run_1" },
      redaction: { applied: true, policy: "v1" },
      payload: {},
    };
    expect(validator.validate("telemetry-event", validEvent)).toEqual({ valid: true });

    const extraField = { ...validEvent, unexpectedField: "hack" };
    expect(validator.validate("telemetry-event", extraField).valid).toBe(false);

    const badEnum = { ...validEvent, eventType: "invalid.event" };
    expect(validator.validate("telemetry-event", badEnum).valid).toBe(false);
  });

  it("validates TaskOutcomeEvent schema positive and negative cases", () => {
    const valid = {
      schemaVersion: "1.0.0",
      eventId: "evt_to_1",
      idempotencyKey: "to_1",
      tenantId: "tenant_a",
      taskId: "task_1",
      runId: "run_1",
      outcomeVersion: 1,
      lifecycle: "closed",
      taskJudgement: "success",
      decidedAt: "2026-11-27T00:00:00Z",
    };
    expect(validator.validate("task-outcome-event", valid)).toEqual({ valid: true });
    expect(validator.validate("task-outcome-event", { ...valid, outcomeVersion: 0 }).valid).toBe(false);
  });

  it("validates DatasetCase, EvaluationResult, ExperimentRun, and OptimizationArtifact schemas", () => {
    expect(
      validator.validate("dataset-case", {
        caseId: "c1",
        datasetId: "ds_1",
        datasetVersion: "v1",
        tenantId: "tenant_a",
        split: "golden",
        contentHash: "a".repeat(64),
        inputSnapshotRef: "snap://1",
        labels: {},
        sourceAuthorization: { authorized: true, policyRef: "pol_1", subjectId: "subj_a" },
        redactionStatus: "redacted",
        reviewStatus: "approved",
        createdAt: "2026-11-27T00:00:00Z",
      }),
    ).toEqual({ valid: true });

    expect(
      validator.validate("evaluation-result", {
        evaluationId: "eval_1",
        tenantId: "tenant_a",
        evaluatorType: "llm_judge",
        evaluatorVersion: "1.0.0",
        judgeModelVersion: "gemini-judge-v1",
        rubricVersion: "rubric-v1",
        sourceCategory: "automated_judge",
        scores: { overall: 0.9 },
        confidence: 0.95,
        evidenceRefs: ["trace://1"],
        reasoningSummary: "accurate",
        evaluationStatus: "completed",
        createdAt: "2026-11-27T00:00:00Z",
      }),
    ).toEqual({ valid: true });

    expect(
      validator.validate("experiment-run", {
        experimentId: "exp_1",
        tenantId: "tenant_a",
        experimentType: "online_ab",
        baselineVersion: "v1",
        candidateVersion: "v2",
        randomizationUnit: "run_id",
        allocationRatio: 0.5,
        sampleSizeTarget: 100,
        sampleSizeActual: 100,
        minimumDetectableEffect: 0.05,
        confidenceLevel: 0.95,
        statisticalPower: 0.8,
        primaryMetric: "correctness",
        guardrailMetrics: ["latency_p95"],
        stoppingRule: "guardrail_breach",
        multipleComparisonPolicy: "holm_bonferroni",
        contaminationCheck: "passed",
        experimentStatus: "completed",
        conclusion: "win",
      }),
    ).toEqual({ valid: true });
  });

  it("parses and validates OpenAPI 3.1 YAML structure and dual-plane endpoints", () => {
    const raw = fs.readFileSync(path.join(ROOT, "contracts/openapi/ai-optimization-v1.yaml"), "utf8");
    const doc = yaml.load(raw) as {
      openapi?: string;
      info?: { title?: string; version?: string };
      paths?: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
      components?: { securitySchemes?: Record<string, unknown> };
    };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info?.version).toBe("1.0.0");
    expect(doc.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(doc.paths?.["/v1/artifacts/{artifactId}/release-requests"]?.post).toBeDefined();
    expect(doc.paths?.["/v1/artifacts/{artifactId}/revocations"]?.post).toBeDefined();
    expect(doc.paths?.["/v1/artifacts/{artifactId}/rollback"]).toBeUndefined();
  });
});
