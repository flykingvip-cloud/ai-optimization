import { createHash } from "node:crypto";
import type { OptimizationDatabase } from "../../../packages/shared-contracts/src/db.js";
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
  readonly requiredSampleSize: number;
  readonly achievedPower: number;
  readonly conclusion: "win" | "loss" | "inconclusive" | "pending";
  readonly stoppedEarly: boolean;
  readonly adjustedPValues: readonly number[];
  readonly reason: string;
}

/** Standard normal inverse CDF approximation (Acklam). */
function normInv(p: number): number {
  if (p <= 0.5) return -normInv(1 - p);
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;
  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

/** Standard normal CDF approximation (Abramowitz & Stegun). */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

export function computeRequiredSampleSizePerArm(
  mde: number,
  confidenceLevel: number,
  power: number,
  baselineVariance = 0.25,
): number {
  const alpha = 1 - confidenceLevel;
  const zAlpha = normInv(1 - alpha / 2);
  const zBeta = normInv(power);
  const n = Math.ceil((2 * baselineVariance * (zAlpha + zBeta) ** 2) / Math.max(1e-9, mde * mde));
  return Math.max(1, n);
}

export function computeAchievedPower(
  sampleSizeActual: number,
  mde: number,
  confidenceLevel: number,
  baselineVariance = 0.25,
): number {
  const alpha = 1 - confidenceLevel;
  const zAlpha = normInv(1 - alpha / 2);
  const se = Math.sqrt((2 * baselineVariance) / Math.max(1, sampleSizeActual));
  const z = mde / se - zAlpha;
  return Number(Math.max(0, Math.min(1, normCdf(z))).toFixed(4));
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

export function adjustPValues(
  rawPValues: readonly number[],
  policy: ExperimentDefinition["multipleComparisonPolicy"],
): number[] {
  const m = rawPValues.length;
  if (m === 0 || policy === "none") return [...rawPValues];
  if (policy === "bonferroni") {
    return rawPValues.map((p) => Number(Math.min(1, p * m).toFixed(6)));
  }
  if (policy === "holm_bonferroni") {
    const indexed = rawPValues.map((p, idx) => ({ p, idx })).toSorted((a, b) => a.p - b.p);
    const adjusted = new Array<number>(m);
    let runningMax = 0;
    for (let i = 0; i < m; i += 1) {
      const item = indexed[i]!;
      runningMax = Math.max(runningMax, Math.min(1, item.p * (m - i)));
      adjusted[item.idx] = Number(runningMax.toFixed(6));
    }
    return adjusted;
  }
  // fdr_bh (Benjamini-Hochberg)
  const indexed = rawPValues.map((p, idx) => ({ p, idx })).toSorted((a, b) => a.p - b.p);
  const adjusted = new Array<number>(m);
  let runningMin = 1;
  for (let i = m - 1; i >= 0; i -= 1) {
    const item = indexed[i]!;
    runningMin = Math.min(runningMin, Math.min(1, (item.p * m) / (i + 1)));
    adjusted[item.idx] = Number(runningMin.toFixed(6));
  }
  return adjusted;
}

export function holmBonferroniAdjust(rawPValues: readonly number[]): number[] {
  return adjustPValues(rawPValues, "holm_bonferroni");
}

export class ExperimentEngineService {
  private readonly definitions = new Map<string, ExperimentDefinition>();
  private readonly db: OptimizationDatabase | undefined;

  constructor(db?: OptimizationDatabase) {
    this.db = db;
  }

  register(auth: AuthContext, def: Omit<ExperimentDefinition, "tenantId">): ExperimentDefinition {
    const record: ExperimentDefinition = { ...def, tenantId: auth.tenantId };
    if (this.db) {
      this.db.db
        .prepare(
          "INSERT OR REPLACE INTO experiment_runs (experiment_id, tenant_id, status, conclusion, run_json) VALUES (?, ?, ?, ?, ?)",
        )
        .run(record.experimentId, record.tenantId, "planned", "pending", JSON.stringify(record));
    } else {
      this.definitions.set(record.experimentId, record);
    }
    return record;
  }

  private getDefinition(auth: AuthContext, experimentId: string): ExperimentDefinition | null {
    if (this.db) {
      const row = this.db.db
        .prepare("SELECT run_json FROM experiment_runs WHERE experiment_id = ? AND tenant_id = ?")
        .get(experimentId, auth.tenantId) as { run_json: string } | undefined;
      return row ? (JSON.parse(row.run_json) as ExperimentDefinition) : null;
    }
    const found = this.definitions.get(experimentId);
    return found && found.tenantId === auth.tenantId ? found : null;
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
    const def = this.getDefinition(auth, params.experimentId);
    if (!def) {
      throw new Error("Experiment not found for tenant");
    }

    const requiredSampleSize = Math.max(
      def.sampleSizeTarget,
      computeRequiredSampleSizePerArm(def.minimumDetectableEffect, def.confidenceLevel, def.statisticalPower),
    );
    const achievedPower = computeAchievedPower(
      params.sampleSizeActual,
      def.minimumDetectableEffect,
      def.confidenceLevel,
    );
    const adjustedPValues = adjustPValues(params.rawPValues, def.multipleComparisonPolicy);

    if (params.guardrailBreached) {
      return {
        experimentId: def.experimentId,
        sampleSizeActual: params.sampleSizeActual,
        requiredSampleSize,
        achievedPower,
        conclusion: "loss",
        stoppedEarly: true,
        adjustedPValues,
        reason: "guardrail_breach_early_stop",
      };
    }

    if (params.sampleSizeActual < requiredSampleSize || achievedPower < def.statisticalPower) {
      return {
        experimentId: def.experimentId,
        sampleSizeActual: params.sampleSizeActual,
        requiredSampleSize,
        achievedPower,
        conclusion: "inconclusive",
        stoppedEarly: false,
        adjustedPValues,
        reason: "insufficient_sample_size_or_power",
      };
    }

    const alpha = 1 - def.confidenceLevel;
    const primaryP = adjustedPValues[0] ?? 1;
    if (primaryP < alpha && params.observedEffect >= def.minimumDetectableEffect) {
      return {
        experimentId: def.experimentId,
        sampleSizeActual: params.sampleSizeActual,
        requiredSampleSize,
        achievedPower,
        conclusion: "win",
        stoppedEarly: false,
        adjustedPValues,
        reason: "significant_improvement_above_mde",
      };
    }

    return {
      experimentId: def.experimentId,
      sampleSizeActual: params.sampleSizeActual,
      requiredSampleSize,
      achievedPower,
      conclusion: "inconclusive",
      stoppedEarly: false,
      adjustedPValues,
      reason: "did_not_meet_alpha_or_mde",
    };
  }
}
