# Domain Model (`ai-optimization`)

## 1. 租户与权限归属树
- `Tenant → Dataset → DatasetVersion → DatasetCase`
- `Tenant → EvaluationJob → EvaluationResult`
- `Tenant → Experiment → ExperimentRun`
- `Tenant → OptimizationArtifact → ReleaseRequest`

所有实体强制携带 `tenantId`（来自服务端鉴权上下文，严禁仅信任请求体 `tenantId`）。永久主体标识使用不可变 `subjectId` / `servicePrincipalId`，严禁使用 Email 作为永久主键。

## 2. 核心领域对象
1. **Dataset & DatasetVersion**：`datasetId`, `tenantId`, `version`, `split` (`golden | evaluation | train_candidate`), `contentHash` (`sha256`), `immutable: true`, `retentionPolicy`, `sourceAuthorization`。
2. **DatasetCase**：`caseId`, `datasetId`, `datasetVersion`, `contentHash`, `inputSnapshotRef`, `referenceAnswerRef`, `expectedToolTraceRef`, `labels`, `sourceRunId`, `sourceAuthorization`, `redactionStatus`, `reviewStatus`, `createdAt`。
3. **EvaluationResult**：`evaluationId`, `runId`, `datasetCaseId`, `evaluatorType` (`rule | llm_judge | human_expert`), `evaluatorVersion`, `judgeModelVersion`, `rubricVersion`, `scores`, `confidence`, `evidenceRefs`, `reasoningSummary`, `evaluationStatus`, `sourceCategory` (`expert_verified | automated_judge | user_explicit | model_self_eval`), `createdAt`。
4. **ExperimentRun**：`experimentId`, `tenantId`, `experimentType` (`offline_benchmark | fixed_dataset_eval | shadow | online_ab | bandit`), `baselineVersion`, `candidateVersion`, `randomizationUnit`, `allocationRatio`, `sampleSizeTarget`, `sampleSizeActual`, `minimumDetectableEffect`, `confidenceLevel`, `statisticalPower`, `primaryMetric`, `guardrailMetrics`, `stoppingRule`, `multipleComparisonPolicy`, `contaminationCheck`, `experimentStatus`, `conclusion`。
5. **OptimizationArtifact**：`artifactId`, `artifactType`, `artifactVersion`, `schemaVersion`, `tenantId`, `targetScope`, `sourceExperimentId`, `evaluationReportRef`, `datasetVersion`, `createdAt`, `issuedAt`, `expiresAt`, `rollbackTargetArtifactId`, `contentHash`, `signature`, `signatureAlgorithm`, `keyId`, `issuer`, `approvalPolicy`, `revocationStatus`, `monotonicEpoch`。
