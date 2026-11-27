# M4 OpenBot × AI Optimization 沙箱联调执行与验收任务书

- **文档版本**：`V1.0`
- **基线依据**：`ai-optimization` Commit `24363154a4b8aa21558f99e6e58c36b10e517cd8`（CI Run `45925700416`）& `openbot-vp` Commit `25b6613e6`
- **联调范围**：严格限定在隔离沙箱环境（仅使用测试租户、测试身份、测试 Agent 与测试制品；**严禁触及生产配置、生产数据或删除 AOR 源码**）

---

## 一、不可逾越的架构与沙箱边界

1. **OpenBot（Runtime & Governance Plane）**：保留运行时执行、`TaskOutcome` 唯一权威、生产审批（`operator.approvals`）、Canary、Promotion 与 Rollback 执行权。
2. **AI Optimization（Evaluation & Learning Plane）**：负责 Telemetry 消费、Dataset、Evaluation、Experiment 与签名 `OptimizationArtifact` 生成/撤销通知。
3. **AOR 冻结约束**：M4 期间暂不整体迁移 AOR，也不从 OpenBot 删除任何 AOR 源码。

---

## 二、M4 联调冻结契约清单

- **REST / OpenAPI**：`contracts/openapi/ai-optimization-v1.yaml`（`POST /v1/telemetry/events`、`POST /v1/datasets/{datasetId}/versions`、`POST /v1/evaluations/jobs`、`POST /v1/experiments`、`POST /v1/artifacts`、`GET /v1/artifacts/{artifactId}/bundle`、`POST /v1/artifacts/{artifactId}/release-requests`、`POST /v1/artifacts/{artifactId}/revocations`）
- **JSON Schema (2020-12)**：`telemetry-event`、`task-outcome-event`、`dataset-case`、`evaluation-result`、`experiment-run`、`optimization-artifact`
- **事件流**：`runtime.*`、`evaluation.completed`、`experiment.completed`、`artifact.*`、`deployment.completed`、`deployment.rollback.completed`

---

## 三、七大联调主题、测试场景与失败判据

| 主题 | 必须验证的场景 | 失败判据（任一触发即不通过） |
|---|---|---|
| **1. 身份与租户（含 OIDC/JWKS 补齐）** | 1. 接入真实 OIDC Discovery + JWKS 自动拉取、缓存与密钥轮换；<br>2. OpenBot 携带 `EdDSA`/`RS256` 服务令牌调用 AI Optimization；<br>3. 跨租户请求、过期/伪造令牌、服务冒充用户请求 | 仍依赖静态 `publicKeysByKid` 而无 JWKS 自动发现；跨租户请求返回非 `403`；未认证请求返回非 `401` |
| **2. Telemetry 异步与故障隔离** | 1. OpenBot Run/Trace（补齐 W3C `traceparent` 与 `runId` 反馈绑定）异步外发；<br>2. 幂等重放不重复入库；<br>3. 模拟 AI Optimization 宕机、网络超时、WAL 满载与磁盘不可写 | OpenBot 主聊天/工具执行因远端不可用、超时或 WAL 满而报错/阻塞；未脱敏字段或未授权字段外泄 |
| **3. Dataset 治理** | 1. 来源授权校验；2. 不可变版本冲突（`409`）；3. 嵌套 PII/Secret 主动扫描拦截；4. `golden` ↔ `train_candidate` 防污染 | 允许无授权数据入库；伪造 `redactionStatus` 绕过扫描；同一版本被静默覆盖 |
| **4. Evaluation 可追溯** | 1. 检出 HTTP 200 但答案错误/引用错误；2. `EvaluationResult` 追溯至 `runId`、`datasetCaseId`、`judgeModelVersion`、`rubricVersion`；3. 低置信度转人工复核与 `expert_verified` 分级 | `model_self_eval` 被标记为 `expert_verified`；缺少 `evidenceRefs` 或版本引用 |
| **5. Experiment 统计严谨性** | 1. 确定性分流可复现；2. 样本不足/功效不足强制返回 `inconclusive`；3. `holm_bonferroni`/`fdr_bh` 多重比较校正；4. 护栏恶化触发早停 | 样本不足时给出 `win` 结论；Experiment 直接触发 OpenBot 生产策略变更 |
| **6. Artifact 信任链** | 1. 完整规范化签名验签（含 `approvalPolicy` 等全元数据）；2. 逐字段篡改拒绝；3. `min/maxOpenBotVersion`、`agentIds`、`expiresAt`、`revocationStatus`、`monotonicEpoch` 防重放 | 篡改 `approvalPolicy` 后验签仍通过；过期/撤销/旧 Epoch 制品被 OpenBot 消费 |
| **7. 生产治理与数据库差异** | 1. AI Optimization 仅提交 `ReleaseRequest` 与 `Revocation`；<br>2. OpenBot 执行审批 → Canary → Rollback 并回报 `deployment.*`；<br>3. 对比 SQLite 与目标 PostgreSQL 事务/锁/并发/类型行为差异 | 出现双状态机；AI Optimization 直接写 OpenBot 生产配置；未记录 SQLite ↔ PostgreSQL 差异清单 |

---

## 四、双方团队责任边界

- **AI Optimization 团队**：提供沙箱环境服务、实现 OIDC/JWKS Discovery 客户端与缓存、提供 PostgreSQL 迁移适配方案、产出联调测试报告。
- **OpenBot 团队**：在沙箱分支接入 `BoundedTelemetryClient`（补齐 `traceparent` 与 `runId` 反馈绑定）与 `Artifact` 验签消费适配器、保持 `evolution-control` 唯一生产治理权、执行 Canary/Rollback 演练并回报 `deployment.*` 事件。
