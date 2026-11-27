import { createHash } from "node:crypto";
import type { AuthContext } from "../../../packages/shared-contracts/src/index.js";

export type ExperimentType = "offline_benchmark" | "fixed_dataset_eval" | "shadow" | "online_ab" | "bandit";

export interface ExperimentDefinition {
  readonly experimentId: string;
  readonly tenantId: string;
  readonly experimentType: ExperimentType;
  readonly baselineVersion: string;
  readonly candidateVersion: string;
  readonly randomizationUnit: "case_id" | "run_id" | "session_id" | "tenant_id";
  readonly allocationRatio: number;
  readonly sampleSizeTarget: number;
  readonly minimumDetectableEffect: number;
  readonly confidenceLevel: number;
  readonly statisticalPower: number;
  readonly primaryMetric: string;
  readonly guardrailMetrics: readonly string[];
  readonly stoppingRule: string;
  readonly multipleComparisonPolicy: "none" | "bonferroni" | "holm_bonferroni" | "fdr_bh";
}

export interface ExperimentEvaluationOutcome {
  readonly experimentId: string;
  readonly sampleSizeActual: number;
  readonly conclusion: "win" | "loss" | "inconclusive" | "pending";
  readonly stoppedEarly: boolean;
  readonly adjustedPValues: readonly number[];
  readonly reason: string;
}

export function assignDeterministicVariant(
  experimentId: string,
  unitValue: string,
  allocationRatio: number,
): "baseline" | "candidate" {
  const digest = createHash("sha256").update(`${experimentId}::${unitValue}`).digest();
  const bucket = digest.readUInt32BE(0) / 0xffffffff;
  return bucket < allocationRatio ? "candidate" : "baseline";
}

export function holmBonferroniAdjust(rawPValues: readonly number[]): number[] {
  const indexed = rawPValues.map((p, idx) => ({ p, idx })).toSorted((a, b) => a.p - b.p);
  const m = indexed.length;
  const adjusted = new Array<number>(m);
  let runningMax = 0;
  for (let i = 0; i < m; i += 1) {
    const item = indexed[i]!;
    const adj = Math.min(1, item.p * (m - i));
    runningMax = Math.max(runningMax, adj);
    adjusted[item.idx] = Number(runningMax.toFixed(6));
  }
  return adjusted;
}

export class ExperimentEngineService {
  private readonly definitions = new Map<string, ExperimentDefinition>();

  register(auth: AuthContext, def: Omit<ExperimentDefinition, "tenantId">): ExperimentDefinition {
    const record: ExperimentDefinition = { ...def, tenantId: auth.tenantId };
    this.definitions.set(record.experimentId, record);
    return record;
  }

  evaluateOutcome(
    auth: AuthContext,
    params: {
      readonly experimentId: string;
      readonly sampleSizeActual: number;
      readonly observedEffect: number;
      readonly rawPValues: readonly number[];
      readonly guardrailBreached: boolean;
    },
  ): ExperimentEvaluationOutcome {
    const def = this.definitions.get(params.experimentId);
    if (!def || def.tenantId !== auth.tenantId) {
      throw new Error("Experiment not found for tenant");
    }

    const adjustedPValues =
      def.multipleComparisonPolicy === "holm_bonferroni"
        ? holmBonferroniAdjust(params.rawPValues)
        : [...params.rawPValues];

    if (params.guardrailBreached) {
      return {
        experimentId: def.experimentId,
        sampleSizeActual: params.sampleSizeActual,
        conclusion: "loss",
        stoppedEarly: true,
        adjustedPValues,
        reason: "guardrail_breach_early_stop",
      };
    }

    if (params.sampleSizeActual < def.sampleSizeTarget) {
      return {
        experimentId: def.experimentId,
        sampleSizeActual: params.sampleSizeActual,
        conclusion: "inconclusive",
        stoppedEarly: false,
        adjustedPValues,
        reason: "insufficient_sample_size",
      };
    }

    const alpha = 1 - def.confidenceLevel;
    const primaryP = adjustedPValues[0] ?? 1;
    if (primaryP < alpha && params.observedEffect >= def.minimumDetectableEffect) {
      return {
        experimentId: def.experimentId,
        sampleSizeActual: params.sampleSizeActual,
        conclusion: "win",
        stoppedEarly: false,
        adjustedPValues,
        reason: "significant_improvement_above_mde",
      };
    }

    return {
      experimentId: def.experimentId,
      sampleSizeActual: params.sampleSizeActual,
      conclusion: "inconclusive",
      stoppedEarly: false,
      adjustedPValues,
      reason: "did_not_meet_alpha_or_mde",
    };
  }
}
