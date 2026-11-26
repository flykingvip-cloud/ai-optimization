# AI Optimization 产品定义与总体技术架构设计任务书

**文档状态**：正式架构输入（基于 OpenBot Commit `25b6613e6` 源码级专项审计）  
**独立产品仓库**：`https://github.com/flykingvip-cloud/ai-optimization`  
**本地工程目录**：`/Users/daniel/AI VP/ai-optimization`（与 OpenBot 仓库平级独立）  
**上游执行平台**：OpenBot (`https://github.com/flykingvip-cloud/openbot-vp`)  

---

## 一、产品定位、目标用户与边界定义

### 1.1 产品定位
**AI Optimization** 是一个**独立的 AI 评测、实验、优化与学习平台**，而非 OpenBot 的内置自我进化插件。  
在双平面架构中：
- **OpenBot（Runtime & Governance Plane）**：负责“如何安全执行与治理”——承载 Agent Runtime、Gateway、Tool/Workflow 执行、Model Fallback、运维诊断（Doctor / Diagnosis v1）、任务终态权威（`TaskOutcome`）、OTel 观测采集以及生产发布执行器（`evolution-control`）。
- **AI Optimization（Evaluation & Learning Plane）**：负责“做得是否足够好、为什么不好、怎样改进、如何证明改进有效”——承载 Telemetry 消费、Golden Dataset、专家反馈、LLM-as-a-Judge 评测引擎、Benchmark、实验平台（A/B / Shadow）、Prompt / 路由 / 策略优化器、Artifact Registry，以及后续阶段的 SFT / DPO / RLVR 训练编排。

### 1.2 目标用户与核心场景
| 目标用户 | 核心使用场景 |
|---|---|
| **AI 评测与质量工程师** | 沉淀线上失败/低分/人工接管案例为版本化 Golden Dataset；配置 LLM-as-a-Judge 与规则探针；运行回归评测与漂移检测。 |
| **Prompt 与 Agent 策略工程师** | 对 System Prompt、模型路由策略、工具调用策略发起多候选实验；基于评测集与线上实验证明收益并申请受控发布。 |
| **模型与平台架构师** | 评估不同模型在各任务类型上的质量/成本/延迟帕累托前沿；管理质量驱动路由策略与后续微调/偏好训练资产。 |
| **企业管理员 / 审批者** | 审阅带完整溯源与回归对比报告的优化产物（`OptimizationArtifact`），在 OpenBot 侧执行准入审批、灰度放量与一键回滚。 |

### 1.3 明确的 Non-Goals（非目标范围）
1. **不替代 OpenBot 运行时**：不承载用户会话、Channel 接入、工具沙箱执行、Auth Profile 冷却或故障切换。
2. **不直接控制生产**：无权直接修改 OpenBot 生产 Prompt、模型路由表、Tool 白名单或绕过 `operator.approvals`。
3. **不复制第二套运行结果账本**：不重建 `TaskOutcome`，仅通过异步 Telemetry 消费结果事件。
4. **Phase 1 不启动重型训练**：在评测可信度与数据质量未验证前，不建设 SFT / DPO / PPO / GRPO / RLVR 训练集群。

---

## 二、五项不可动摇的架构原则

1. **OpenBot 保留生产运行时权威**：AI Optimization 不直接修改 OpenBot 的生产 Prompt、Model Router、Agent Policy 或 Tool Policy。
2. **AI Optimization 拥有评测和优化权威**：Golden Dataset、Evaluation Result、Experiment、Optimization Artifact 由 AI Optimization 统一管理。
3. **TaskOutcome 是运行结果权威账本**：不在 AI Optimization 中复制建设第二套运行结果账本，而是通过异步 Telemetry 接入必要数据。
4. **优化制品必须可追溯**：每个 `OptimizationArtifact` 必须关联源数据范围、评测集版本、实验配置、核心指标与护栏指标、审批记录、适用范围及回滚目标。
5. **训练能力后置**：Phase 1 先建 Evaluation、Dataset、Feedback、Experiment 与 Prompt/Routing/Policy Optimization；待数据质量、评测可信度与优化收益得到验证后，再建设 SFT / DPO / RLVR。

---

## 三、双平面总体架构与模块边界

```text
+-----------------------------------------------------------------------------------+
| OpenBot — Runtime & Governance Plane                                              |
|  Agent Runtime · Gateway · Tool/Workflow · Model Fallback · Auth Cooldown         |
|  Doctor / Diagnosis v1 · TaskOutcome (Sole Authority) · OTel · Evolution Control  |
+-----------------------------------------+-----------------------------------------+
                                          |
          1. 异步脱敏 Telemetry (Run / Model / Tool / TaskOutcome / Feedback)
          2. 评测请求与结果查询 (Evaluation API)
          3. 带签名 OptimizationArtifact 拉取、审批、灰度、回滚 (Artifact API)
                                          v
+-----------------------------------------+-----------------------------------------+
| AI Optimization — Evaluation & Learning Plane                                     |
|  Phase 1: Telemetry Ingest · Dataset & Feedback · Evaluation Engine (Judge+Rules) |
|           Benchmark · Experiment Engine · Prompt/Policy Optimizer · Bandit ·      |
|           Artifact Registry & Release Recommendation                              |
|  Phase 2+: Online A/B & Shadow · Auto Prompt Search · Quality-Driven Bandit       |
|  Phase 3+: Preference Dataset · SFT · DPO · Reward Model · RLVR                   |
+-----------------------------------------------------------------------------------+
```

### 核心闭环（不可逆安全流）
`OpenBot Runtime → 异步脱敏 Telemetry → AI Optimization Evaluation → Experiment → Optimization → Validated & Signed Artifact → OpenBot Governance (Approval + Canary + Rollback Drill) → Controlled Deployment → Runtime Feedback`

- **可用性隔离**：AI Optimization 故障或不可达时，OpenBot 必须保持 100% 正常运行时能力（仅本地缓冲或丢弃外发 Telemetry）。
- **权限隔离**：AI Optimization 无法绕过 OpenBot 的 `TrustedScope`、租户隔离、`applyEntitlementHardDeny` 与 `operator.approvals`。

---

## 四、核心领域模型与数据结构规范

### 4.1 统一关联字段（Correlation Context）
- `tenantId`（多租户物理/逻辑隔离主键）、`traceId`、`spanId`、`parentSpanId`
- `taskId`、`runId`、`sessionId`、`agentId`、`agentVersion`
- `modelProvider`、`modelId`、`modelVersion`
- `promptVersion`、`toolPolicyVersion`、`experimentId`、`datasetCaseId`、`evaluationId`

### 4.2 四大核心领域对象
1. **Dataset & DatasetVersion**：
   - 字段：`datasetId`, `tenantId`, `version`, `split` (`"golden" | "eval" | "train_candidate"`), `contentHash`, `redactionPolicy`, `cases[]`（含输入快照、参考答案、预期工具轨迹、专家标注标签）。
   - 约束：强制 Train/Eval 分离，防评测集污染。
2. **EvaluationJob & EvaluationResult**：
   - 字段：`evaluationId`, `runId` / `datasetCaseId`, `evaluatorType` (`"rule" | "llm_judge" | "human_expert"`), `judgeModelVersion`, `rubricVersion`, `scores` (`correctness`, `completeness`, `citationAccuracy`, `toolQuality`, `safety`), `evidenceRefs`, `confidence`。
   - 约束：严格区分 `expert_verified`、`automated_judge`、`user_explicit` 与 `model_self_eval`。
3. **ExperimentRun**：
   - 字段：`experimentId`, `tenantId`, `baselineArtifactId`, `candidateArtifactId`, `datasetVersion`, `primaryMetric`, `guardrailMetrics[]`, `sampleSize`, `pValue`, `conclusion` (`"win" | "loss" | "inconclusive"`).
4. **OptimizationArtifact**：
   - 字段：`artifactId`, `artifactType` (`"prompt_template" | "model_routing_policy" | "agent_policy" | "tool_strategy"`), `version`, `targetScope` (`tenantId`, `agentId[]`), `payload`, `sourceExperimentId`, `evaluationReportRef`, `rollbackTargetArtifactId`, `sha256`, `signature`, `releaseStatus`。

---

## 五、与 OpenBot 的接口与前置改造清单

### 5.1 OpenBot 侧最小前置适配（不破坏现有架构）
1. **OTel 上下文传播补齐**：在 `extensions/diagnostics-otel/src/service.ts` 补齐 W3C `traceparent` 父子 Span 树，补充 `tool.loop` 事件导出。
2. **版本与反馈关联修复**：
   - 在 `src/executor-evidence/model-call-evidence.ts` 与 Telemetry 中注入 `promptVersion`、`modelVersion`、`toolPolicyVersion`、`experimentId`；
   - 将 `src/gateway/collaboration-learning/collaboration-satisfaction.ts` 的满意度反馈强制绑定 `runId`。
3. **异步脱敏 Telemetry 外发器**：基于有界本地 WAL 队列异步推送（经 `redact-secret-text.ts` + PII 脱敏），支持租户 `allowPayloadExport` 开关。
4. **Artifact 消费适配器**：复用 `packages/evolution-core` 状态机与 `src/gateway/evolution-control/` 灰度/回滚演练护栏，消费签名后的 `OptimizationArtifact`。

### 5.2 接口契约（详见 `10_OPENBOT_AI_OPTIMIZATION_API_AND_EVENT_CONTRACTS.md`）
- **Telemetry Ingestion**：`POST /v1/telemetry/events`（基于 `(tenantId, idempotencyKey)` 幂等）。
- **Evaluation API**：`POST /v1/evaluations/jobs`、`POST /v1/evaluations/runs`、`GET /v1/evaluations/{id}`、`GET /v1/evaluations/regressions`。
- **Artifact API**：`POST /v1/artifacts/candidates`、`POST /v1/artifacts/{id}/release-requests`、`GET /v1/artifacts/{id}/bundle`、`POST /v1/artifacts/{id}/rollback`。

---

## 六、AOR 迁移方案与兼容策略

- **迁移对象**：`packages/aor-core`、`packages/aor-sdk-node`、`packages/aor-sdk-python`、`packages/aor-backend-openbot`、`packages/aor-backend-graph`、`packages/aor-backend-stub`。
- **迁移方式**：使用 `git subtree split` / `git filter-repo` **完整保留原始 Git 提交历史**迁入 `flykingvip-cloud/ai-optimization` 仓库。
- **兼容性过渡策略**：
  - 迁出前先完成《产品与架构设计》与契约冻结；
  - 过渡期 OpenBot 中 `src/gateway/model-entitlement/employee-model-gate.ts` 保持现有 `selectModelOrderWithinEffectiveSet` 接口不变，待 AI Optimization Artifact 接口上线后，切换为消费远程/缓存的 `model_routing_policy` Artifact，再从 OpenBot 仓库移除冗余 AOR 源码。

---

## 七、Phase 1 实施顺序、验收标准与跨团队边界

| 阶段 | 关键交付物 | 跨团队分工 | 验收门槛（Exit Gate） |
|---|---|---|---|
| **M0：契约冻结与底座搭建** | 独立仓库初始化、Telemetry/Evaluation/Artifact OpenAPI & JSON Schema 冻结 | AI Optimization + OpenBot 架构组 | 契约评审通过；OpenBot 补齐 `runId` 反馈绑定与 TraceContext |
| **M1：观测接入与数据集/评测引擎** | Telemetry Ingest 服务、Golden Dataset 管理、Rule + LLM-as-a-Judge 评测引擎 | AI Optimization 团队（OpenBot 提供沙箱脱敏测试流） | 可完整还原单次 Run 调用链；能稳定检出“HTTP 200 但回答质量不合格”案例 |
| **M2：实验平台与受控产物下发** | AOR 历史迁移合入、Prompt/Routing 实验对比、Artifact 签名与 OpenBot Canary/Rollback 联调 | 双方联合联调 | 完成端到端演练：候选实验 → 评测通过 → OpenBot 灰度生效 → 人工注入退化 → 秒级回滚至稳定版本 |
| **M3：Phase 2/3 准入评估** | 线上质量收益复盘报告、专家抽样复核一致性（Kappa / 校准度） | AI Optimization + 业务专家 | 仅当评测可信度与 Prompt/Routing 优化收益达标后，方可立项 SFT/DPO/RLVR |
