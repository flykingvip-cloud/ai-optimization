import { randomUUID } from "node:crypto";
import type { OptimizationDatabase } from "../../../packages/shared-contracts/src/db.js";
import type { AuthContext, EvaluationResult } from "../../../packages/shared-contracts/src/index.js";

export interface EvalTargetInput {
  readonly runId?: string;
  readonly datasetCaseId?: string;
  readonly httpStatus: number;
  readonly outputText: string;
  readonly citations: readonly string[];
  readonly expectedCitations?: readonly string[];
  readonly toolCalls: readonly { readonly name: string; readonly ok: boolean }[];
}

export interface JudgeModelPort {
  readonly judgeModelVersion: string;
  evaluate(input: EvalTargetInput): Promise<{
    readonly correctness: number;
    readonly completeness: number;
    readonly confidence: number;
    readonly reasoningSummary: string;
    readonly evidenceRefs: readonly string[];
  }>;
}

export class EvaluationEngineService {
  private readonly results: EvaluationResult[] = [];
  private readonly db: OptimizationDatabase | undefined;

  constructor(db?: OptimizationDatabase) {
    this.db = db;
  }

  private persist(record: EvaluationResult): void {
    if (this.db) {
      this.db.db
        .prepare(
          "INSERT INTO evaluation_results (evaluation_id, tenant_id, run_id, dataset_case_id, source_category, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          record.evaluationId,
          record.tenantId,
          record.runId ?? null,
          record.datasetCaseId ?? null,
          record.sourceCategory,
          JSON.stringify(record),
          record.createdAt,
        );
    } else {
      this.results.push(record);
    }
  }

  evaluateByRules(
    auth: AuthContext,
    input: EvalTargetInput,
    rubricVersion = "rule-rubric-1.0.0",
  ): EvaluationResult {
    const nonEmpty = input.outputText.trim().length > 0 ? 1 : 0;
    const toolsOk =
      input.toolCalls.length === 0
        ? 1
        : input.toolCalls.filter((t) => t.ok).length / input.toolCalls.length;
    const citationAccuracy =
      input.expectedCitations && input.expectedCitations.length > 0
        ? input.expectedCitations.filter((c) => input.citations.includes(c)).length /
          input.expectedCitations.length
        : 1;

    const overall = Number((nonEmpty * 0.4 + toolsOk * 0.3 + citationAccuracy * 0.3).toFixed(4));
    const reasons: string[] = [];
    if (nonEmpty === 0) reasons.push("empty_output_despite_http_200");
    if (toolsOk < 1) reasons.push("tool_call_failures");
    if (citationAccuracy < 1) reasons.push("citation_mismatch");

    const record: EvaluationResult = {
      evaluationId: `eval_${randomUUID()}`,
      tenantId: auth.tenantId,
      runId: input.runId ?? null,
      datasetCaseId: input.datasetCaseId ?? null,
      evaluatorType: "rule",
      evaluatorVersion: "1.0.0",
      judgeModelVersion: null,
      rubricVersion,
      sourceCategory: "automated_judge",
      scores: {
        overall,
        correctness: nonEmpty,
        citationAccuracy,
        toolQuality: toolsOk,
      },
      confidence: 1,
      evidenceRefs: reasons,
      reasoningSummary: reasons.length > 0 ? reasons.join("; ") : "all_rules_passed",
      evaluationStatus: "completed",
      createdAt: new Date().toISOString(),
    };
    this.persist(record);
    return record;
  }

  async evaluateByJudge(
    auth: AuthContext,
    input: EvalTargetInput,
    judge: JudgeModelPort,
    rubricVersion = "judge-rubric-1.0.0",
    lowConfidenceThreshold = 0.7,
  ): Promise<EvaluationResult> {
    const out = await judge.evaluate(input);
    const overall = Number((out.correctness * 0.6 + out.completeness * 0.4).toFixed(4));
    const needsReview = out.confidence < lowConfidenceThreshold;
    const record: EvaluationResult = {
      evaluationId: `eval_${randomUUID()}`,
      tenantId: auth.tenantId,
      runId: input.runId ?? null,
      datasetCaseId: input.datasetCaseId ?? null,
      evaluatorType: "llm_judge",
      evaluatorVersion: "1.0.0",
      judgeModelVersion: judge.judgeModelVersion,
      rubricVersion,
      sourceCategory: "automated_judge",
      scores: {
        overall,
        correctness: out.correctness,
        completeness: out.completeness,
      },
      confidence: out.confidence,
      evidenceRefs: out.evidenceRefs,
      reasoningSummary: out.reasoningSummary,
      evaluationStatus: needsReview ? "needs_human_review" : "completed",
      createdAt: new Date().toISOString(),
    };
    this.persist(record);
    return record;
  }

  listForTenant(auth: AuthContext): readonly EvaluationResult[] {
    if (this.db) {
      const rows = this.db.db
        .prepare("SELECT result_json FROM evaluation_results WHERE tenant_id = ?")
        .all(auth.tenantId) as Array<{ result_json: string }>;
      return rows.map((r) => JSON.parse(r.result_json) as EvaluationResult);
    }
    return this.results.filter((r) => r.tenantId === auth.tenantId);
  }
}
