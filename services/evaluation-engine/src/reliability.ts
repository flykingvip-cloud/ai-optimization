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

function bucketHistogram(scores: readonly number[], bins = 5): number[] {
  const counts = new Array<number>(bins).fill(0);
  for (const s of scores) {
    const clamped = Math.max(0, Math.min(0.9999, s));
    const idx = Math.floor(clamped * bins);
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  const total = Math.max(1, scores.length);
  return counts.map((c) => Math.max(0.0001, c / total));
}

/**
 * Computes Population Stability Index (PSI) + mean/std shift for Judge drift detection.
 * PSI >= 0.25 indicates significant distribution drift even if the mean stays unchanged.
 */
export function detectJudgeDrift(
  baselineScores: readonly number[],
  currentScores: readonly number[],
  thresholds: { readonly maxMeanShift?: number; readonly maxPsi?: number } = {},
): { readonly drifted: boolean; readonly meanShift: number; readonly psi: number } {
  if (baselineScores.length === 0 || currentScores.length === 0) {
    return { drifted: false, meanShift: 0, psi: 0 };
  }
  const avg = (arr: readonly number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const meanShift = Number(Math.abs(avg(currentScores) - avg(baselineScores)).toFixed(4));

  const pBase = bucketHistogram(baselineScores);
  const pCurr = bucketHistogram(currentScores);
  let psi = 0;
  for (let i = 0; i < pBase.length; i += 1) {
    const b = pBase[i]!;
    const c = pCurr[i]!;
    psi += (c - b) * Math.log(c / b);
  }
  const roundedPsi = Number(psi.toFixed(4));
  const drifted =
    meanShift > (thresholds.maxMeanShift ?? 0.15) || roundedPsi >= (thresholds.maxPsi ?? 0.25);
  return { drifted, meanShift, psi: roundedPsi };
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
