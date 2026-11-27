import type { EvaluationResult } from "../../../packages/shared-contracts/src/index.js";

/**
 * Computes binary Cohen's Kappa between automated judge decisions and human expert labels.
 */
export function computeCohensKappa(
  pairs: readonly { readonly judgePass: boolean; readonly expertPass: boolean }[],
): number {
  if (pairs.length === 0) return 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const p of pairs) {
    if (p.judgePass && p.expertPass) tp += 1;
    else if (p.judgePass && !p.expertPass) fp += 1;
    else if (!p.judgePass && p.expertPass) fn += 1;
    else tn += 1;
  }
  const n = pairs.length;
  const po = (tp + tn) / n;
  const pJudgeYes = (tp + fp) / n;
  const pExpertYes = (tp + fn) / n;
  const pe = pJudgeYes * pExpertYes + (1 - pJudgeYes) * (1 - pExpertYes);
  if (pe >= 1) return 1;
  return Number(((po - pe) / (1 - pe)).toFixed(4));
}

export function detectJudgeDrift(
  baselineScores: readonly number[],
  currentScores: readonly number[],
  maxMeanShift = 0.15,
): { readonly drifted: boolean; readonly meanShift: number } {
  if (baselineScores.length === 0 || currentScores.length === 0) {
    return { drifted: false, meanShift: 0 };
  }
  const avg = (arr: readonly number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const meanShift = Number(Math.abs(avg(currentScores) - avg(baselineScores)).toFixed(4));
  return { drifted: meanShift > maxMeanShift, meanShift };
}

export function applyExpertOverride(
  original: EvaluationResult,
  expertScore: number,
  expertReason: string,
): EvaluationResult {
  return {
    ...original,
    sourceCategory: "expert_verified",
    scores: { ...original.scores, overall: expertScore },
    confidence: 1,
    reasoningSummary: `expert_override: ${expertReason}`,
    evaluationStatus: "overridden",
  };
}
