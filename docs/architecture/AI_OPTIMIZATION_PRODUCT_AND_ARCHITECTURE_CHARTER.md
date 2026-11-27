# AI Optimization 产品定义与总体技术架构设计任务书

- **文档版本**：`V1.1`（修订与 Phase 1 实施启动版）
- **文档状态**：正式架构冻结基线（基于 OpenBot Commit `25b6613e6` 源码审计，及 `ai-optimization` 基线 `e154beacfa177ea8005eb29d655c96af36253a2e` / `8751ab8455674de0663d8f9cd74106205265ca6f`）
- **唯一维护主本（Master）**：`https://github.com/flykingvip-cloud/ai-optimization` → `docs/architecture/AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md`
- **OpenBot 归档副本（Archival Mirror）**：`docs/architecture/ai-optimization-audit/15_AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md`（仅作架构追溯镜像，不作为第二个维护主本）

---

## 一、产品定位、目标用户与边界定义

### 1.1 产品定位
**AI Optimization** 是独立于 OpenBot 的 **AI 评测、实验、优化与学习平台（Evaluation & Learning Plane）**。
- **OpenBot（Runtime & Governance Plane）**：负责 Agent Runtime、Gateway、Session、Identity、Tool/Workflow 执行、Model Provider 调用与故障 Fallback、Auth Profile/Cooldown/Retry、Doctor/Diagnosis、TaskOutcome 权威账本、OTel 观测采集、Evolution Control（生产审批、Canary、Promotion、Rollback）及 Optimization Artifact 消费执行。OpenBot 必须保持不依赖 AI Optimization 也能够正常运行。
- **AI Optimization（Evaluation & Learning Plane）**：负责 Telemetry Ingestion、Dataset/Golden Dataset、Expert Feedback、Evaluation Engine（Rule + LLM-as-a-Judge）、Benchmark、Evaluation Report、Experiment Engine、Prompt/Model Routing/Agent & Tool Policy Optimization、Bandit、Optimization Artifact Registry 及后续 SFT/DPO/Reward Model/RLVR 训练编排。

### 1.2 目标用户与核心场景
- **AI 评测与质量工程师**：沉淀线上脱敏运行数据为版本化 Golden Dataset，构建 Rule + LLM-as-a-Judge 评测体系与回归测试。
- **Prompt 与 Agent 策略工程师**：对 System Prompt、模型路由与工具策略开展随机对照实验，产出带统计证明的优化制品。
- **模型与平台架构师**：管理质量/成本/延迟多目标路由策略及后续训练资产。
- **企业管理员与审批者**：审阅带完整溯源与验证报告的 ReleaseRequest，在 OpenBot 侧审批、灰度放量与回滚。

### 1.3 非目标范围（Non-Goals）
- 不替代 OpenBot 运行时；不直接修改 OpenBot 生产策略或执行生产部署/回滚。
- 不复制第二套 `TaskOutcome` 权威运行结果账本。
- Phase 1 不建设大规模 SFT / DPO / RL 训练基础设施。

---

## 二、不可修改的总体架构原则与权威数据源

### 2.1 五项架构原则
1. **OpenBot 保留生产运行时权威**：AI Optimization 不直接访问或修改生产 Agent 内部状态、生产 Prompt、Model Router 或 Tool Policy。
2. **AI Optimization 拥有评测和优化权威**：Dataset、EvaluationResult、ExperimentRun、OptimizationArtifact 由 AI Optimization 统一管理。
3. **TaskOutcome 是运行结果权威账本**：AI Optimization 仅保存经授权的 Telemetry 消费副本，不定义第二套运行结果权威账本。
4. **优化制品必须可追溯、可验真**：每个 Artifact 必须关联源数据、评测版本、实验配置、指标、签名、有效期、撤销状态及回滚目标。
5. **训练能力后置**：Phase 1 先完成 Evaluation、Dataset、Feedback、Experiment 与 Artifact 体系，验证评测可信度后再推进 SFT/DPO/RLVR。

### 2.2 权威数据源矩阵
| 数据对象 | 权威系统 |
|---|---|
| 用户、组织、身份与权限 | OpenBot / 上游身份系统 |
| Agent Runtime 与 Session | OpenBot |
| TaskOutcome、Runtime Trace 与原始运行事件 | OpenBot |
| Telemetry 消费副本 | AI Optimization |
| Dataset / DatasetVersion / EvaluationResult / ExperimentRun / OptimizationArtifact | AI Optimization |
| 生产部署状态与生产回滚执行状态 | OpenBot |
| 优化建议及验证报告 | AI Optimization |

---

## 三、Artifact 发布与回滚职责（单状态机原则）

AI Optimization **不得维护第二套生产部署状态机**，也不承担生产回滚执行职责。

- **AI Optimization 职责与 API**：
  - 创建并签名 `OptimizationArtifact`：`POST /v1/artifacts`
  - 查询制品与拉取签名制品包：`GET /v1/artifacts/{artifactId}`、`GET /v1/artifacts/{artifactId}/bundle`
  - 创建发布建议请求：`POST /v1/artifacts/{artifactId}/release-requests`、`GET /v1/release-requests/{requestId}`
  - 发出制品撤销/失效通知：`POST /v1/artifacts/{artifactId}/revocations`
  - 消费 OpenBot 回报的 `deployment.completed` 与 `deployment.rollback.completed` 事件。
- **OpenBot 职责**：
  - Artifact 签名/兼容性/作用域/防重放校验 → `operator.approvals` 生产审批 → Canary 执行 → Promotion 执行 → Rollback 执行 → 维护生产部署状态并上报 `deployment.*` 事件。

---

## 四、Artifact 完整性与供应链信任模型（Artifact Integrity & Trust）

每个 `OptimizationArtifact` 必须包含以下完整字段：
`artifactId`, `artifactType`, `artifactVersion`, `schemaVersion`, `tenantId`, `targetScope`, `sourceExperimentId`, `evaluationReportRef`, `datasetVersion`, `createdAt`, `issuedAt`, `expiresAt`, `rollbackTargetArtifactId`, `contentHash`, `signature`, `signatureAlgorithm`, `keyId`, `issuer`, `approvalPolicy`, `revocationStatus`（以及防重放 `monotonicEpoch`）。

强制信任约束：
1. `contentHash` 使用 `SHA-256`（仅证明内容完整性，不等同于发布者身份认证）。
2. 数字签名（`Ed25519`）必须覆盖规范化（Canonical JSON）后的完整制品内容及关键元数据（含 `artifactId`、`artifactVersion`、`schemaVersion`、`tenantId`、`targetScope`、`issuedAt`、`expiresAt`、`monotonicEpoch`、`contentHash`）。
3. OpenBot 通过 `keyId` + 公钥信任链确认 `issuer` 发布者身份，支持多 Key 共存的密钥轮换。
4. 支持制品撤销检查（`revocationStatus`）、过期检测（`expiresAt`）及基于 `monotonicEpoch` 的防旧制品重放。
5. 支持目标 OpenBot 版本兼容性校验及 `tenantId` / `agentId` / 策略作用域校验。
6. 任何一项校验失败时，OpenBot **必须 Fail-Closed 拒绝应用**。

---

## 五、Tenant 与数据权限模型

核心归属关系：
- `Tenant → Dataset → DatasetVersion → DatasetCase`
- `Tenant → EvaluationJob → EvaluationResult`
- `Tenant → Experiment → ExperimentRun`
- `Tenant → OptimizationArtifact`

强制约束：
- 跨租户访问默认拒绝（Fail-closed）；服务端严禁仅信任客户端传入的 `tenantId`，必须从鉴权上下文校验。
- 永久身份主键使用不可变 Subject ID / Service Principal ID，**严禁使用 Email 作为永久身份主键**。
- 明确区分数据所有者、操作者、审批者与服务身份（职责分离 SoD）；Dataset 的导入、导出、分享、复制、删除与训练用途授权分别受独立权限控制；跨租户操作必须有显式授权与审计记录。

---

## 六、Dataset、Evaluation 与 Experiment 领域规范

### 6.1 Dataset 数据治理
- `DatasetVersion` 采用**不可变版本**原则；区分 `golden`、`evaluation`、`train_candidate`（`train_candidate` 默认禁止进入训练）。
- 每个 `DatasetCase` 至少包含：`caseId`, `datasetId`, `datasetVersion`, `contentHash`, `inputSnapshotRef`, `referenceAnswerRef`, `expectedToolTraceRef`, `labels`, `sourceRunId`, `sourceAuthorization`, `redactionStatus`, `reviewStatus`, `createdAt`。
- 必须具备：来源追溯、组织/用户授权校验、敏感信息检测与脱敏、删除与保留策略、Version Diff、数据污染检测、Golden Dataset 变更审批、训练集与评测集物理/逻辑隔离、访问审计。任何 `model_self_eval` 不得自动转为专家标注。

### 6.2 Evaluation 评测模型
- `EvaluationResult` 至少包含：`evaluationId`, `runId`, `datasetCaseId`, `evaluatorType`, `evaluatorVersion`, `judgeModelVersion`, `rubricVersion`, `scores`, `confidence`, `evidenceRefs`, `reasoningSummary`, `evaluationStatus`, `createdAt`。
- 严格区分四种评价来源：`expert_verified`、`automated_judge`、`user_explicit`、`model_self_eval`。
- 建立 Judge 可信度验证机制：与专家标注一致性（Kappa/相关性）、偏差与稳定性测试、Prompt Injection/评测投机测试、Judge 模型版本漂移检测、低置信度自动转人工复核。

### 6.3 Experiment 统计模型
- `ExperimentRun` 至少包含：`experimentId`, `tenantId`, `experimentType`, `baselineVersion`, `candidateVersion`, `randomizationUnit`, `allocationRatio`, `sampleSizeTarget`, `sampleSizeActual`, `minimumDetectableEffect`, `confidenceLevel`, `statisticalPower`, `primaryMetric`, `guardrailMetrics`, `stoppingRule`, `multipleComparisonPolicy`, `contaminationCheck`, `experimentStatus`, `conclusion`。
- 明确区分离线 Benchmark、固定 Dataset 对照评测、Shadow Experiment、Online A/B、Bandit Experiment；严禁将离线评测收益直接等同于线上收益，严禁仅凭单次 `pValue` 决定生产发布，必须综合质量、成本、延迟、安全与业务护栏。

---

## 七、Telemetry 可靠性与故障隔离规范

Telemetry 必须完全异步，不得成为 OpenBot Runtime 的同步依赖：
- **非阻塞与有界缓冲**：本地有界队列 + 有界 WAL 持久化缓冲（默认上限 `maxQueueItems = 10,000`、`maxDiskBytes = 64 MiB`、`retentionTtlMs = 24h`），失败采用指数退避重试。
- **故障隔离**：远端不可用、队列满、磁盘不可写或超时，**均不得阻塞或导致 Agent Run 失败**。
- **丢弃策略**：队列满时按分级策略丢弃普通低价值观测（`drop-oldest`），尽力保障 `TaskOutcome` 摘要送达（仍不阻塞主链路）；敏感原始内容严禁因重试或死信机制绕过脱敏。
- **幂等与可观测**：服务端基于 `(tenantId, idempotencyKey)` 幂等去重；本地暴露 `telemetry.queued_count`、`telemetry.dropped_count`、`telemetry.wal_bytes`、`telemetry.export_error_count` 指标与死信处理。

---

## 八、Phase 1 实施路线与 AOR 迁移门控

1. **M0（架构与契约冻结）**：冻结 OpenAPI、JSON Schema、事件目录与安全/信任规范。
2. **M1（Telemetry Ingestion & Dataset Management）**：实现幂等接收、脱敏、租户隔离、不可变数据集版本与污染检测。
3. **M2（Evaluation Engine & Benchmark）**：实现 Rule Evaluator、LLM-as-a-Judge、固定 Dataset 回归与报告。
4. **M3（Experiment & Optimization Artifact）**：实现实验统计校验与 Ed25519 签名制品及撤销机制。
5. **M4（跨系统联调验收）**：打通 OpenBot ↔ AI Optimization 全链路并验证故障隔离与签名验签。
6. **AOR 迁移前置评估**：本阶段仅输出 `docs/architecture/AOR_MIGRATION_ASSESSMENT.md` 评估报告，未获架构负责人批准前严禁删除 OpenBot 中任何 AOR 源码。
