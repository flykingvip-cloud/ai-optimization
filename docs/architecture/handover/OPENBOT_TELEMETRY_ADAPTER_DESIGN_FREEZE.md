# OPENBOT_TELEMETRY_ADAPTER_DESIGN_FREEZE.md

- **文档性质**：OpenBot ↔ AI Optimization Telemetry Adapter 的设计冻结基线（只读审计 + 设计文档）。这不是适配器实现，不是跨仓联调通过证明，也不是生产准入申请。
- **授权**：负责人 Yolanda Lee 于 2026-11-28 17:51 CST（Asia/Shanghai）发出「设计冻结」指令。范围仅限只读审计与设计文档交付。交付后停止，等待单独的设计评审批准。
- **记录日期**：2026-11-28（Asia/Shanghai，UTC+8）。活 SHA 与 PR 状态于 2026-11-28 17:52 CST 重新读取。
- **仓库与分支**：`flykingvip-cloud/ai-optimization`，自当时 `origin/main` 拉出的独立文档分支。不使用 `feat/p0-2-telemetry-wal` 或 `docs/openbot-telemetry-adapter-audit`。
- **生产准入**：保持关闭。
- **本轮未执行**：修改任何仓库的业务代码、测试或 Schema；实现 Adapter 或创建实现分支/启动工作包；改动 `openbot-vp` / `knowledge-sdk`；合并、批准或压缩 PR #4 或 PR #5；创建生产配置、连接真实生产 IdP 或生产 PostgreSQL；部署、切流或生产迁移；改变 TaskOutcome、Evolution Control 或 Knowledge Core 的权威边界。

决策标记（全文统一）：

| 标记 | 含义 |
| --- | --- |
| **CONFIRMED** | 有当前源码或明确架构原则支持 |
| **PROPOSED** | 建议方案，尚未获批准 |
| **OPEN** | 需要架构负责人决策 |
| **BLOCKED** | 缺少必要前提，不得进入实施 |

证据层级不得混用：已实现 ≠ 测试覆盖 ≠ CI 验证 ≠ 跨仓库验证 ≠ 生产验证。PR #5 审计文档仅作先前上下文，不以它替代本轮源码核验。

---

## 1. 执行摘要与审计基线

### 1.1 执行摘要

当前两个仓库**没有**已落地的官方 Telemetry Adapter。OpenBot 拥有 `TaskOutcomeRecord` 权威账本和内部 outbox，但不向 AI Optimization 出站。AI Optimization `main` 已有 `TelemetryEvent` 契约、`POST /v1/telemetry/events` 入库雏形和较弱的进程内 WAL，以及作为库存在的 P0-1 OIDC/JWKS；但没有生产环境变量接线，没有请求体上限和限流，并且信任调用方自报的 `redaction.applied`。

本文件冻结以下设计意图（待负责人评审；标为 PROPOSED 的项在批准前不得实施）：

1. OpenBot 保持运行结果最终权威；AI Optimization 只接收脱敏摘要副本，不形成第二套 `TaskOutcome` 账本。**CONFIRMED**（章程 + 当前源码结构）。
2. 官方适配器必须默认关闭、异步旁路、主路径不等待对端；AI Optimization 故障不得影响 Agent 执行、Readiness/Liveness 或控制面决策。**PROPOSED**（原则已由章程确认，实现尚未存在）。
3. 身份字段必须以可信运行时/认证上下文为准，不得接受客户端任意指定 Tenant 或冒充 Agent；缺失或无效身份不得降级为匿名跨租户接收。**PROPOSED**（与现行入库校验方向一致，但 OpenBot 入口存在 `anonymous` / `runner` 回退，见第 5 节，需负责人确认政策）。
4. 出站前由 OpenBot 做必要脱敏；接收端必须独立再校验，不得信任 `redaction.applied=true`。**PROPOSED**（与现行入库实现相反，现行实现是安全缺口）。
5. 投递语义为 at-least-once；消费者按 `idempotencyKey` 去重。**PROPOSED**（入库侧已有租户+幂等键去重的已实现雏形；出站侧尚不存在）。
6. 不得绕过 Evolution Control，不得自动变更生产 Prompt / Model Router / Agent Policy / Tool Policy，未签名未批准制品不得进入生产。**CONFIRMED**（章程原则；本适配器范围不含制品应用）。

本阶段**不**把适配器标为 Engineering Complete，也**不**提升 Integration Accepted 或 Production Accepted。

### 1.2 活基线（2026-11-28 17:52 CST 重读，相对参考表无漂移）

| 对象 | 参考表 | 本轮 GitHub 实况 | 漂移 |
| --- | --- | --- | --- |
| `ai-optimization` `main` | `16b01d99d33b386102bb9b2b248558eb5517e245` | 同 SHA。提交：`Merge pull request #3 …`，提交时间 2026-11-28 14:44:27 CST。CI run [46118003722](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46118003722) `push` success，完成于 14:44:43 CST，**仅证明该 SHA**。 | 无 |
| `openbot-vp` `main` | `8b83e4eba9b4eec5532046481ca98259c3bcf1d6` | 同 SHA。提交：`Merge pull request #365 …`，提交时间 2026-11-28 15:47:57 CST。相对 Phase 0 冻结 `d20d7f7…` 已前进，但本轮参考基线即该当前 `main`。 | 相对本阶段参考表无漂移 |
| `knowledge-sdk` `main` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | 同 SHA。仅边界。Wave2 `9940818b…` 仍不纳入。 | 无 |
| PR #4 | HEAD `8324aa2441145bb1c685df5c8e65694277398f84`，OPEN | 同 SHA，`state=OPEN`，`mergedAt=null`，`MERGEABLE/CLEAN`。CI run [46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496) success 于 17:23:44 CST，**仅证明该 SHA**。其 WAL **不是** `main` 已有能力。 | 无 |
| PR #5 | HEAD `74e75fbd0fcf26a648a4c80b24d7de9eb81bfbf6`，OPEN，审计文档 | 同 SHA，`state=OPEN`，`mergedAt=null`。CI run [46131574686](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46131574686) success 于 17:40:46 CST，**仅证明该文档提交**，不是当前代码事实的替代证明。 | 无 |
| OpenBot CI | run 46122851166 在 `8b83e4eb` 失败，根因未确认 | 再次核验：conclusion `failure`，失败 job 包括 `docs-scope`、`secrets`。再次读取 job 日志仍为 HTTP 404 / `BlobNotFound`。**只记录失败事实，不推断根因。** | 无新证据 |
| 短 SHA `25b6613e6` | 不可解析 | 再次 422：`No commit found for SHA: 25b6613e6`。不作猜测。 | 无 |

本设计冻结对 OpenBot 的源码结论均针对 `openbot-vp@8b83e4eba9b4eec5532046481ca98259c3bcf1d6`；对 AI Optimization 消费/契约侧结论均针对 `ai-optimization@16b01d99d33b386102bb9b2b248558eb5517e245`。引用 PR #4 代码时一律标明「未合并，非 main」。

---

## 2. 两个仓库当前实现事实及证据

### 2.1 OpenBot（`8b83e4eb`）— 已实现的权威与内部事件，缺失官方出站

**CONFIRMED（已实现，全树检索）：** 在当前 `main` 检索 `ai-optimization`、`AI Optimization`、`OptimizationArtifact`、`BoundedTelemetry`、`/v1/telemetry`、`flykingvip-cloud/ai-optimization`，命中数为 0。不存在官方 AI Optimization Adapter，也不存在对该平台的生产遥测出站客户端。此条为源码事实，不是跨仓库验证或生产验证。

**TaskOutcome 权威账本（已实现）：**

- 类型：`src/task-outcome/types.ts` 中 `TaskOutcomeRecord`（约第 158–215 行），`TASK_OUTCOME_SCHEMA_VERSION = "1.0.0"`。含 `scope: TrustedScope`、`taskId`、`lifecycle`、`taskJudgement`、`decisiveRunId`、`runs[]`（含 `runId`）、`attempts[]`、验收/投递门禁、`outcomeVersion` 等。记录上**没有**独立的 `agentId`、`traceId` 或 `userId` 字段。
- `TrustedScope`（同文件约第 63–72 行）：`personal` 使用 `personalDomainId` + `subjectRef` + `authzScopeRef`；`enterprise` 另有 `enterpriseDomainId` 与 `tenantId`。
- 生命周期：非终态查询投影为 `incomplete`；耐久终态仅为 `success | failure | cancelled`（文件头注释与 `judge.ts` / `transitions.ts`）。写入只应通过 `TaskOutcomeResultService.submit`（`result-service.ts` 注释：`taskJudgement` 仅由 result service 写入）。
- 持久化：`src/task-outcome/store.ts` 类 `DurableTaskOutcomeStore`。文件账本（`tips/`、`versions/`、`commits/`、`outbox/`），`atomicWriteJson`（写临时文件、`fsync`、`rename`），每任务锁 `locks/<taskId>.lock`。这**不是** PostgreSQL，也**不是** AI Optimization 的 `CORE_MIGRATIONS`。
- 范围校验：`TaskOutcomeResultService.assertScope`（`result-service.ts` 约第 587–612 行）在后续提交时校验 `scopeId`/`kind`/`subjectRef`。读侧 `callerOwnsTaskOutcome`（`reject-result.ts` 约第 39–52 行）要求 `callerSubjectRef` 匹配，企业范围还要求非空 `callerTenantId` 等于 `scope.tenantId`。

**内部事件（已实现，仅 OpenBot 内部消费）：**

- `OutcomeEventType`：`task.created | task.state_changed | task.closed | task.corrected`（`types.ts` 约第 217–221 行）。与 AI Optimization 的 `TelemetryEventType`（`runtime.run.*`、`runtime.task_outcome.recorded` 等）**不是同一套名字**。
- `OutcomeOutboxEvent`（约第 223–232 行）：`eventId`、`taskId`、`outcomeVersion`、`eventType`、`scopeKind`、`scopeId`、`payloadRef`、`createdAt`。事件本身**不含** `runId`、`tenantId`、`agentId`、`traceId`。`payloadRef` 指向不可变版本快照 `version:${taskId}@${outcomeVersion}`，而不是把整份记录嵌入事件。
- `eventIdFor`（`result-service.ts` 约第 57–62 行）由 `sha256(taskId|outcomeVersion|eventType)` 截断生成，同一版本同一类型幂等。`outboxEvent()`（约第 64–77 行）在 `submit` 提交时写入 outbox。消费者如 `consumers.ts`、`quality-handlers.ts`、`experience-verified-handler.ts` 处理 `task.closed` / `task.corrected`，均是仓内逻辑。

**执行、模型、工具事件的实际产生位置（已实现，但面向仓内证据，不是 AI Optimization 事件）：**

- 任务入口：`ensureChatTurnTaskOutcome`（`chat-entry.ts`）、`entrypoint-ensure.ts` 中 cron/gateway/cli/collab/subagent 等适配器，在 Agent 运行前创建/恢复任务。
- 尝试与 run：`SubmitTransition` 的 `record_attempt` 写入 `AttemptResult` / `RunResult`（`types.ts`）。`AttemptResult` 可选 `toolObservations?: { toolName, ok, summary? }[]`，`summary` 存在敏感字段泄漏风险（见第 8 节）。
- 模型调用证据：`src/executor-evidence/model-call-evidence.ts` 中 `ModelCallEvidence`（约第 29 行起）。含 `agentId`、`scope`、`taskId`、`runId`、`attemptId`、`callId`、`provider`、`model`、用量与状态。文件头明确：**不存储 prompts**。这是仓内执行证据，不是 `runtime.model.called` 出站实现。
- 运行成本/观察：`src/observation/run-cost-collector.ts`、`runtime-evidence.ts` 将 `agentId`/`taskId`/`runId`/`scope` 关联到 TaskOutcome 与 journal，仍不离开 OpenBot。

**身份与版本字段可获得性（已实现但分散，映射未冻结）：**

| 字段 | 在 OpenBot 中的位置 | 说明 |
| --- | --- | --- |
| Tenant ID | 仅企业 `TrustedScope.tenantId` | 个人范围没有 `tenantId`。入口 `scopeFromChatEntry`（`chat-entry.ts` 第 49–67 行）在 `tenantId` 非空时才进入企业范围。 |
| Agent ID | 不在 `TaskOutcomeRecord` 上；用于目录选择与任务 ID | `resolveConfiguredTaskOutcomeRoot`（`reject-result.ts` 第 58–73 行）要求 `isValidAgentId`（`src/routing/session-key.ts` 第 109–112 行）且为已配置 Agent，未知 ID 不建目录。聊天任务 ID 常为 `chat:${agentId}:${runId}`（`chatTurnTaskId`，`chat-entry.ts` 第 36–46 行）。 |
| User / 主体 | `TrustedScope.subjectRef`；记录还有 `submittedBy` | `scopeFromChatEntry`：`subjectRef.trim() \|\| "anonymous"`（第 50 行）。`runtime-from-runner.ts` 的 `defaultScope`（约第 1008–1028 行）在缺省时使用 `subjectRef: "runner"`。二者都是**入口回退**，不能直接当成已批准的跨仓可信主体策略。 |
| Run ID | `RunResult.runId`、`decisiveRunId`、聊天 `ChatEntryIdentity.runId` | 可与同一任务的 TaskOutcome 对应（同一记录的 `runs[]` / 任务 ID 构造）。不是全局 Trace ID。 |
| Trace ID | 在 `TaskOutcomeRecord` 与 `OutcomeOutboxEvent` 上不存在 | 本轮在 OpenBot TypeScript 源中未找到 `traceparent` / `tracestate` / `W3C Trace Context` 的实现引用（检索结果为空）。OTel 插件走独立导出路径（见下），与 `TelemetryEvent.traceContext.traceId` 的对应关系 **OPEN**。 |
| Prompt / Model / Tool / Policy 版本 | **不在** `TaskOutcomeRecord` 上 | `TelemetryEvent.traceContext` 声明了可选 `promptVersion`、`agentVersion`、`toolPolicyVersion`。OpenBot 内同类字段分散在会话投影、policy rule-adaptation、task-orchestration `path-binding` 等，**没有**一条已实现的、可对所有入口使用的统一出站映射。模型名出现在 `ModelCallEvidence.model`，但不是「策略版本」。 |

**现有 OTel / diagnostics 出口（已实现，但是另一条通道）：**

- `extensions/diagnostics-otel/src/service.ts`：`createDiagnosticsOtelService()`。`start` 在 `!cfg?.enabled || !otel?.enabled` 时不启动（约第 83 行）。导出前对字符串属性做 `redactSensitiveText`（约第 354 行注释：OTLP 可离开主机边界）。目标是通用 OTLP collector，**不是** `/v1/telemetry/events`。
- `src/config/schema.help.ts`：`diagnostics.otel.enabled` 说明为按需开启；同文件 `diagnostics.cacheTrace.includePrompt` 写明 **default: true**。这是诊断/缓存追踪路径的敏感泄漏风险，**不得**复用为 AI Optimization 出站通道。

**重复、丢失、泄漏风险（基于源码，非跨仓库验证）：**

- 重复：内部 outbox `eventId` 对 `(taskId, outcomeVersion, eventType)` 确定，仓内幂等较好；但若未来多次 flush 到 AI Optimization，需要消费侧幂等（main 入库已有雏形）。
- 丢失：内部 commit 与 outbox 有崩溃恢复（`recoverPendingCommits`）；但没有任何到 AI Optimization 的缓冲，故当前「丢失」表现为「根本不投递」。
- 泄漏：`toolObservations.summary`、`reasonDetail`、cacheTrace 默认包含 prompt，均不可直接进入出站 payload。

### 2.2 AI Optimization（`16b01d99`）— 消费雏形已实现，生产接线与加固缺失

**契约（已实现）：** `packages/shared-contracts/src/index.ts` 中 `TelemetryEvent`（约第 22–52 行）与 `TelemetryEventType`。`contracts/json-schema/telemetry-event.schema.json`、`task-outcome-event.schema.json`（摘要字段，不是完整 `TaskOutcomeRecord`）。`contracts/events/event-catalog.md` 写明 `runtime.task_outcome.recorded` 是终态摘要副本，OpenBot 为唯一权威。

**HTTP 入库（已实现，测试引用，无生产装配入口）：**

- `services/http-api/src/server.ts` 第 56–65 行：`POST /v1/telemetry/events`，经 `authenticate` 后调用 `TelemetryIngestionService.ingest`，拒绝时 403（`tenant_mismatch`）或 400，成功 202。
- 同文件第 67–69 行：`GET /v1/telemetry/events` 按租户列出事件。该路径**未**出现在 `contracts/openapi/ai-optimization-v1.yaml` 的 `paths` 中。
- OpenAPI 声明了但 `server.ts` **未实现**的路径包括：`POST /v1/datasets`、`POST /v1/datasets/{id}/versions`、`POST /v1/evaluations/jobs`、`GET /v1/evaluations/{id}`、`POST /v1/experiments`、`POST /v1/artifacts`、`GET /v1/artifacts/{id}`、`POST /v1/artifacts/{id}/release-requests`、`GET /v1/release-requests/{id}` 等。已实现但形态不同的还有 `POST /v1/datasets/...`、`POST /v1/evaluations/rules`、`GET /v1/artifacts/:id/bundle`、`POST /v1/artifacts/:id/revocations`。
- `createOptimizationHttpServer` 仅被测试引用（`tests/m4-sandbox/*`、`tests/integration/secondary-audit-remediation.test.ts` 等），仓库内无生产启动或环境变量装配入口。证据层级：已实现 + 部分测试覆盖 + `main` CI 验证库/服务测试；**不是**生产验证。

**入库逻辑（已实现）：** `services/telemetry-ingestion/src/index.ts` `ingest()`（第 18–51 行）：要求 `eventId`、`idempotencyKey`、`traceContext.runId`；`event.tenantId === auth.tenantId`；`event.redaction.applied` 为真。持久化时 `INSERT OR IGNORE` 到 `telemetry_events`，唯一约束 `(tenant_id, idempotency_key)`（`packages/shared-contracts/src/db.ts` `CORE_MIGRATIONS` v1）。无数据库时用内存 `tenantId::idempotencyKey`。**不**重校验 payload 白名单，**不**检查 `agentId` 是否与令牌绑定。

**鉴权（已实现为库，非生产接线）：** `authenticate`（`server.ts` 第 33–47 行）优先 `OidcJwksClient.verifyAuthorization`，否则静态 `verifyJwtAuth`。`auth.ts` 第 98–101 行要求 JWT 含非空 `sub` 与 `tenantId`；第 104–106 行可禁止 service `actAsUser`。`packages/shared-contracts/src/oidc-jwks.ts` 为 P0-1 Engineering Complete 库。全仓无 `process.env` 的 issuer/audience/allowlist 接线。localhost/mock 与仓库 CI **不得**称为生产 IdP。Integration Accepted / Production Accepted **未达到**。**BLOCKED** 对生产集成。

**限流与体大小（缺失，已核实）：** `readJsonBody`（`server.ts` 第 19–24 行）读至结束，无上限。全文件无 429 / 令牌桶 / 按租户速率限制。

**脱敏 SDK（已实现，生产者侧）：** `packages/telemetry-sdk/src/index.ts` `sanitizeTelemetryPayload` + `ALLOWED_PAYLOAD_FIELDS`（第 6–24、44–56 行），enqueue 时强制 `redaction.applied=true`。这是本仓 SDK 行为；OpenBot 未引用该 SDK。入库侧只看标志位。

**WAL：必须区分 main 与未合并 PR #4。**

| 项 | `main` `16b01d99` `packages/telemetry-sdk/src/index.ts` | 未合并 PR #4 `8324aa2`（**不是 main**） |
| --- | --- | --- |
| 基本做法 | `${wal}.tmp.${pid}` 写入、文件 `fsync`、`rename` 覆盖（第 125–146 行） | 更细的 `.partial` / `.complete`、cleanup sentinel、父目录 fsync |
| 锁 | 无排他锁 | Linux 抽象套接字活锁（`wal-lock.ts`）。协作式，非内核 flock |
| 错误 | `catch` 后只增加 `walWriteErrorCount`，不 fail-closed（多处） | `TelemetryWalIoError` / `TelemetryWalInitError`，`listTmpFiles` 对非 ENOENT 上抛 |
| `exportedCount` | 发送成功后立即增加，再 persist（第 176–180 行） | 耐久清理/persist 成功后才增加 |
| 状态 | 已在 main，被本仓测试与 CI 46118003722 覆盖的是**这套较弱行为** | Engineering Complete 冻结在 PR #4，CI 46130248496 只证明 `8324aa2`。未做真实断电；仍为 at-least-once |

**CONFIRMED：** 不得把 PR #4 的 WAL 能力写成 `origin/main` 已具备。**BLOCKED：** 把 main WAL 当作生产级可恢复性前提。

### 2.3 Knowledge SDK（`b953c992`，仅边界）

Evidence / ACL / 检索权威在 Knowledge SDK 契约（如 `EvidenceAnchor`、`EvidencePack`）。本适配器不得迁移这些职责。Wave2 仍不纳入。**CONFIRMED** 原则；非本阶段实施范围。

---

## 3. 出站事件契约（OpenBot Telemetry outbound event contract draft）

**PROPOSED**（草案，待批准）。不把 `TaskOutcomeRecord` 改造成 AI Optimization 的 SoT。

### 3.1 允许出站的事件类型（映射自现有内部事实）

| 建议的 `TelemetryEvent.eventType` | OpenBot 内部来源 | 出站内容限制 |
| --- | --- | --- |
| `runtime.run.started` / `completed` / `failed` | `RunResult` + 任务生命周期，而非主路径同步调用 | 仅 run 标识、状态、可选时延；无 prompt 原文 |
| `runtime.model.called` | `ModelCallEvidence`（不包含 prompts） | 仅白名单：`provider`、`model`、`tokens*`、`latencyMs`、`status`、`errorCode` |
| `runtime.tool.called` | `AttemptResult.toolObservations` 的非敏感摘要 | 仅 `toolName`、`toolOk`、`errorCode`；**禁止** `summary` 原文除非另行批准并再脱敏 |
| `runtime.task_outcome.recorded` | `OutcomeOutboxEvent` 为 `task.closed` / `task.corrected` 时的版本快照摘要 | 对齐 `task-outcome-event.schema.json`：`taskId`、`runId`、`outcomeVersion`、`lifecycle`、`taskJudgement`、`decidedAt` 等。禁止整份 `TaskOutcomeRecord` |
| `runtime.feedback.recorded` | 显式反馈路径（若实施时存在可绑定 `runId` 的来源） | 仅极性等白名单字段，强制绑定 `runId` |

目录中由 AI Optimization 生产或由部署面生产的事件（`evaluation.*`、`artifact.*`、`deployment.*`）**不属于**本出站 Adapter 的 OpenBot→AI Optimization 范围。**CONFIRMED** 边界。

### 3.2 建议的强制/可选字段

强制（PROPOSED）：`schemaVersion="1.0.0"`、`eventId`、`idempotencyKey`、`eventType`、`occurredAt`、`tenantId`（见第 5 节对个人范围的 OPEN）、`source.system="openbot"`、`source.component`、`traceContext.traceId`、`traceContext.runId`、`redaction`（由出站管道写入，且接收端不单独采信）。

建议由可信上下文填充、禁止调用方任意指定作为权威的字段：`traceContext.taskId`、`agentId`、`sessionId`。版本字段 `promptVersion` / `agentVersion` / `toolPolicyVersion`：能从可信运行快照取得则填，不能取得则省略，不得编造。**OPEN**：统一版本快照的权威来源尚未在 OpenBot 单一记录上存在。

`idempotencyKey` **PROPOSED** 生成规则：稳定派生，例如 `openbot:${tenantId}:${agentId}:${taskId}:${outcomeVersion}:${eventType}` 或沿用内部 `eventIdFor` 并加租户/agent 前缀，避免跨租户碰撞。

### 3.3 明确禁止

- 将完整 `TaskOutcomeRecord`、对话原文、系统提示、Evidence 正文、工具 `summary` 原文作为 payload。
- 在 AI Optimization 按 `taskId` 重建可写权威账本。
- 修改 OpenBot `TaskOutcomeRecord`  schema 使其「为了评测平台而成为对端权威」。内部 schema 变更若发生，须另审，且不得改变 SoT。

---

## 4. 入站 API 契约（Telemetry Ingestion Contract & Security Gap Report）

### 4.1 当前已实现的契约行为（`16b01d99`）

- 入口：`POST /v1/telemetry/events`，需 Bearer；成功 202；租户不符 403；缺字段或 `redaction.applied` 为假则 400。
- 鉴权上下文 `AuthContext.tenantId` 必须与 `event.tenantId` 一致。
- 幂等：`(tenant_id, idempotency_key)` 唯一，`INSERT OR IGNORE` 或内存 Set；重复视为 accepted + duplicate。
- 持久化：默认 AI Optimization 侧 `node:sqlite` `CORE_MIGRATIONS` v1。**不是**已验收 PostgreSQL（P0-4 另授权）。
- JWT 校验已实现：iss/aud/exp/nbf/签名、`sub`+`tenantId` 必填、可禁 service 冒充用户。OIDC/JWKS 库已实现但无生产 env 接线。

### 4.2 安全与契约缺口（已核实的缺失/弱点）

| 缺口 | 证据 | 建议状态 |
| --- | --- | --- |
| 信任 `redaction.applied=true` | `telemetry-ingestion/src/index.ts` 第 25–26 行 | 必须改为独立白名单/脱敏再校验。**PROPOSED** |
| 无请求体大小上限 | `readJsonBody` 第 19–24 行 | 必须设上限并在超额时拒绝。**PROPOSED**（具体字节数 **OPEN**） |
| 无限流 / 无 429 | `server.ts` 无相关逻辑 | 按租户/主体限流。**PROPOSED**（阈值 **OPEN**） |
| OpenAPI 与实现漂移 | 见第 2.2 节 | 实施前对齐官方遥测契约。`GET /v1/telemetry/events` 是否保留 **OPEN** |
| 无生产装配 / env 接线 | 无 `process.env` issuer/audience/allowlist | **BLOCKED** 对 Integration Accepted 与生产接入 |
| 事件体中的 `tenantId`/`agentId` | 只比较 event.tenantId 与 token；agentId 不校验 | 权威租户必须来自令牌；禁止用 body 覆盖令牌租户。Agent 绑定规则 **OPEN** |
| main WAL 较弱 | 见第 2.2 节对照表 | 不得当作生产可恢复性。PR #4 另审。**BLOCKED** 若把 8324aa2 能力当成 main 前提 |
| 未实现路径被 OpenAPI 宣称 | 第 2.2 节 | 不在本 Adapter 冻结中偷偷扩大为已交付 API |

### 4.3 建议的入站冻结行为（PROPOSED，待批）

1. 唯一官方出站目标：`POST /v1/telemetry/events`。
2. 先验签，再限流，再限体，再 schema/白名单校验，再比较租户，再幂等写入。
3. 权威 `tenantId` = 验证后的 `AuthContext.tenantId`；若 body 中的 `tenantId` 存在且不一致，拒绝，不降级。
4. 不接受匿名或缺失租户令牌。
5. 幂等键已存在则 202 + duplicate，不改变已存首份事件。
6. 未知字段：契约应规定附加属性拒绝或剥离（**OPEN**：`additionalProperties` 策略）。
7. 入库副本不可写回 OpenBot 作为 TaskOutcome。

---

## 5. Identity & Trust Boundary

### 5.1 字段可信来源

| 字段 | 当前 OpenBot 事实（`8b83e4eb`） | 当前 AI Optimization 事实（`16b01d99`） | 冻结意图 |
| --- | --- | --- | --- |
| Tenant ID | 仅企业 `TrustedScope.tenantId`；由入口传入的 `identity.tenantId` 决定是否进入企业范围（`scopeFromChatEntry`）。个人范围无租户。 | 令牌 claim `tenantId` 必填（`auth.ts` 第 98–101 行）；入库要求与 `event.tenantId` 相等 | **PROPOSED**：出站与入站的权威租户必须来自可信身份上下文（OpenBot 运行时已绑定的企业 scope + 对端已验证令牌），禁止客户端在请求体中「指定另一个租户」。**OPEN**：个人范围（无 tenantId）是否出站、以及映射到哪个租户/是否根本禁止。 |
| Agent ID | 用于目录与任务 ID，记录体上不存；`resolveConfiguredTaskOutcomeRoot` 拒绝未配置/非法 ID | `traceContext.agentId` 可选，入库不校验 | **PROPOSED**：Agent ID 必须是实际运行并已配置的 Agent，由 OpenBot 运行时填入，不得由对端调用方任意冒充。接收端至少不得仅凭 body 提升权限。绑定到服务身份允许列表的具体机制 **OPEN**。 |
| User / 主体 | `subjectRef`；空则 `"anonymous"`；runner 缺省 `"runner"` | `AuthContext.subjectId` 来自 JWT `sub`。`TelemetryEvent` **没有** `userId` 字段 | **OPEN**：跨仓是否传输用户主体、用哪个字段、以及禁止 `anonymous` 出站是否作为硬规则。**PROPOSED** 最低线：缺失/无效身份不得匿名跨租户接收。 |
| Run ID | `RunResult.runId` / `decisiveRunId` / 入口 `runId`，可与 TaskOutcome 对应 | `traceContext.runId` 必填（否则 `invalid_schema`） | **PROPOSED**：出站 `runId` 必须能对应到该次 TaskOutcome 的 run（或任务级最终决定 run）。不得随机生成无法回溯的 ID。 |
| Trace ID | TaskOutcome/outbox 无此字段；未发现 W3C `traceparent` 实现引用 | `traceContext.traceId` 在类型上为必填 | **OPEN**：是否强制 W3C Trace Context、以及无 OTel 时用何种稳定 traceId（例如从 taskId+runId 派生）须负责人决定。不得假装当前已遵循 W3C。 |
| Redaction | OpenBot 无 `TelemetryEvent` 出站脱敏实现。OTel 插件有独立 redaction；cacheTrace 默认可含 prompt | SDK 生产者会置 `applied=true`；入库只检查该标志 | 见第 6 节矩阵 |

### 5.2 强制原则（提交审批；1、4、5 与章程/缺口一致，列为 PROPOSED 待批成冻结）

1. **不信任**调用方自报 `redaction.applied=true`。
2. OpenBot 在出站前执行必要的敏感信息处理。
3. AI Optimization 接收端仍须独立验证、限流、限制请求体大小并做二次安全检查。
4. 缺失或无效身份不得降级为匿名跨租户接收。
5. 不允许客户端任意指定 Tenant 或冒充 Agent。
6. 服务令牌不得 `actAsUser` 冒充终端用户（已实现选项 `disallowServiceImpersonation`，HTTP 入口已打开）。**CONFIRMED** 于当前 HTTP 代码；生产接线仍 **BLOCKED**。

### 5.3 与现行入口回退的张力（必须负责人表态）

`scopeFromChatEntry` 允许 `subjectRef` 回退为 `"anonymous"`，`defaultScope` 使用 `"runner"`。这与「不得匿名跨租户接收」存在冲突。**OPEN**：设计冻结若批准第 5.2 条，则官方 Adapter 在主体不可信或为 `anonymous` 时必须跳过出站并记审计，而不是沿用入口回退把匿名事件送入评测平台。此条批准前 **BLOCKED** 实施出站映射。

---

## 6. 脱敏责任矩阵

| 步骤 | 责任方 | 当前状态 | 冻结意图 |
| --- | --- | --- | --- |
| 选择可出站字段 | OpenBot Adapter（尚未实现） | 无 | **PROPOSED**：只映射第 3 节白名单/摘要 schema |
| 出站前剥离 PII / Secret / 原文 | OpenBot | 无 TelemetryEvent 管道；OTel 另有 redaction；cacheTrace 默认或含 prompt | **PROPOSED**：Adapter 出站必须脱敏；禁止复用 cacheTrace 默认行为 |
| 标记 `redaction.applied` 与政策版本 | OpenBot 出站管道写入 | SDK 在本仓 enqueue 时会写，但 OpenBot 未用 | **PROPOSED**：标记只表示「发送方声称已处理」，不是接收放行条件 |
| 独立再校验（白名单、禁止字段、必要的模式检查） | AI Optimization 入库 | **未做**（只看标志） | **PROPOSED**：必须做；失败 400，不入库 |
| 限流与体大小 | AI Optimization HTTP | **未做** | **PROPOSED** |
| 审计与问责 | 双方各记自己一侧指标/拒绝原因 | 无跨仓适配器指标 | **PROPOSED**：发送方对出站前处理负责；接收方对二次放行负责，不能把责任推给标志位 |
| 知识 Evidence 正文 | Knowledge SDK | 不在本通道 | **CONFIRMED**：本适配器不运输 Evidence 权威对象 |

---

## 7. 故障隔离与投递语义（Adapter Fault Isolation & Delivery Semantics）

以下 7 条为设计必须项。实现尚不存在，故整体为 **PROPOSED**。其中「AI Optimization 出不得阻塞 OpenBot 执行」有章程 **CONFIRMED** 原则；当前因无出站调用，宕机碰巧不阻塞，这不是已交付的 Adapter 保证。

1. **默认关闭**；未配置出口 URL、身份或显式 opt-in 时，不产生任何外部请求。可参考 Knowledge SDK 适配器默认关闭且生产环境拒绝的模式（`src/knowledge/adapter/config.ts`、`client.ts` 约第 159–164 行），但遥测失败必须对执行面静默隔离，而不是把错误抛回任务主路径。
2. OpenBot **运行主链路不等待** AI Optimization 响应。接口应为 `enqueue(...): void`（或等价），禁止在 Gateway/Task 完成路径上 `await send()`。
3. 超时、不可用、限流、4xx/5xx **不得影响** Agent 执行或已提交的 TaskOutcome。
4. 队列满：drop-oldest 或拒绝新的低优先级事件并审计；`runtime.task_outcome.recorded` 可优先保留，但仍不得回滚已提交账本。WAL 写入失败：不得阻断执行；记录失败并按策略降级（丢弃或保留内存队列）。进程重启：从本地缓冲恢复未确认事件（前提是该缓冲方案已被单独批准；**不得**假设 main WAL 或未合并 PR #4 已在 OpenBot 进程中可用）。
5. 投递为 **at-least-once**。消费者按 `(tenantId, idempotencyKey)` 幂等；重复投递不得改变首份已接受事件。
6. 遥测失败 **不得** 将 OpenBot Agent 任务标为失败，不得改变 `taskJudgement`。
7. Readiness、Liveness、Evolution Control 决策 **不得** 依赖 AI Optimization 可用性。禁止把对端健康检查设为 OpenBot 就绪硬依赖。

另外保持：**CONFIRMED** 原则——不绕过 Evolution Control；不自动改生产 Prompt / Router / Policy；未签名未批准制品不进入生产。本 Adapter 不包含制品拉取/应用。

关于缓冲技术选型：**OPEN** 是否在 OpenBot 侧实现独立有界 WAL，或在 PR #4 合并并单独授权后再共享库。**BLOCKED**：实施时把 `16b01d99` 的 WAL 或未合并的 `8324aa2` 直接写成「OpenBot 已具备可恢复出站」。

---

## 8. 安全风险与未解决问题

已核实风险：

1. 入库信任自报脱敏标志（`16b01d99` `ingest` 第 25–26 行）。
2. 无请求体上限、无限流。
3. OpenAPI 与 HTTP 漂移；`GET /v1/telemetry/events` 扩大了读面，是否保留未决。
4. 无生产 IdP 接线；集成验收未达到。
5. OpenBot 入口 `anonymous` / `runner` 回退与跨仓身份原则冲突。
6. 个人范围无 `tenantId`，与对端必填租户声明冲突。
7. `toolObservations.summary`、`reasonDetail`、cacheTrace 默认包含 prompt 的泄漏面。
8. 事件体 `agentId` 当前不被接收端校验。
9. main WAL 错误吞掉、无锁、无目录 fsync；不能当生产可恢复性。
10. 把 AI Optimization 纳入 OpenBot 就绪条件将违反硬隔离。

未决（OPEN）与阻断（BLOCKED）见第 12 节。OpenBot `main` CI 失败仅为事实，根因 **OPEN**（无日志证据，不推断）。短 SHA `25b6613e6` 仍不可解析。

---

## 9. 跨仓库测试矩阵（Cross-Repository Acceptance Matrix）

下列测试属于**未来实施阶段**必须执行的验收设计，本轮不编写测试代码。单仓冻结状态机或 mock **不得**冒充「真实跨仓库集成验收」。列「需要真实跨仓？」为「是」的项，只有在固定 SHA、可复核的联调环境中跑过，才能算跨仓库验证；否则最多算单仓或契约测试。

| ID | 类别 | 建议所在仓 | 环境/依赖 | 前置条件 | 步骤（设计） | 预期 | 失败判定 | 真实跨仓？ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | 正常投递 | 双方；跨仓套件建议独立测试仓或双方约定的 integration job | 测试 IdP、测试 AI Optimization 服务、OpenBot 测试运行时（均非生产） | Adapter 显式开启并配置测试出口与身份 | 关闭一个聊天/任务，产生允许的出站事件 | 对端 202 入库，字段符合契约，TaskOutcome 权威仍在 OpenBot | 事件未到、字段越权、或 OpenBot 账本被改写 | 是 |
| T-02 | 默认关闭 | OpenBot | 无对端或对端探测代理 | 未配置 / 未 opt-in | 正常执行任务 | 探测代理收 0 个外部请求；任务成功 | 出现任何出站请求 | 否（可用伪造出口，但仍须证明无请求） |
| T-03 | 故障隔离-超时 | OpenBot | 可延迟的测试桩 | Adapter 开启 | 主路径完成任务，对端故意超时 | 任务成功，TaskOutcome 终态与无对端时一致 | 任务失败、阻塞或终态变化 | 否（桩），另需跨仓 T-03C 用真实不可用实例 |
| T-03C | 故障隔离-断网/5xx | 跨仓 | 真实测试部署但可关停/返回 5xx | 同 T-01 | 关停或注入 5xx 后执行任务 | 同 T-03 | 同 T-03 | 是 |
| T-04 | 身份-错误租户 | AI Optimization（单仓可先做）+ 跨仓 | 测试 IdP | 有效令牌租户 A | 发送 body.tenantId=B 或用 A 令牌发送 B 的事件 | 403，不入库 | 202 或写入 B/A 错租户 | 单仓可测鉴权；跨仓再测真实客户端 |
| T-05 | 身份-无效令牌 | AI Optimization | 测试 IdP | 无令牌/过期/错签 | POST 事件 | 401 | 202 或匿名接受 | 否（单仓即可），跨仓重复为加分 |
| T-06 | 身份-Agent 越权 | 跨仓 | 测试 IdP + 两个 Agent 配置 | 服务身份仅允许 Agent-1 | 尝试上报 Agent-2 | 拒绝或按批准策略剥离/审计且不提权 | 接受并当作 Agent-2 权威 | 是（规则取决于第 5 节 OPEN） |
| T-07 | 脱敏-PII/Secret | 双方 | 含邮箱/密钥/prompt 的夹具 | Adapter 开启 | 尝试出站含敏感字段的内部记录 | 出站 payload 无原文；若发送方漏网，接收端 400 | 任一侧接受原文 | 建议双方单仓各测，跨仓再测端到端 |
| T-08 | 脱敏-伪造标志 | AI Optimization | 无需 OpenBot | 令牌有效 | `redaction.applied=true` 但 payload 含非白名单/敏感值 | 400，不入库 | 202 | 否（这是接收端硬要求） |
| T-09 | 幂等 | AI Optimization + 跨仓 | 同 T-01 | 同一 `idempotencyKey` | 重复 POST 两次 | 两次均 202，副本一条，内容为首次 | 两条不同内容或第二次覆盖 | 单仓测存储；跨仓测客户端重试 |
| T-10 | WAL 恢复 | 缓冲所在仓（OpenBot 侧缓冲或 AI Optimization 进程 WAL，取决于批准的选型） | 可 SIGKILL 的测试进程 | 已授权的 WAL 实现（**不得**把未合并 PR #4 或 main 弱 WAL 自动当作被测实现） | SIGKILL、损坏尾部、重启 | 按该实现的已批准语义恢复或 fail-closed；不损坏权威 TaskOutcome | 丢弃已确认语义外的数据且无审计，或阻塞/破坏 TaskOutcome | 否，除非选定共享库再跨仓 |
| T-11 | 容量-队列满/WAL 满 | 出站仓 | 小配额配置 | Adapter 开启 | 注入超量事件 | 有界、可审计丢弃，主任务成功 | 无界内存增长或任务失败 | 否 |
| T-12 | 容量-限流 | AI Optimization | 低阈值配置 | 有效令牌 | 超速率发送 | 429，已有数据一致，OpenBot 任务仍成功 | 无限接受或导致对端/客户端任务失败 | 单仓测 429；跨仓测隔离 |
| T-13 | 运行隔离 | OpenBot | 任意故障桩 | 任务将关闭 | 遥测全失败 | `taskJudgement`/生命周期与对照组相同 | 终态被遥测错误改变 | 否（必须在 OpenBot 单仓可判定） |
| T-14 | 版本兼容 | AI Optimization，跨仓加测 | 新旧 schema 夹具 | 已冻结兼容策略 | 发送缺可选字段、未知字段、旧事件 | 按第 4.3 条批准的策略接受或拒绝 | 违反冻结策略或崩溃 | 单仓契约测试 + 跨仓抽样 |

**CONFIRMED：** 单仓或 mock 结果不得写成跨仓库验证或生产验证。P0-3 真实状态机 / Evolution Control E2E 是另授权工作，不在本 Adapter 设计冻结中启动。

---

## 10. 实施阶段任务拆解（仅设计，不创建分支、不启动）

下列工作包在设计评审批准前均为未授权。依赖若为 BLOCKED 项，不得提前开工。

| 工作包 | 依赖 | 可能修改的仓库 | 预计范围 | 风险 | 测试要求 | 验收条件 |
| --- | --- | --- | --- | --- | --- | --- |
| Adapter Outbound Client | 设计批准；身份策略关闭相关 OPEN | 主要 `openbot-vp` | 默认关闭的 enqueue 客户端、配置、钩子注册；不改 TaskOutcome SoT | 误接主路径；默认为开 | T-02、T-03、T-13 | 未配置零出站；主路径无 await；失败不改账本 |
| Event Contract / Schema Compatibility | 设计批准；未知字段策略 OPEN 关闭 | `ai-optimization` 契约/OpenAPI，必要时文档化映射；**不在本阶段改 schema，实施阶段另审** | 对齐 OpenAPI 与实现；冻结兼容规则 | 扩大 API 面；把摘要变成第二账本 | T-01、T-14 | 契约与实现一致；禁止完整记录入库 |
| Identity Propagation | 第 5 节 OPEN（个人租户、匿名、Agent 绑定、Trace ID）关闭 | 双方 | 令牌与运行时上下文绑定；禁止 body 覆盖租户 | 匿名出站；租户串扰 | T-04、T-05、T-06 | 错租户/无效令牌被拒；无匿名跨租户接受 |
| Redaction and Payload Validation | 设计批准 | 双方 | OpenBot 出站脱敏；AI Optimization 再校验，不信任标志 | 漏网原文；只改标志不改校验 | T-07、T-08 | 伪造标志被拒；夹具敏感值不出站/不入库 |
| Async Queue and Fault Isolation | 设计批准 | 主要 `openbot-vp` | 有界队列、超时、退避、熔断、指标 | 队列阻塞事件循环；健康检查耦合对端 | T-03、T-03C、T-11、T-13 | 超时/5xx/满队列不影响任务 |
| WAL / Delivery / Idempotency | 缓冲选型 OPEN；PR #4 合并与否另审 | 出站仓和/或 `ai-optimization`（仅当明确授权共享或加固） | at-least-once 缓冲与去重 | 误把 main 弱 WAL 或未合并 PR #4 当已交付 | T-09、T-10 | 重复不覆盖；重启行为符合批准语义；不描述未合并代码为 main 能力 |
| AI Optimization Ingestion Hardening | 设计批准；体大小/限流阈值 OPEN | `ai-optimization` | 限体、限流、再校验、租户权威、可选去掉或保护 GET 列表 | 破坏现有单仓测试假设 | T-04、T-08、T-12 | 缺口关闭且有测试；仍无生产 IdP 则不得称 Integration Accepted |
| Cross-Repository Integration Tests | 上述客户端与加固；测试 IdP；**不**依赖生产；OpenBot CI 通道现状需记录 | 双方或独立测试工程 | T-01、T-03C、T-06、T-09 跨仓部分 | 用 mock 冒充跨仓 | 矩阵中标记「是」的项 | 固定 SHA 的可复核日志；分层标注证据 |
| Operational Metrics and Diagnostics | 客户端与加固 | 双方 | 出站/拒绝/丢弃/重复/延迟指标；禁止把对端健康做成就绪硬依赖 | 指标含 PII；探针耦合 | 与 T-02/T-13 一起断言探针行为 | 有可观察指标；readiness 不对对端失败 |

**禁止**在本阶段创建这些实现分支或开始编码。

---

## 11. 验收门槛与禁止事项

### 11.1 本阶段（设计冻结）门槛

- 两仓源码已按活 SHA 重审；关键结论有路径与 SHA。
- 出站、入站、身份、脱敏、可靠性契约已写明，未决项均为 OPEN 或 BLOCKED。
- 文档不把未验证能力写成已完成；不把 PR #4 WAL 写成 main 已有。
- 文档 PR 保持 OPEN、仅文档、最终 HEAD 有对应 CI。

本阶段**不**提升：适配器 Engineering Complete、Integration Accepted、Production Accepted。

### 11.2 后续实施阶段（另审后）禁止事项

- 不修改 TaskOutcome / Evolution Control / Knowledge Core 的权威边界。
- 不把完整 TaskOutcome 复制为第二套账本。
- 不绕过 Evolution Control，不自动变更生产 Prompt / Model Router / Agent Policy / Tool Policy。
- 未签名/未批准制品不得进入生产。
- 主路径不得等待 AI Optimization；遥测失败不得导致任务失败。
- 不把 localhost、mock IdP、仓库 CI 或单仓测试写成生产 IdP / 生产验收 / 跨仓验收。
- 不连接生产 IdP、生产 PostgreSQL，不部署、不切流、不生产迁移，除非另有明确授权。
- 不把未合并 PR #4 的能力描述为 main 已具备。
- 生产准入保持关闭，直到 Production Accepted 另审通过。

### 11.3 建议的门禁关系（CONFIRMED 为分层原则）

| 门禁 | 适配器相关状态 |
| --- | --- |
| 设计冻结 | 本文件提交评审；批准前不得实施 |
| 适配器 Engineering Complete | 未达到 |
| Integration Accepted | 未达到；被真实 IdP 接线、官方出站、跨仓矩阵等 **BLOCKED** |
| Production Accepted | 未达到；生产准入关闭 |
| PR #4 合并 | 未授权 |

---

## 12. 设计决策记录（ADR）及待审批事项

| ID | 决策 | 状态 | 依据或缺口 |
| --- | --- | --- | --- |
| ADR-01 | OpenBot 是 TaskOutcome 与生产执行的唯一权威；AI Optimization 只持有脱敏摘要副本 | **CONFIRMED** | 章程 `SYSTEM_BOUNDARIES.md`、`event-catalog.md`；OpenBot `DurableTaskOutcomeStore`；对端仅有 `telemetry_events` 副本表 |
| ADR-02 | 本阶段不实现 Adapter，不合并 PR #4 / #5，不启动工作包 | **CONFIRMED** | 本轮授权范围 |
| ADR-03 | 官方出站默认关闭、异步旁路、故障隔离 7 条（第 7 节） | **PROPOSED** | 章程要求不依赖 AI Optimization 也能运行；实现不存在 |
| ADR-04 | 接收端不信任 `redaction.applied`，必须再校验、限流、限体 | **PROPOSED** | 反证：`ingest` 第 25–26 行只检查标志；`readJsonBody` 无限 |
| ADR-05 | 权威租户来自验证后的身份上下文，body 不得覆盖 | **PROPOSED** | `event.tenantId === auth.tenantId` 已有方向；需禁止降级与匿名 |
| ADR-06 | 投递 at-least-once，消费者按 tenant+idempotencyKey 去重 | **PROPOSED** | 入库 UNIQUE 已实现雏形；出站缓冲未实现 |
| ADR-07 | 不绕过 Evolution Control；本 Adapter 不含制品应用 | **CONFIRMED** | 章程；OpenBot 无 OptimizationArtifact 消费客户端 |
| ADR-08 | Knowledge SDK 保持 Evidence/ACL/检索权威 | **CONFIRMED** | 边界原则与 SDK 契约 |
| ADR-09 | 个人范围（无 tenantId）如何出站 | **OPEN** | `TrustedScope` 个人无 tenantId；对端令牌要求 tenantId |
| ADR-10 | `anonymous` / `runner` 回退是否禁止出站 | **OPEN** | `chat-entry.ts` 第 50 行；`runtime-from-runner.ts` `defaultScope` |
| ADR-11 | Trace ID 是否强制 W3C，无 OTel 时如何派生 | **OPEN** | 源码未找到 `traceparent`；`TelemetryEvent.traceContext.traceId` 类型必填 |
| ADR-12 | prompt/model/tool/policy 版本的统一权威快照 | **OPEN** | 字段不在 `TaskOutcomeRecord` 上，仓内来源分散 |
| ADR-13 | 服务身份与 Agent 允许列表的绑定方式 | **OPEN** | 入库不校验 agentId |
| ADR-14 | 是否保留 `GET /v1/telemetry/events`；未知字段拒绝还是剥离；限体/限流具体阈值 | **OPEN** | OpenAPI 漂移；无限流无限体 |
| ADR-15 | OpenBot 侧缓冲是否自建，或等待另审合并 PR #4 后再考虑共享库 | **OPEN** | main WAL ≠ PR #4 WAL |
| ADR-16 | 将 main 或未合并 PR #4 的 WAL 当作实施前提 | **BLOCKED** | PR #4 仍 OPEN；main 实现较弱 |
| ADR-17 | 在设计批准、身份 OPEN 关闭、生产 IdP 接线之前宣称 Integration Accepted 或开始生产接入 | **BLOCKED** | P0-1 仅库级 Engineering Complete |
| ADR-18 | 用单仓 mock 或冻结状态机冒充跨仓/生产验收 | **BLOCKED** | 证据分层原则 |
| ADR-19 | 启动实施工作包或创建实现分支 | **BLOCKED** | 等待设计评审批准 |

**请负责人审批的事项（批准前不得实施对应工作包）：** ADR-03 至 ADR-06 的原则冻结；ADR-09 至 ADR-15 的开放问题；以及是否另审 PR #4 合并（非本文件授权）。

---

## 13. 证据索引（便于评审）

| 证据 | 位置 | SHA | 层级 |
| --- | --- | --- | --- |
| 无官方 Adapter | `openbot-vp` 全树检索 0 命中 | `8b83e4eb` | 已实现（缺失） |
| TaskOutcome 类型与范围 | `src/task-outcome/types.ts` | `8b83e4eb` | 已实现 |
| 文件账本 | `src/task-outcome/store.ts` `DurableTaskOutcomeStore` | `8b83e4eb` | 已实现 |
| Outbox 与确定性 eventId | `result-service.ts` `eventIdFor` / `outboxEvent` | `8b83e4eb` | 已实现 |
| 入口身份回退 | `chat-entry.ts` `scopeFromChatEntry` | `8b83e4eb` | 已实现 |
| 所有权检查 | `reject-result.ts` `callerOwnsTaskOutcome` | `8b83e4eb` | 已实现 |
| 模型证据不存 prompt | `executor-evidence/model-call-evidence.ts` | `8b83e4eb` | 已实现 |
| OTel 独立出口 | `extensions/diagnostics-otel/src/service.ts` | `8b83e4eb` | 已实现 |
| cacheTrace 默认含 prompt | `src/config/schema.help.ts` `diagnostics.cacheTrace.includePrompt` | `8b83e4eb` | 已实现（配置说明） |
| TelemetryEvent 契约 | `packages/shared-contracts/src/index.ts` | `16b01d99` | 已实现 |
| POST 入库 | `services/http-api/src/server.ts`、`telemetry-ingestion` | `16b01d99` | 已实现 + 单仓测试；main CI 46118003722 |
| 信任脱敏标志 / 无限体 | 同上 `ingest`、`readJsonBody` | `16b01d99` | 已实现缺口 |
| JWT 租户声明 | `packages/shared-contracts/src/auth.ts` | `16b01d99` | 已实现（库） |
| OIDC 库无 env 接线 | 全仓检索无生产 env | `16b01d99` | 已实现缺失 |
| main WAL | `packages/telemetry-sdk/src/index.ts` | `16b01d99` | 已实现（弱）+ 单仓测试 |
| PR #4 WAL | PR #4 源码与报告 | `8324aa2`（非 main） | 工程完成但未合并；CI 46130248496 仅证明该 SHA |
| OpenBot CI 失败 | run 46122851166 | `8b83e4eb` | CI 失败事实；日志不可读，根因不推断 |

本文件结束。提交设计冻结评审后停止；不得自行进入 Adapter 编码、PR #4 合并或生产接入。
