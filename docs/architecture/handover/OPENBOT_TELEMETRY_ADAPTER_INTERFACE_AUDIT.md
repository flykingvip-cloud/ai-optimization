# OPENBOT_TELEMETRY_ADAPTER_INTERFACE_AUDIT.md

- **文档性质**：OpenBot 遥测适配器的只读接口审计与集成方案设计。这是设计与证据归档，不是适配器实现，不是跨仓联调通过证明，也不是生产准入申请。
- **授权**：负责人 Yolanda Lee 于 2026-11-28 17:33 CST（Asia/Shanghai）对「授权启动」作出确认，授权范围仅覆盖本审计与方案设计。该授权**不是** PR #4 的合并授权，**不是**跨仓代码实施授权，**不是**部署或开放生产准入的授权。
- **记录日期**：2026-11-28（Asia/Shanghai，UTC+8）。只读核验完成于 2026-11-28 17:34–17:40 CST。
- **本文件仓库与分支**：`flykingvip-cloud/ai-optimization`，独立文档分支（自当前 `origin/main` 拉出，不使用 `feat/p0-2-telemetry-wal`）。
- **生产准入**：保持关闭。
- **本轮未执行**：合并/批准/压缩 PR #4；修改 `openbot-vp`、`knowledge-sdk` 或其他仓库代码；为实现适配器、P0-3 跨仓 E2E、P0-4 PostgreSQL、生产 IdP 接线、部署、流量切换或生产数据库变更而提交代码；把 OpenBot 生产执行设计为依赖 AI Optimization 可用性。

前期交接文件（`AGENT_HANDOVER_BASELINE_AUDIT.md`、`PHASE0_EXECUTION_PLAN.md`、`P0_1_MERGED_MAIN_BASELINE.md`、未合并 PR #4 上的 `TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md`）仅作上下文。下列结论均对照当前源码、测试与 CI 独立核验，不以先前回档为充分证据。

---

## 1. 活 SHA 核验（相对 Phase 0 冻结）

Phase 0 冻结记录于 2026-11-27。2026-11-28 17:34 CST 起通过 GitHub API 与独立 checkout 复核默认分支 HEAD。短 SHA `25b6613e6` 在 `flykingvip-cloud/openbot-vp` 上再次不可解析（HTTP 422：`No commit found for SHA: 25b6613e6`），本文件不对其作猜测。

| 仓库 | 默认分支 | Phase 0 冻结 SHA | 本轮活 SHA | 是否移动 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `flykingvip-cloud/ai-optimization` | `main` | 合并 PR #3 后的 `16b01d99d33b386102bb9b2b248558eb5517e245` | `16b01d99d33b386102bb9b2b248558eb5517e245`（提交说明：`Merge pull request #3 from flykingvip-cloud/docs/p0-1-merged-main-baseline`，提交时间 2026-11-28 14:44:27 CST） | **未移动** | 本审计以该 SHA 为 AI Optimization 消费/契约侧源码。CI run [46118003722](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46118003722)（`push` / `CI`）success，完成于 2026-11-28 14:44:43 CST，**仅证明**该 SHA。 |
| `flykingvip-cloud/openbot-vp` | `main` | `d20d7f7cd45199da0b68d9623336d4e69c999223`（`Merge pull request #354`） | `8b83e4eba9b4eec5532046481ca98259c3bcf1d6`（`Merge pull request #365 from flykingvip-cloud/codex/openbot/v21-wave2-space-acl-pre02-pr-ready`，提交时间 2026-11-28 15:47:57 CST） | **已移动** | 本审计以当前 `main` 为源，并引用冻结 SHA 作对比。自冻结以来可见 Knowledge Space ACL / PRE-02、recovery-send 统一、多项治理文档与依赖钉扎等合入。在当前 HEAD 与冻结 SHA 之间，**仍未出现**指向 AI Optimization 或官方遥测出站适配器的文件。 |
| `flykingvip-cloud/knowledge-sdk` | `main` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | `b953c9922cc1096e0e88455dab6746c01a9d27f9`（`fix(ci): give HTTPError fixtures closeable bodies on Python 3.9`，提交时间 2026-11-25 10:10:14 CST） | **未移动** | 仅作边界核验。Wave2 SHA `9940818b…` 依既有授权仍不纳入本审计实施范围。OpenBot 知识适配器注释中将该 pin 引为 Wave2 路由依据，见第 4.3 节，不扩展为 Wave2 验收。 |

相关但非本分支源码：

- PR #4（https://github.com/flykingvip-cloud/ai-optimization/pull/4）在本轮核验时仍为 **OPEN、未合并**，HEAD `8324aa2441145bb1c685df5c8e65694277398f84`。P0-2 Engineering Complete 已冻结于该 HEAD，对应 CI run [46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496)（success，2026-11-28 17:23:44 CST）。该工作**尚未进入** `origin/main`。本文件不合并、不批准该 PR。
- GitHub 记录的 PR #4 base SHA 仍为分支建立时的 `c5779f20c8f9011396cd0aea299f8c2b9cd9e240`，与当前 `origin/main` `16b01d99…` 的 merge-base 一致；PR 状态为 `MERGEABLE` / `CLEAN`。这不构成合并授权。

---

## 2. 架构约束（本方案必须遵守）

下列约束来自现行章程与边界文件，并在当前源码中得到对应（或明确缺失）的印证：

1. OpenBot 拥有生产执行、`TaskOutcome`、运行时诊断、Canary / Rollback。AI Optimization 不可用时，OpenBot 必须仍能执行。见 `docs/architecture/AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md` 与 `docs/architecture/SYSTEM_BOUNDARIES.md`（`ai-optimization@16b01d99`）。
2. Knowledge SDK 拥有知识资产、ACL、检索与 Evidence。不得把这些职责迁入 OpenBot 或 AI Optimization。
3. AI Optimization 拥有评测、数据集、实验和已签名 Optimization Artifacts。
4. 禁止双写权威数据。不得把 `TaskOutcome` 复制成 AI Optimization 中的第二套账本。
5. 不得绕过 Evolution Control。不得自动变更生产 Prompt、Model Router、Agent Policy 或 Tool Policy。未签名、未批准的制品不得进入生产。
6. 遥测必须异步、脱敏、限流且可恢复。P0-2 WAL 是 AI Optimization 侧的可恢复性工程件：在 PR #4 上为 Engineering Complete，但**仍未合并**，因而**不在**当前 `origin/main` 的 `telemetry-sdk` 中。

---

## 3. 现存接口

### 3.1 OpenBot（`openbot-vp@8b83e4eb`）— 生产执行与结果权威在，官方 AI Optimization 适配器不在

在当前 `main` 全树检索 `ai-optimization`、`AI Optimization`、`ai_optimization`、`aioptimization`、`OptimizationArtifact`、`BoundedTelemetry`、`/v1/telemetry`、`flykingvip-cloud/ai-optimization`：**命中数为 0**。因此，当前 OpenBot **没有**官方 AI Optimization Adapter，也**没有**指向 AI Optimization 的生产遥测出站实现。该结论与冻结 SHA `d20d7f7` 时的已知状态一致；仓库虽然已前进，但并未补上这条集成缝。

与本审计相关、但**不是** AI Optimization 出站口的现有表面：

| 表面 | 路径 | 作用 | 与本适配器的关系 |
| --- | --- | --- | --- |
| `TaskOutcome` 权威账本 | `src/task-outcome/types.ts`（`TaskOutcomeRecord`，`TASK_OUTCOME_SCHEMA_VERSION = "1.0.0"`）；`src/task-outcome/store.ts`（文件持久化，`atomicWriteJson` + `fsync` + `rename`）；入口适配器如 `src/task-outcome/entrypoints/chat.ts` | OpenBot 内部任务终态、生命周期、验收与投递门禁 | 这是运行结果 SoT。可以向 AI Optimization **投递脱敏摘要事件**，但不得在对端重建账本。 |
| 内部结果事件 | `src/task-outcome/types.ts` 中 `OutcomeEventType`：`task.created` / `task.state_changed` / `task.closed` / `task.corrected` | OpenBot 内部 outbox / 消费者 | 与 AI Optimization 的 `TelemetryEventType` **不是同一套事件名**，目前没有映射实现。 |
| Evolution Control | `src/gateway/evolution-control/`，含 `task-outcome-binding.ts`、`control-plane.ts`、各类 domain adapter（skill / capsule / working-dna / organization 等） | 生产审批、shadow、canary、promote、rollback | 这是 OpenBot 治理面，不是 AI Optimization 遥测适配器。任何未来制品消费必须经过此面，本方案不得绕过。 |
| 观测 / 诊断 | `src/observation/`（如 `outcome-reader.ts`、`execution-evidence-store.ts`）；`extensions/diagnostics-otel/` | 平台内观察与可选 OpenTelemetry 导出 | OTel 是通用观测后端，配置说明见 `src/config/schema.help.ts`（默认应保持关闭，除非采集端点与鉴权已配置）。它**不是** AI Optimization `/v1/telemetry/events` 客户端。 |
| Knowledge SDK 适配器（非本目标） | `src/knowledge/adapter/client.ts`、`config.ts`；默认 `OPENBOT_KNOWLEDGE_SDK_V2_ENABLED === "true"` 才启用，且 `environment === "production"` 时客户端直接拒绝（`SDK_PATH_DISABLED`） | 对 Knowledge SDK 的受控调用 | 可作为「默认关闭、超时、生产拒绝、故障 fail-closed」的既有模式参考，但其对象是知识面，不是 AI Optimization。注释将 Wave2 路由 pin 到 `9940818b`，该 pin 仍超出本审计授权。 |

OpenBot 持久化现状（独立核验，纠正可能的混用）：

- `TaskOutcome` 权威存储是**文件账本**，不是 PostgreSQL，也不是 AI Optimization 的 `CORE_MIGRATIONS`。
- 多处子系统使用 `node:sqlite`（`DatabaseSync`），例如 `src/memory/`、`src/conversation-task/store.ts`、知识索引相关路径。这是 OpenBot 自己的 SQLite 用法。
- 仓库中存在 Postgres 相关设计/演练与可选迁移材料（如 `packages/cogniweave-sdk/src/migration/local-to-postgres.ts`、`.kiro/specs/postgres-growth-migration-sre`），**不能**据此宣称 OpenBot 生产 `TaskOutcome` 已迁移到 PostgreSQL。

### 3.2 AI Optimization（`ai-optimization@16b01d99`）— 消费契约与入库面已存在，生产接线与官方生产端客户端缺失

契约与服务（均在当前 `main`）：

| 表面 | 路径 | 现状 |
| --- | --- | --- |
| 事件类型与 `TelemetryEvent` | `packages/shared-contracts/src/index.ts` | `schemaVersion: "1.0.0"`。`source.system` 仅为 `"openbot" \| "ai-optimization"`。事件包括 `runtime.run.*`、`runtime.model.called`、`runtime.tool.called`、`runtime.task_outcome.recorded`、`runtime.feedback.recorded` 以及评测/实验/制品/部署类事件。强制字段含 `eventId`、`idempotencyKey`、`tenantId`、`traceContext.runId`、`redaction`。 |
| JSON Schema / 目录 | `contracts/json-schema/telemetry-event.schema.json`、`task-outcome-event.schema.json`、`optimization-artifact.schema.json`；`contracts/events/event-catalog.md` | 目录写明：`runtime.task_outcome.recorded` 是「`TaskOutcome` 终态摘要副本（OpenBot 为唯一权威）」。`task-outcome-event.schema.json` 只保留摘要字段（`taskId`、`runId`、`outcomeVersion`、`lifecycle`、`taskJudgement`、`decidedAt` 等），**不是**完整 `TaskOutcomeRecord`。 |
| OpenAPI | `contracts/openapi/ai-optimization-v1.yaml` | 声明 `POST /v1/telemetry/events`（202 Accepted，bearer）。同时声明了数据集、评测作业、制品注册/bundle/撤销、release-request 等路径。 |
| HTTP 实现 | `services/http-api/src/server.ts` | **已实现**：`POST /v1/telemetry/events`（202 / 400 / 403）、`GET /v1/telemetry/events`、`POST /v1/datasets/...`、`POST /v1/evaluations/rules`、`GET /v1/artifacts/:id/bundle`、`POST /v1/artifacts/:id/revocations`。鉴权经 `OidcJwksClient.verifyAuthorization` 或静态 `verifyJwtAuth`；未配置验证器则失败。`createOptimizationHttpServer` 目前只被测试引用，仓库内**没有**生产启动/环境变量装配入口。 |
| 入库 | `services/telemetry-ingestion/src/index.ts` | 校验 `eventId`、`idempotencyKey`、`traceContext.runId`、租户一致、`redaction.applied`。按 `(tenant_id, idempotency_key)` 去重（SQLite `INSERT OR IGNORE` 或内存 `Set`）。不阻塞调用方线程模型以外的逻辑，但调用本身是同步入库。 |
| 生产者 SDK（在本仓，尚未被 OpenBot 引用） | `packages/telemetry-sdk/src/index.ts` | `BoundedTelemetryClient`：有界内存队列（默认 `maxQueueItems=10000`）、可选 WAL、payload 白名单脱敏（`REDACTION_POLICY_VERSION = "1.1.0"`）、`flush()` 失败回队列。这是**本仓 main 上的较弱 WAL**（见第 6 节），不是已合并的 P0-2 实现。 |
| 制品注册 | `services/artifact-registry/src/index.ts` | Ed25519 签名与撤销。OpenBot 当前源码中**没有**对应的制品校验/消费客户端。 |
| 持久化 | `packages/shared-contracts/src/db.ts` | `CORE_MIGRATIONS` **v1**，`node:sqlite`（`DatabaseSync`），表包括 `telemetry_events`（`UNIQUE (tenant_id, idempotency_key)`）。这是 AI Optimization 自己的库，不是 OpenBot 的 `TaskOutcome` 存储，也不是已验收的 PostgreSQL。 |
| OIDC/JWKS 库 | `packages/shared-contracts/src/oidc-jwks.ts`、`auth.ts` | P0-1 已在 `main`（Engineering Complete）。全仓检索 `OIDC_ISSUER`、`JWKS_HOST`、`ALLOWED_JWKS`、`AI_OPTIMIZATION_ISSUER` 及 `process.env.(OIDC|JWKS|AI_OPT|ISSUER)`：**无生产环境变量接线**。 |

OpenAPI 与 HTTP 实现之间存在漂移：例如 OpenAPI 声明的部分数据集/评测作业/制品注册/release-request 路径在 `server.ts` 中未实现；反之，实现中的 `GET /v1/telemetry/events` 未出现在 OpenAPI `paths` 中。这是契约缺口，不是已完成的官方适配器。

### 3.3 Knowledge SDK（`knowledge-sdk@b953c992`，仅边界）

Evidence 与 ACL 的权威类型位于 Knowledge SDK：`src/knowledge_sdk/contracts/anchors.py`（`EvidenceAnchor`）、`packs.py`（`EvidencePack`）、`issues.py`（`EvidenceIssue`），以及可选 `postgres_store.py` / `sqlite_store.py`。本轮不把 Knowledge SDK 的职责设计进遥测适配器，也不把 Wave2 实施纳入范围。

---

## 4. 权威归属（Source of Truth）

| 对象 | 权威仓与位置 | AI Optimization 允许持有的形态 | 禁止 |
| --- | --- | --- | --- |
| `TaskOutcome` | OpenBot `src/task-outcome/types.ts` + `store.ts` | 经授权的脱敏摘要事件（目录中的 `runtime.task_outcome.recorded` / `task-outcome-event.schema.json`） | 在 AI Optimization 重建或双写完整账本；用摘要覆盖 OpenBot 判断 |
| 运行时诊断 / 原始 trace | OpenBot `src/observation/`、诊断与 OTel 插件 | 可选、已脱敏、已限流的遥测字段（白名单 payload） | 把未脱敏原文、密钥、完整工具输出作为评测输入 |
| Evolution Control 决策与生产变更 | OpenBot `src/gateway/evolution-control/` | 可消费「部署/回滚已完成」类事件（目录中由 OpenBot 生产） | 由 AI Optimization 直接改 Prompt / Router / Policy；绕过审批与 canary |
| Evidence / ACL / 知识资产 | Knowledge SDK 契约与存储 | 无（本适配器不运输知识权威对象） | 把 Evidence 所有权迁入 OpenBot 或 AI Optimization |
| `TelemetryEvent` 消费副本 | AI Optimization `TelemetryIngestionService` + `telemetry_events` 表 | 以 `idempotencyKey` 去重的异步副本 | 把该副本当作运行结果权威 |
| Optimization Artifacts | AI Optimization `OptimizationArtifact` + `ArtifactRegistryService` | 签发、存储、撤销已签名制品 | 未签名/未批准制品进入生产；OpenBot 在 Evolution Control 之外自动应用 |
| 数据集与评测 | AI Optimization `DatasetCase` / `EvaluationResult` 及相应服务 | 评测与实验权威 | 用 OpenBot 在线日志替代已治理数据集 |

---

## 5. 若 AI Optimization 不可用，OpenBot 如何继续执行

**当前事实：** OpenBot 运行路径上不存在对 AI Optimization 的调用，因此 **今天** AI Optimization 宕机不会阻塞 OpenBot 执行。这是「尚未集成」带来的隔离，不是已经落地的官方适配器隔离保证。

**方案要求（设计，非本轮实现）：**

1. 官方适配器必须位于执行主路径之外：enqueue 必须在超时预算内完成（或退化为丢弃并审计），不得把 HTTP/OIDC/WAL 失败向上抛到 Task 执行、Gateway 响应或 Evolution Control 决策。
2. 默认关闭（explicit opt-in）。未授权、未配置 issuer/audience/allowlist/出口 URL 时，适配器必须 no-op，且不得改变 `TaskOutcome` 写入。
3. 出站使用短超时、有界队列、明确丢弃策略与本地可恢复缓冲；AI Optimization 返回 5xx/超时/认证失败时只影响遥测管道。
4. OpenBot 继续作为 `TaskOutcome`、诊断和 canary/rollback 的权威。AI Optimization 恢复后只能按 `idempotencyKey` 补送已缓冲的脱敏事件，不得回放或改写 OpenBot 账本。
5. 禁止把 AI Optimization 健康检查设计成 OpenBot 就绪探活的硬依赖，也禁止在适配器故障时 fail-stop 生产执行。

可参考但不可照搬的既有模式：Knowledge SDK 适配器在未启用、生产环境或租户不在白名单时抛 `SDK_PATH_DISABLED`，并对请求使用 `AbortSignal.timeout`。遥测适配器应更进一步：**失败必须对执行面静默隔离**（记录指标后丢弃或缓存在侧路），而不是让调用方变成失败源。

---

## 6. 身份、脱敏、限流、背压与可恢复性缺口

### 6.1 身份

- AI Optimization `main` 具备 OIDC Discovery + JWKS 客户端与 HTTP bearer 校验（P0-1 Engineering Complete）。
- **缺失**：生产 issuer / audience / JWKS host allowlist 的环境变量接线；真实生产 IdP；OpenBot 侧服务身份与令牌获取；租户绑定到该服务身份的明确契约。本仓测试与 localhost/mock IdP **不得**写成生产 IdP 或 Integration Accepted。
- OpenBot 当前没有面向 AI Optimization 的认证客户端。Knowledge SDK 适配器使用 HMAC 与独立环境变量，那是另一条信任边界，不能复用为本适配器的生产身份方案。

### 6.2 脱敏

- AI Optimization SDK 在 enqueue 时把 payload 收敛到白名单字段并做密钥/邮箱类替换，同时把 `redaction.applied` 置为 true。
- 入库侧只检查 `redaction.applied` 标志，**不**重复执行白名单校验。恶意或缺陷生产者只要置位即可过关。这是消费侧缺口。
- OpenBot 尚无针对 `TelemetryEvent` 的对等脱敏实现。未来映射时必须只发送摘要字段，不得把完整 `TaskOutcomeRecord`、对话原文或 Evidence 正文放入 payload。

### 6.3 限流与背压

- SDK 有队列上限与 WAL 字节上限，溢出时丢弃最旧事件。这是进程内有界缓冲，**不是**对端 HTTP 限流。
- `services/http-api/src/server.ts` 无 429、无请求体大小上限（`readJsonBody` 读至结束）、无按租户速率限制。OpenAPI 也未定义限流语义。
- 没有跨进程/跨实例的协调背压信号。

### 6.4 可恢复性（务必区分 main 与未合并的 P0-2）

当前 `origin/main` 的 `packages/telemetry-sdk/src/index.ts`：

- 使用 `${wal}.tmp.${pid}` 写入、`fsync` 文件、`rename` 覆盖；
- **没有**排他锁、**没有**父目录 `fsync`、**没有** cleanup sentinel；
- 初始化/写入错误被吞掉并只增加 `walWriteErrorCount`；
- `flush()` 在发送成功后立刻记 `exportedCount` 再 persist，崩溃窗口语义弱于 P0-2。

P0-2（PR #4 HEAD `8324aa2`，Engineering Complete，**未合并**）补齐了锁、sentinel、目录读取 fail-closed 等工程项，但仍：**未做真实断电**；语义仍是 at-least-once；下游必须按 `idempotencyKey` 去重；Linux 抽象套接字是协作式锁而非对 WAL 文件的内核 flock。即使未来获单独授权合并，也不能把 P0-2 写成断电通过或 exactly-once。

本方案不得把 main 上的 WAL 描述为已满足生产可恢复性。

---

## 7. 测试与 CI 证据（已有 vs 缺口）

**AI Optimization `main`（`16b01d99`）：**

- 仓库内测试文件（`tests/**/*.test.ts`）共 8 个，覆盖契约、安全/鉴权、Phase1 e2e、WAL 性能/持久化（**main 上的旧 WAL 行为**）、M4 沙箱与 OIDC/JWKS 库测试。这些测试证明本仓契约与库行为，**不证明** OpenBot 已出站，也不证明真实 IdP 或生产接线。
- GitHub CI：run [46118003722](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46118003722) 对 `16b01d99` 为 success（2026-11-28 14:44:43 CST）。工作流为 `.github/workflows/ci.yml` 的 `verify`（typecheck、`pnpm run test`、audit、密钥扫描）。
- **缺口**：不存在跨仓适配器测试；不存在「OpenBot 执行在 AI Optimization 宕机时不受阻」的官方适配器隔离测试；P0-2 的崩溃恢复与目录读取故障注入测试仅在未合并 PR #4 上，不在 `main`。

**OpenBot `main`（`8b83e4eb`）：**

- 存在大量 `TaskOutcome`、Evolution Control、Knowledge 适配器隔离测试（例如 `src/knowledge/adapter/outage.integration.test.ts` 声明 “A06 actual stopped service fails closed”）。这些测试不覆盖 AI Optimization 出站，因为该出站代码不存在。
- 对当前 HEAD 的 GitHub Actions 记录为失败或被跳过：例如 CI run [46122851166](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46122851166)（`push`，conclusion `failure`；失败 job 包括 `docs-scope`、`secrets`；其余多数 job 为 `skipped`）。同一 SHA 上 CI Gate、Workflow Sanity、Install Smoke、Memory Workspace Freeze、Docker Release、Delivery SoT alignment 等亦为 failure。本轮尝试读取失败 job 日志时遇到 404 / `BlobNotFound`，**不能如实复述失败根因**。该项列为未核实项，不得把当前 `openbot-vp` `main` 写成 CI 全绿。

**本轮未发明测试，也未弱化任何现有测试。**

---

## 8. 即使日后实施，仍会阻断 Integration Accepted 的风险

在另行授权实施官方适配器之后，若下列项未关闭，仍不得将 Integration Accepted 或 Production Accepted 标为通过：

1. 真实生产（或指定非生产联调）IdP 未完成；issuer / audience / allowlist 未在运行配置中接线；OpenBot 服务令牌未发放或未验证。
2. 官方适配器未在 OpenBot 合入，或合入后仍可能阻塞执行主路径。
3. P0-2 仍未获合并授权，或合并后仍把 main 旧 WAL 当成生产可恢复性证据。
4. 出现第二套 `TaskOutcome` 账本，或把完整记录而非摘要作为遥测 payload。
5. 绕过 Evolution Control，或把未签名制品送入生产。
6. 未在真实（非生产）PostgreSQL 上完成 P0-4，却把 `node:sqlite` 结论写成生产持久化通过。
7. 把沙箱、localhost、仓库 CI 或 mock IdP 写成生产验收。
8. OpenBot 与 AI Optimization 的事件名/字段映射未冻结，或 OpenAPI 与 HTTP 实现仍明显漂移。
9. 对端无限流、无请求体上限，导致联调或生产入口不具备可运营背压。
10. 依赖一条当前无法核验为全绿的 OpenBot `main` CI 通道作为「集成已通过」的唯一证明，而不重新固定 SHA 并取得可复核证据。

---

## 9. 集成方案设计（仅设计，不实施）

### 9.1 推荐的官方 Adapter 分工

**OpenBot 暴露（生产者、执行面隔离）：**

- 新增官方「Telemetry Egress Adapter」接口（名称可在实施授权时确定），默认关闭。
- 职责：从 OpenBot 内部 `TaskOutcome` / run / model / tool / feedback 钩子收集**已经存在的终态或摘要**，映射为 `TelemetryEvent`（及必要时的 `task-outcome-event` 摘要），执行脱敏，投入有界异步队列，由后台 flusher 以短超时调用 AI Optimization `POST /v1/telemetry/events`。
- 不得在 adapter 内实现评测、数据集、制品签发、知识检索或 Evolution Control。
- 不得引入「同步等待 AI Optimization」的执行依赖。建议进程内接口形如 `enqueue(event): void`（失败只记指标），禁止 `await send()` 出现在 Gateway/Task 完成路径上。

**AI Optimization 消费（已有雏形，需在实施阶段补齐运营缺口）：**

- 继续以 `TelemetryEvent` + `POST /v1/telemetry/events` + `TelemetryIngestionService` 为唯一遥测入口。
- 实施阶段应：对齐 OpenAPI 与实现；入库侧重复校验脱敏/白名单而非只信任标志位；增加请求体上限与按租户限流；通过显式运行装配（而非仅测试注入）接入 P0-1 OIDC 客户端。
- 保留 `idempotencyKey` 去重。消费副本永远不是 `TaskOutcome` 权威。

**SDK 放置：** 不建议让 OpenBot 运行时硬依赖 AI Optimization 仓库的可变内部实现。优先在契约（JSON Schema / OpenAPI / 事件目录）上冻结，OpenBot 侧实现自己的非阻塞客户端；若日后共享库，必须单独授权、版本钉扎，且共享库故障不得阻断执行。P0-2 加强后的 WAL 若要用于 OpenBot 侧缓冲，同样需要单独授权，不得在未合并前假定可用。

### 9.2 失败隔离与异步/脱敏/限流/恢复路径

```
OpenBot 执行主路径 ──写入──► TaskOutcome 文件账本（权威，必须成功/失败与遥测无关）
        │
        └── 旁路 enqueue（默认关闭 / 超时 / 永不抛回主路径）
                    │
                    ▼
            本地有界队列 + 可选本地 WAL/缓冲
            （脱敏后的 TelemetryEvent；溢出 drop-oldest + 审计）
                    │
                    ▼  后台 flush，短超时，指数退避，熔断
            AI Optimization POST /v1/telemetry/events
            （OIDC bearer；202 幂等；4xx 按原因丢弃或隔离；5xx 回缓冲）
                    │
                    ▼
            telemetry_events 消费副本（按 tenant+idempotencyKey 去重）
```

丢弃策略需分级：普通过程事件可丢；`runtime.task_outcome.recorded` 摘要应尽量保留，但仍不得为了保遥测而阻塞或回滚 OpenBot 已提交的 `TaskOutcome`。

### 9.3 P0-1 与未合并 P0-2 如何接入本方案

- **P0-1**：作为消费侧验签库已经在 `origin/main`。集成仍缺生产环境变量接线与真实 IdP。没有这项，适配器最多在沙箱中用显式测试密钥验证形状，不能进入 Integration Accepted。
- **P0-2**：是 AI Optimization 侧 WAL 工程完成项，仍停在 PR #4。未合并前，不得把 `main` 的 `BoundedTelemetryClient` 当成已关闭的可恢复性缺口。是否合并 PR #4 必须另获授权；本方案即使假设未来合并，也只把它当作 AI Optimization 进程本地 WAL，不能替代「OpenBot 出站失败不得影响执行」的隔离要求。

### 9.4 建议的后续授权序列（全部另批，本轮不开始）

1. 独立审批是否合并 PR #4（P0-2）。不批准则继续把 main WAL 视为未完成的可恢复性工程项。
2. 独立审批 OpenBot 官方遥测适配器的**实现**（含默认关闭、非阻塞、映射表、隔离测试）。不得同时夹带制品自动应用或 Evolution Control 行为变更。
3. 独立审批 P0-1 生产/联调环境接线与真实 IdP（issuer、audience、allowlist、OpenBot 服务身份）。
4. 独立审批 P0-3：真实状态机 / Evolution Control 跨仓 E2E，并固定 SHA 与可复核 CI 通道。须区分四级证据（A 状态机函数测试、B Adapter 集成、C Evolution Control 沙箱、D 生产），通过 A 或 B 不得写成 D。
5. 独立审批 P0-4：在非生产、非生产数据的 PostgreSQL 上验证 AI Optimization 持久化。禁止把现有 `node:sqlite` 结论写成 PostgreSQL 已通过。

在上述审计完成且各自获得独立授权前，不实施跨仓代码变更。本文件不启动其中任何一项。

### 9.5 明确的授权门禁

| 门禁 | 本阶段结论 |
| --- | --- |
| 本设计文档（接口审计 + 方案） | 完成后只作为后续独立审批的依据。**不**把适配器标为 Engineering Complete。 |
| 适配器 Engineering Complete | **未达到。** 尚未实施。 |
| Integration Accepted | **未达到。** 无官方出站、无真实 IdP 接线、无跨仓联调。 |
| Production Accepted | **未达到。** 生产准入保持关闭。 |
| PR #4 合并 | **未授权。** P0-2 Engineering Complete 已冻结，但合并须另批。 |

---

## 10. 残留风险与未核实项

残留风险：

1. **未进行真实断电测试**（含 P0-2 已声明的限制）。
2. 遥测交付语义即使在未来实现后仍应视为 **at-least-once**，不是 exactly-once；下游必须按 `idempotencyKey` 去重。
3. Linux 抽象套接字锁（P0-2）是协作式锁，不是 WAL 文件上的内核 flock；且该实现尚未进入 `main`。
4. 真实生产 IdP、PostgreSQL、OpenBot 官方适配器与 Evolution Control 跨仓联调均尚未验收。
5. OpenAPI 与 HTTP 实现漂移；入库侧过于信任 `redaction.applied`；HTTP 入口缺少限流与请求体上限。
6. 若错误地把 AI Optimization 可用性纳入 OpenBot 就绪条件，将违反「OpenBot 生产执行不得依赖 AI Optimization」的硬约束。

未核实项（不编造）：

1. 短 SHA `25b6613e6` 在 `openbot-vp` 上仍不可解析。
2. 当前 `openbot-vp` `main`（`8b83e4eb`）上多个 GitHub workflow 结论为 failure，但本轮无法读取失败 job 日志（API 404 / `BlobNotFound`），因此不记录具体失败根因，也不把该 SHA 的 CI 写成通过。
3. 本轮未重新执行 `ai-optimization` 或 `openbot-vp` 的本地测试套件；AI Optimization `main` 的测试结论引用的是与 `16b01d99` 对应的 GitHub CI run 46118003722，属于该提交的 CI 执行记录。
4. Knowledge SDK Wave2（`9940818b…`）未纳入源码审计范围；OpenBot 注释中的 pin 只作边界说明。

---

## 11. 本轮未执行与工作区隔离

- 未合并、批准或压缩 PR #4；未改动 `/workspace/repos/ai-optimization-p0-2` 或 `feat/p0-2-telemetry-wal`。
- 未修改 `openbot-vp`、`knowledge-sdk` 或其他仓库代码，未向这些仓库推送或开 PR。`openbot-vp` 与 `knowledge-sdk` 仅只读 clone/fetch。
- 未实施适配器，未开始 P0-3 / P0-4，未部署，未访问生产，未开放生产准入。
- 未使用既有 PR #3 worktree（`/workspace/repos/ai-optimization`）或 P0-2 worktree 作为本文件的提交工作区。本文件在自 `origin/main` 拉出的独立文档工作区中编写。
