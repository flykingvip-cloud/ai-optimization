import { describe, expect, it } from "vitest";
import type { AuthContext } from "../../packages/shared-contracts/src/index.js";
import { EvaluationEngineService } from "../../services/evaluation-engine/src/index.js";
import { applyExpertOverride, computeCohensKappa, detectJudgeDrift } from "../../services/evaluation-engine/src/reliability.js";
import {
  assignDeterministicVariant,
  ExperimentEngineService,
  holmBonferroniAdjust,
} from "../../services/experiment-engine/src/index.js";

const AUTH: AuthContext = { subjectId: "u1", tenantId: "tenant_a", roles: ["operator"] };

describe("P1-05/06 Experiment Engine & Judge Reliability", () => {
  it("P1-05 enforces deterministic splitting, sample-size gate, Holm-Bonferroni, and guardrail early stop", () => {
    const v1 = assignDeterministicVariant("exp_1", "run_42", 0.5);
    const v2 = assignDeterministicVariant("exp_1", "run_42", 0.5);
    expect(v1).toBe(v2);

    expect(holmBonferroniAdjust([0.01, 0.04, 0.03])).toEqual([0.03, 0.06, 0.06]);

    const svc = new ExperimentEngineService();
    svc.register(AUTH, {
      experimentId: "exp_1",
      experimentType: "online_ab",
      baselineVersion: "v1",
      candidateVersion: "v2",
      randomizationUnit: "run_id",
      allocationRatio: 0.5,
      sampleSizeTarget: 100,
      minimumDetectableEffect: 0.05,
      confidenceLevel: 0.95,
      statisticalPower: 0.8,
      primaryMetric: "correctness",
      guardrailMetrics: ["latency_p95"],
      stoppingRule: "guardrail_breach",
      multipleComparisonPolicy: "holm_bonferroni",
    });

    const underpowered = svc.evaluateOutcome(AUTH, {
      experimentId: "exp_1",
      sampleSizeActual: 20,
      observedEffect: 0.2,
      rawPValues: [0.001],
      guardrailBreached: false,
    });
    expect(underpowered.conclusion).toBe("inconclusive");

    const breached = svc.evaluateOutcome(AUTH, {
      experimentId: "exp_1",
      sampleSizeActual: 50,
      observedEffect: 0.2,
      rawPValues: [0.001],
      guardrailBreached: true,
    });
    expect(breached.stoppedEarly).toBe(true);
    expect(breached.conclusion).toBe("loss");

    const win = svc.evaluateOutcome(AUTH, {
      experimentId: "exp_1",
      sampleSizeActual: 120,
      observedEffect: 0.08,
      rawPValues: [0.01, 0.2],
      guardrailBreached: false,
    });
    expect(win.conclusion).toBe("win");
  });

  it("P1-06 computes Cohen's Kappa, detects Judge drift, and isolates expert override from model self-eval", async () => {
    const kappa = computeCohensKappa([
      { judgePass: true, expertPass: true },
      { judgePass: true, expertPass: true },
      { judgePass: false, expertPass: false },
      { judgePass: true, expertPass: false },
    ]);
    expect(kappa).toBeCloseTo(0.5, 2);

    expect(detectJudgeDrift([0.8, 0.82, 0.78], [0.5, 0.52, 0.48]).drifted).toBe(true);
    expect(detectJudgeDrift([0.8, 0.82, 0.78], [0.81, 0.79, 0.8]).drifted).toBe(false);

    const evalSvc = new EvaluationEngineService();
    const res = await evalSvc.evaluateByJudge(
      AUTH,
      { runId: "r1", httpStatus: 200, outputText: "ok", citations: [], toolCalls: [] },
      {
        judgeModelVersion: "judge-v1",
        async evaluate() {
          return {
            correctness: 0.4,
            completeness: 0.6,
            confidence: 0.5,
            reasoningSummary: "uncertain",
            evidenceRefs: ["trace://r1"],
          };
        },
      },
    );
    expect(res.sourceCategory).toBe("automated_judge");
    const overridden = applyExpertOverride(res, 0.9, "verified by domain expert");
    expect(overridden.sourceCategory).toBe("expert_verified");
    expect(overridden.evaluationStatus).toBe("overridden");
  });
});
