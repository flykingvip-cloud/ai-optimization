export type TelemetryEventType =
  | "runtime.run.started"
  | "runtime.run.completed"
  | "runtime.run.failed"
  | "runtime.model.called"
  | "runtime.tool.called"
  | "runtime.task_outcome.recorded"
  | "runtime.feedback.recorded"
  | "evaluation.completed"
  | "experiment.completed"
  | "artifact.created"
  | "artifact.revoked"
  | "deployment.completed"
  | "deployment.rollback.completed";

export interface AuthContext {
  readonly subjectId: string;
  readonly tenantId: string;
  readonly roles: readonly ("owner" | "operator" | "approver" | "service")[];
}

export interface TelemetryEvent {
  readonly schemaVersion: "1.0.0";
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly eventType: TelemetryEventType;
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly source: {
    readonly system: "openbot" | "ai-optimization";
    readonly component: string;
  };
  readonly traceContext: {
    readonly traceId: string;
    readonly runId: string;
    readonly spanId?: string;
    readonly parentSpanId?: string;
    readonly taskId?: string;
    readonly sessionId?: string;
    readonly agentId?: string;
    readonly agentVersion?: string;
    readonly promptVersion?: string;
    readonly toolPolicyVersion?: string;
    readonly experimentId?: string;
  };
  readonly redaction: {
    readonly applied: boolean;
    readonly policy: string;
    readonly piiStripped?: boolean;
  };
  readonly payload: Record<string, unknown>;
}

export type DatasetSplit = "golden" | "evaluation" | "train_candidate";

export interface DatasetCase {
  readonly caseId: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly tenantId: string;
  readonly split: DatasetSplit;
  readonly contentHash: string;
  readonly inputSnapshotRef: string;
  readonly referenceAnswerRef?: string | null;
  readonly expectedToolTraceRef?: string | null;
  readonly labels: Record<string, string>;
  readonly sourceRunId?: string | null;
  readonly sourceAuthorization: {
    readonly authorized: boolean;
    readonly policyRef: string;
    readonly subjectId: string;
    readonly allowTrainingUse?: boolean;
  };
  readonly redactionStatus: "redacted" | "clean" | "pending_review";
  readonly reviewStatus: "pending" | "approved" | "rejected";
  readonly createdAt: string;
}

export type EvaluationSourceCategory =
  | "expert_verified"
  | "automated_judge"
  | "user_explicit"
  | "model_self_eval";

export interface EvaluationResult {
  readonly evaluationId: string;
  readonly tenantId: string;
  readonly runId?: string | null;
  readonly datasetCaseId?: string | null;
  readonly evaluatorType: "rule" | "llm_judge" | "human_expert";
  readonly evaluatorVersion: string;
  readonly judgeModelVersion?: string | null;
  readonly rubricVersion: string;
  readonly sourceCategory: EvaluationSourceCategory;
  readonly scores: {
    readonly overall: number;
    readonly correctness?: number;
    readonly completeness?: number;
    readonly citationAccuracy?: number;
    readonly toolQuality?: number;
    readonly safety?: number;
  };
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
  readonly reasoningSummary: string;
  readonly evaluationStatus: "completed" | "needs_human_review" | "disputed" | "overridden" | "failed";
  readonly createdAt: string;
}

export interface OptimizationArtifact {
  readonly artifactId: string;
  readonly artifactType: "prompt_template" | "model_routing_policy" | "agent_policy" | "tool_strategy";
  readonly artifactVersion: string;
  readonly schemaVersion: "1.0.0";
  readonly tenantId: string;
  readonly targetScope: {
    readonly agentIds: readonly string[];
    readonly minOpenBotVersion: string;
    readonly maxOpenBotVersion?: string;
  };
  readonly sourceExperimentId: string;
  readonly evaluationReportRef: string;
  readonly datasetVersion: string;
  readonly createdAt: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly rollbackTargetArtifactId: string | null;
  readonly contentHash: string;
  readonly signature: string;
  readonly signatureAlgorithm: "Ed25519";
  readonly keyId: string;
  readonly issuer: string;
  readonly approvalPolicy: "human_required" | "policy_gate";
  readonly revocationStatus: "active" | "revoked";
  readonly monotonicEpoch: number;
  readonly payload: Record<string, unknown>;
}
