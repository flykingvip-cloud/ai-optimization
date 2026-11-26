# AI Optimization 产品定义与总体技术架构设计任务书

- **文档版本**：`v2.0.0`（P0 架构审阅修订版）
- **文档状态**：待冻结基准（基于 OpenBot Commit `25b6613e6` 源码级专项审计及首轮架构审阅意见修订）
- **唯一维护主本（Master）**：`https://github.com/flykingvip-cloud/ai-optimization` → `docs/architecture/AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md`
- **OpenBot 归档副本（Archival Mirror）**：`docs/architecture/ai-optimization-audit/15_AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md`（仅作架构追溯镜像，不作为第二个维护主本；当前位于 OpenBot 本地审计分支工作区，尚未合入 `openbot-vp/main`）
- **本地主本路径**：`/Users/daniel/AI VP/ai-optimization/docs/architecture/AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md`

---

## 一、产品定位、目标用户与边界定义

### 1.1 产品定位
**AI Optimization** 是一个**独立的 AI 评测、实验、优化与学习平台**，而非 OpenBot 的内置自我进化扩展。  
在双平面架构中：
- **OpenBot（Runtime & Governance Plane）**：负责“如何安全执行与治理变更”——承载 Agent Runtime、Gateway、Tool/Workflow 执行、Model Fallback、Auth Cooldown、运维诊断（Doctor / Diagnosis v1）、任务终态权威（`TaskOutcome`）、OTel 观测采集以及生产发布治理（`evolution-control`：审批、Canary、Rollback、Promotion）。
- **AI Optimization（Evaluation & Learning Plane）**：负责“为什么需要变更、变更什么、如何证明变更有效”——承载 Telemetry 消费、Golden Dataset、专家反馈、LLM-as-a-Judge 评测引擎、Benchmark、实验平台（A/B / Shadow）、Prompt/Routing/Policy 优化器、Artifact Registry，以及后续阶段的 SFT / DPO / RLVR 训练编排。

### 1.2 目标用户与核心场景
| 目标用户 | 核心使用场景 |
|---|---|
| **AI 评测与质量工程师** | 沉淀线上失败/低分/人工接管案例为版本化 Golden Dataset；配置 LLM-as-a-Judge 与规则探针；运行回归评测、置信度校准与漂移检测。 |
| **Prompt 与 Agent 策略工程师** | 对 System Prompt、模型路由策略、Agent 执行策略与工具策略发起随机对照实验；基于统计功效检验与评测集证明收益并生成签名优化制品。 |
| **模型与平台架构师** | 评估不同模型在各任务类型上的质量/成本/延迟帕累托前沿；管理质量驱动路由策略与后续微调/偏好训练资产。 |
| **企业管理员 / 审批者** | 审阅带完整溯源与回归对比报告的优化制品（`OptimizationArtifact`），在 OpenBot 侧执行准入审批、灰度放量与生产回滚。 |

### 1.3 明确的 Non-Goals（非目标范围）
1. **不替代 OpenBot 运行时**：不承载用户会话、Channel 接入、工具沙箱执行、Auth Profile 冷却或故障切换。
2. **不直接控制生产**：无权直接修改 OpenBot 生产 Prompt、模型路由表、Tool 白名单，**无权执行或触发 OpenBot 生产发布或生产回滚**，严禁绕过 `operator.approvals`。
3. **不复制第二套运行结果账本**：不重建 `TaskOutcome`，仅通过异步 Telemetry 消费结果事件。
4. **Phase 1 不启动重型训练**：在评测可信度与数据质量未验证前，不建设 SFT / DPO / PPO / GRPO / RLVR 训练集群。

---

## 二、五项不可动摇的架构原则

1. **OpenBot 保留生产运行时权威**：AI Optimization 不直接修改 OpenBot 的生产 Prompt、Model Router、Agent Policy 或 Tool Policy。
2. **AI Optimization 拥有评测和优化权威**：Golden Dataset、Evaluation Result、Experiment、Optimization Artifact 由 AI Optimization 统一管理。
3. **TaskOutcome 是运行结果权威账本**：不在 AI Optimization 中复制建设第二套运行结果账本，而是通过异步 Telemetry 接入必要数据。
4. **优化制品必须可追溯与可验真**：每个 `OptimizationArtifact` 必须具备非对称数字签名、源数据范围、评测集版本、实验配置、核心与护栏指标、适用范围、有效期、撤销状态及回滚目标。
5. **训练能力后置**：Phase 1 先建 Evaluation、Dataset、Feedback、Experiment 与 Prompt/Model Selection/Agent Policy/Tool Strategy 优化；待数据质量、评测可信度与优化收益得到验证后，再建设 SFT / DPO / RLVR。

---

## 三、双平面总体架构、职责划分与工程隔离约束

```text
+-----------------------------------------------------------------------------------+
| OpenBot — Runtime & Governance Plane                                              |
|  Agent Runtime · Gateway · Tool/Workflow · Model Fallback · Auth Cooldown         |
|  Doctor / Diagnosis v1 · TaskOutcome (Sole Authority) · OTel                      |
|  Evolution Control (Sole Production State Machine: Approval / Canary / Rollback)  |
+-----------------------------------------+-----------------------------------------+
                                          |
          1. 异步脱敏 Telemetry (Run / Model / Tool / TaskOutcome / Feedback / DeployStatus)
          2. 评测请求与结果查询 (Evaluation API)
          3. 签名 OptimizationArtifact 拉取、撤销通知与建议接收 (Artifact & Recommendation API)
                                          v
+-----------------------------------------+-----------------------------------------+
| AI Optimization — Evaluation & Learning Plane                                     |
|  Phase 1: Telemetry Ingest · Dataset & Feedback · Evaluation Engine (Judge+Rules) |
|           Benchmark · Experiment Engine · Prompt/Policy Optimizer · Bandit ·      |
|           Artifact Registry & Release/Rollback Recommendation                     |
|  Phase 2+: Online A/B & Shadow · Auto Prompt Search · Quality-Driven Bandit       |
|  Phase 3+: Preference Dataset · SFT · DPO · Reward Model · RLVR                   |
+-----------------------------------------------------------------------------------+
```

### 3.1 生产发布与回滚职责单归属（严禁双状态机）
- **AI Optimization 职责**：生成经过实验验证的签名 `OptimizationArtifact`、发布建议（Release Recommendation）、回滚建议（Rollback Recommendation）及制品撤销通知（Artifact Revocation Notice）。
- **OpenBot 职责**：作为**唯一生产发布状态机持有者**，负责接收/拉取候选制品、验签与兼容性校验、人工/策略审批（`operator.approvals`）、执行生产 Canary/Promotion、执行生产 Rollback，并将最终部署状态（`deployment.status_reported`）异步回传给 AI Optimization。

### 3.2 Telemetry 故障隔离的可测试工程约束
OpenBot 与 AI Optimization 之间必须满足以下可验证工程约束，不得使用未定义的模糊承诺：
1. **主链路零同步阻塞**：Telemetry 外发不得成为 OpenBot 的同步运行时依赖；Agent 主执行链路不得 `await` 远端 AI Optimization 响应。
2. **有界 WAL 队列与降级策略**：本地 WAL 队列必须配置明确上限（默认建议：`maxQueueItems = 10,000`、`maxDiskBytes = 64 MiB`、`retentionTtlMs = 24h`）；远端不可达时自动进入本地有界缓冲，队列满时按 `drop-oldest` 策略丢弃并记录丢弃计数。
3. **故障绝不波及执行**：队列满、磁盘不可写、序列化异常或网络超时，**均不得导致 Agent Run 失败或中断**。
4. **幂等与乱序容忍**：每条事件携带 `(tenantId, idempotencyKey)` 与单调序列/时间戳；支持幂等重试、重复事件识别及乱序到达重组。
5. **租户授权与脱敏**：支持租户级 `allowPayloadExport` 授权开关；出站前执行 Secret/PII 脱敏。
6. **本地可观测与告警**：OpenBot 必须暴露外发失败本地指标与告警（`telemetry.queued_count`、`telemetry.dropped_count`、`telemetry.wal_bytes`、`telemetry.export_error_count`）。

---

## 四、核心领域模型与约束规范

### 4.1 统一关联字段（Correlation Context）
- `tenantId`、`traceId`、`spanId`、`parentSpanId`
- `taskId`、`runId`、`sessionId`、`agentId`、`agentVersion`
- `modelProvider`、`modelId`、`modelVersion`
- `promptVersion`、`toolPolicyVersion`、`experimentId`、`datasetCaseId`、`evaluationId`

### 4.2 五大核心领域对象约束

| 领域对象 | 核心字段 | 必须满足的工程与安全约束 |
|---|---|---|
| **Dataset / DatasetVersion** | `datasetId`, `tenantId`, `version`, `split` (`"golden" \| "eval" \| "train_candidate"`), `contentHash`, `sourceProvenance`, `retentionPolicy`, `cases[]` | **1. 来源与授权**：记录源 `runId`/人工导入来源及租户导出授权；<br>**2. 脱敏**：入库前强制 PII/Secret 脱敏与标注；<br>**3. 不可变性**：已发布 `DatasetVersion` 不可变（`contentHash` 锁定），仅允许追加新版本；<br>**4. 隔离与保留**：严格隔离 `golden`/`eval` 与训练样本防污染，支持租户级 GDPR 删除与 TTL 保留策略。 |
| **EvaluationJob / EvaluationResult** | `evaluationId`, `runId` / `datasetCaseId`, `evaluatorType` (`"rule" \| "llm_judge" \| "human_expert"`), `rubricVersion`, `judgeModelVersion`, `scores`, `evidenceRefs[]`, `calibratedConfidence`, `reviewStatus` | **1. 量表与版本**：强制绑定 `rubricVersion` 与 `judgeModelVersion`（含 Judge Prompt Hash）；<br>**2. 证据链**：每个评分必须附带推理依据与轨迹片段引用；<br>**3. 校准与复核**：区分 `expert_verified`、`automated_judge`、`user_explicit` 与 `model_self_eval`，支持人工抽样校准（Kappa）及争议仲裁/覆写（Dispute Override）。 |
| **ExperimentRun** | `experimentId`, `tenantId`, `baselineArtifactId`, `candidateArtifactId`, `datasetVersion`, `randomizationUnit`, `targetSampleSize`, `alpha`, `power`, `correctionMethod`, `stoppingRule`, `conclusion` | **1. 随机分流**：明确按 `runId` / `sessionId` / `datasetCaseId` 确定性哈希分流；<br>**2. 统计严谨性**：预计算最小样本量与统计功效（Power >= 0.8），多指标/多候选比较必须启用多重比较校正（如 Holm-Bonferroni / FDR）；<br>**3. 停止与防污染**：定义明确早停规则（护栏恶化立即熔断）及跨实验串扰/残留（Carryover）隔离。 |
| **OptimizationArtifact**（供应链信任模型） | `artifactId`, `artifactType`, `artifactVersion`, `schemaVersion`, `payload`, `signatureAlg` (`"Ed25519"`), `keyId`, `signature`, `sha256`, `targetCompatibility`, `targetScope`, `effectiveAt`, `expiresAt`, `revocationStatus`, `rollbackTargetArtifactId`, `monotonicEpoch` | **1. 非对称签名**：`sha256` 仅校验完整性；必须使用 `Ed25519` + `keyId` 对规范化后的完整元数据与 `payload`（含 `artifactId`、`artifactVersion`、`schemaVersion`、`targetScope`、`effectiveAt`、`expiresAt`、`monotonicEpoch`）签名，支持密钥轮换与宽限期；<br>**2. 兼容性与作用域**：明确目标 OpenBot 最低/最高版本、所需能力集、租户与 Agent 范围；<br>**3. 时效与撤销**：校验 `effectiveAt`/`expiresAt` 与撤销列表（CRL/状态查询）；<br>**4. 防重放**：OpenBot 本地持久化已生效制品的 `monotonicEpoch`，拒绝同作用域旧 Epoch 制品重放。 |
| **Tenant & Security Policy** | `tenantId`, `isolationMode`, `allowPayloadExport`, `allowCrossTenantBenchmark`, `rbacPolicy` | **1. 租户隔离**：存储、评测、实验与制品全链路按 `tenantId` 强隔离；<br>**2. 跨租户限制**：默认禁止跨租户评测与数据复用（Fail-closed）；<br>**3. 权限边界**：明确 AI Optimization 平台管理员、评测员与 OpenBot 生产审批者的职责分离（SoD）。 |

---

## 五、与 OpenBot 的集成接口与职责边界

### 5.1 OpenBot 侧最小前置适配（不破坏现有架构）
1. **OTel 上下文传播补齐**：在 `extensions/diagnostics-otel/src/service.ts` 补齐 W3C `traceparent` 父子 Span 树，补充 `tool.loop` 事件导出。
2. **版本与反馈关联修复**：在 `src/executor-evidence/model-call-evidence.ts` 注入 `promptVersion`、`modelVersion`、`toolPolicyVersion`、`experimentId`；将 `src/gateway/collaboration-learning/collaboration-satisfaction.ts` 的满意度反馈强制绑定 `runId`。
3. **有界 WAL 异步脱敏 Telemetry 外发器**：实现 §3.2 定义的工程隔离外发通道。
4. **Artifact 验签消费与状态回报适配器**：复用 `packages/evolution-core` 与 `src/gateway/evolution-control/` 执行验签、兼容性校验、防重放检查、审批、Canary、Rollback，并异步回报部署结果。

### 5.2 接口契约边界（修订后）
- **Telemetry Ingestion（OpenBot → AI Optimization）**：
  - `POST /v1/telemetry/events`：接收运行事件、模型/工具调用、`TaskOutcome`、`UserFeedback` 及 `deployment.status_reported`。
- **Evaluation API（双向）**：
  - `POST /v1/evaluations/jobs`、`POST /v1/evaluations/runs`、`GET /v1/evaluations/{id}`、`GET /v1/evaluations/regressions`。
- **Artifact & Recommendation API（AI Optimization 产研 → OpenBot 消费/治理）**：
  - `POST /v1/artifacts/candidates`（AI Optimization 内部注册候选制品）；
  - `POST /v1/recommendations/releases`（向 OpenBot 推送/供 OpenBot 拉取**发布建议**，由 OpenBot 决定是否进入 `operator.approvals`）；
  - `GET /v1/artifacts/{id}/bundle`（OpenBot 拉取带签名制品包及撤销状态）；
  - `POST /v1/recommendations/rollbacks` & `POST /v1/artifacts/{id}/revoke`（AI Optimization 发出**回滚建议**或**制品撤销通知**，**不直接执行 OpenBot 生产回滚**；OpenBot 接收后按本地治理策略审批/执行回滚）。

---

## 六、AOR 迁移方案与七项前置门槛

- **候选迁移清单**：`packages/aor-core`、`packages/aor-sdk-node`、`packages/aor-sdk-python`、`packages/aor-backend-openbot`、`packages/aor-backend-graph`、`packages/aor-backend-stub`。
- **迁移方式**：在满足全部前置门槛后，使用 `git subtree split` / `git filter-repo` 保留完整 Git 提交历史迁入 `flykingvip-cloud/ai-optimization`。
- **迁移七项强制前置门槛（Exit Gates，未全部通过前严禁启动迁移）**：
  1. **源码与依赖盘点完成**：逐包区分“评测/优化能力”与“运行时适配/生产治理能力”，禁止按命名整包盲目迁移；
  2. **职责与重复能力明确**：确认与新建 Evaluation/Experiment 模块的归并关系；
  3. **唯一维护仓库确认**：冻结迁移后代码的唯一写入归属为 `ai-optimization`，OpenBot 侧禁止继续提交重复实现；
  4. **OpenBot 过渡期兼容接口明确**：保证 `src/gateway/model-entitlement/employee-model-gate.ts` 在过渡期接口不破坏；
  5. **双仓库独立构建与测试通过**：两仓各自通过 Typecheck、Lint 与全量单测；
  6. **迁移前后 API 与行为兼容验证**：回归对比迁移前后的选路与探针输出一致；
  7. **Git 历史保留验证**：验证迁出后提交历史、作者与关键里程碑 SHA 完整可追溯。

---

## 七、分阶段实施顺序与冻结门槛

| 优先级 | 阶段 / 工作项 | 验收交付与冻结门槛 |
|---|---|---|
| **P0** | 修订并冻结本任务书（领域模型约束、API 职责、Artifact 信任模型、租户安全边界、双平面发布/回滚边界） | 主本与归档副本版本号及 SHA-256 完全一致，双平面负责人签字冻结 |
| **P1** | 建立 OpenAPI 3.1 / JSON Schema 事件与 API 契约（`contracts/`） | 双方团队可基于契约独立并行开发与 Mock 联调 |
| **P1** | 建立 `ai-optimization` 独立工程底座（测试、CI、Lint、依赖管理、包结构） | 空工程 CI 全绿，可独立构建与发布 |
| **P1** | 完成 AOR 七项前置迁移评估 | 输出《AOR 源码盘点与迁移评估报告》，明确迁移范围与时间点 |
| **P2** | 启动 Phase 1 核心服务（Telemetry Ingest、Golden Dataset、Evaluation Engine、Experiment Engine、Artifact Registry） | 端到端闭环：OpenBot 脱敏 Telemetry → 评测检出低质量 Case → 实验验证 → 签名制品 → OpenBot 灰度/回滚联调通过 |

---

## 八、双本一致性与版本控制规范

1. **单一维护主本**：`flykingvip-cloud/ai-optimization` 中的 `docs/architecture/AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md` 为唯一维护主本。
2. **归档镜像同步**：OpenBot 仓库中的 `docs/architecture/ai-optimization-audit/15_AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md` 仅为架构审计追溯副本；每次主本变更必须同步更新该副本，并核验两者内容与 `SHA-256` 完全一致。
3. **版本校验文件**：`ai-optimization` 仓库同步维护 `docs/architecture/CHARTER_CHECKSUM.sha256` 供自动化与人工核验。
