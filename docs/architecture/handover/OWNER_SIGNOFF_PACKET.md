# OWNER_SIGNOFF_PACKET.md

> Owner 正式签署包（T1）。本阶段只起草，**不得**代 Owner 签字。  
> 本文件中的「当前建议」「建议 APPROVE」「本阶段指令要求固化的原则」以及文档里出现的 APPROVE 字样，**一律不是**正式 `APPROVED`。  
> 截至本轮核验，仓库、PR #4–#9 评论/审查、决策登记与收口文档中，**均未发现** D-01 至 D-07 的明确书面批准或否决记录。  
> 正式决策状态因此全部保持 **`PENDING_OWNER`**。  
> 生产准入：**关闭**。本阶段未申请、未开始编码、未创建或合并 PR、未部署。

核验窗口：2026-11-28 21:43–21:50 CST（Asia/Shanghai）。  
> 刷新说明：本轮为强制刷新（相对 2026-11-28 20:12–20:18 CST 包）。OpenBot `origin/main` 已前移至 `b4e106de7562ce62d2e62057ba16864ec12a2645`（Merge PR #373，2026-11-28 21:33:19 CST）；相对 `13763b2d` 仅变更 5 个 UI 文件（i18n/brand-assets/port-shells 测试与实现），下列身份 / TaskOutcome / 投影 / ModelCallEvidence / Evolution 绑定文件 blob 与 `13763b2d`（及更早的 `f3558f2`）完全相同（`SOURCE_VERIFIED`）。AI Optimization 与 Knowledge SDK 的 `main` 未移动。PR #4–#9 状态未变；新增文档向 PR #10（OPEN，HEAD `034bf1dc844e9067e20c7d5d364dc4435b6de613`，无评论/审查，CI 46145083123 success）。PR #10 正文与评论中 **没有** D-01–D-07 正式签署，其内容对应 20:12–20:18 CST 包，本轮本地刷新 **不会** 回写该 PR。  
拟签批人 / 决策责任人：架构负责人 Yolanda Lee。  
适用范围：Phase 1 官方 Telemetry Adapter（OpenBot 出站 → AI Optimization 入库），非生产实施计划授权，非生产变更授权。

关联基线（均须按第 0 节完整 SHA 理解，不得沿用过期短 SHA 充当当前 HEAD）：

| 仓库 | `origin/main` 完整 SHA | 提交时间（CST） |
| --- | --- | --- |
| `flykingvip-cloud/ai-optimization` | `16b01d99d33b386102bb9b2b248558eb5517e245` | 2026-11-28 14:44:27 CST |
| `flykingvip-cloud/openbot-vp` | `b4e106de7562ce62d2e62057ba16864ec12a2645` | 2026-11-28 21:33:19 CST |
| `flykingvip-cloud/knowledge-sdk` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | 2026-11-25 10:10:14 CST |

标签用法（每条结论只标一个）：`GITHUB_VERIFIED`、`SOURCE_VERIFIED`、`USER_REPORTED`、`RECOMMENDATION`、`OWNER_DECISION_PENDING`。

---

## 0. 签署纪律与本轮检索结果

正式状态只允许：

- `APPROVED`：有明确 Owner 的明确批准记录。
- `REJECTED`：有明确 Owner 的明确否决记录。
- `PENDING_OWNER`：尚无正式决定。
- `NOT_IN_SCOPE`：经 Owner 明确确认不属于当前阶段。

本轮检索（`GITHUB_VERIFIED`）：

1. PR #4–#10 全部仍为 `OPEN`、`MERGEABLE`、`CLEAN`，`reviewDecision` 为空；各 PR 的 issue comments、reviews、review comments 均为空数组。
2. 未发现任何带有「批准 D-01…D-07」「APPROVED」「正式签署」且可归属 Owner 的 GitHub 书面记录。PR #10 本身声明准入仍为 `BLOCKED_PENDING_BOTH`、D-01–D-07 仍为 `PENDING_OWNER`，且「不授权合并或实施」；上传文档 PR **不是** 正式签署。
3. PR #7 仍是设计评审建议（RECOMMENDED）；PR #8 标题与正文仍为「建议稿（待审批）」；PR #9 提交说明与收口总报结论仍为 `BLOCKED_PENDING_OWNER_DECISIONS`。t20u「固化」是收口方向（`USER_REPORTED`），不是 `APPROVED` 印章。

因此，下列七项的「决策日期」均为「无（尚未签署）」。若 Owner 签署，应在本包或等效书面记录中单独填写日期、范围和签批意见，不得把本文件的建议栏改写成已批准。

下列六条是此前已被接受的产品/章程约束，**不得**当作 D-01–D-07 的正式签署替代物（`USER_REPORTED` / 既有章程，与本包待签项分开）：

1. OpenBot 是唯一 TaskOutcome 权威。
2. Adapter 不得绕过 Evolution Control。
3. AI Optimization 故障不得同步阻塞 OpenBot 主执行链。
4. Knowledge SDK 的独立 Knowledge Core 职责不变。
5. 不建立第二套 Run Ledger 或双写权威。
6. 生产准入关闭。

源码依据：`ai-optimization@16b01d99` `docs/architecture/SYSTEM_BOUNDARIES.md` 第 4–10 行（`SOURCE_VERIFIED`）。

---

## 1. D-01  Phase 1 仅允许 Enterprise Tenant 遥测

**完整决策文本（待签批）：**  
Phase 1 官方遥测出站与入库仅允许 Enterprise Tenant。Personal 范围不得通过日志、反馈、引用、附件、文件或任何间接关联进入企业遥测。禁止虚构 Personal Tenant ID，禁止用 `personalDomainId` 或 `personal:${subject}` 冒充 `tenantId`。

**当前建议（`RECOMMENDATION`，非 APPROVED）：** 建议批准上述文本作为 Phase 1 强制范围。

**支持证据：**

- OpenBot `TrustedScope` 个人分支只有 `personalDomainId` / `subjectRef` / `authzScopeRef`，**没有** `tenantId`；企业分支才有 `tenantId`（`src/task-outcome/types.ts` 63–71 行，`SOURCE_VERIFIED`，当前 `main` `b4e106de` 上该 blob 与 `13763b2d` / `f3558f2` 相同）。
- AI Optimization `TelemetryEvent.tenantId` 为必填（`packages/shared-contracts/src/index.ts` 22–28 行，`SOURCE_VERIFIED`）。这与个人 TrustedScope 无 `tenantId` 构成跨仓契约冲突，支持第一期只出站企业范围。
- `scopeFromChatEntry`：存在非空 `tenantId` 则构建 enterprise，否则构建 personal；空 `subjectRef` 会填成 `"anonymous"`（`src/task-outcome/chat-entry.ts` 47–65 行）。这是内部账本回退，不是官方 Adapter 出站身份（`SOURCE_VERIFIED`）。

**反对意见或风险：**

- 若 Phase 1 强行覆盖 Personal，必须先发明 Tenant ID，直接违反「不得虚构 Tenant ID」。
- 间接泄漏路径（企业事件 payload 引用个人会话、附件名、反馈原文、日志片段）若没有强制剥离，仅限制 `scope.kind` 仍可能串桶。
- 企业与个人在同一宿主进程并存时，过滤必须发生在出站之前，且以 OpenBot 权威范围对象为准，而不是调用方自报。

**决策责任人：** 架构负责人 Yolanda Lee。  
**正式决策状态：`PENDING_OWNER`。**  
**决策日期：** 无（尚未签署）。  
**适用范围：** Phase 1 官方 Telemetry Adapter 出站与入库。

---

## 2. D-02  禁止 anonymous/runner 作为正式遥测身份；认证失败 fail closed

**完整决策文本（待签批）：**  
禁止将 `anonymous` 或 `runner` 作为正式遥测出站或入库身份。身份认证失败、身份缺失、租户不匹配必须 fail closed。认证失败不得降级为 anonymous，不得跨租户写入。

**当前建议（`RECOMMENDATION`，非 APPROVED）：** 建议批准。内部账本回退可以继续存在，但不得出现在官方 Adapter 入口。

**支持证据：**

- runner 默认范围会使用 `subjectRef: "runner"` / `authzScopeRef: "agent-runner"`，无 tenant 时 `personalDomainId: "personal:runner"`（`src/task-outcome/runtime-from-runner.ts` 1007–1023 行，`SOURCE_VERIFIED`）。
- 当前 HTTP API 在路由前先 `authenticate`；`AuthError` 按码返回 401 或 403，认证失败路径不会调用 `ingest`（`services/http-api/src/server.ts` 33–48、51–64、113–124 行，`SOURCE_VERIFIED`）。已验证：现实现没有「认证失败降级为 anonymous 后继续写入」的分支。
- `AuthContext` 无 anonymous / runner 主体类型（`packages/shared-contracts/src/index.ts` 16–20 行，`SOURCE_VERIFIED`）。

**反对意见或风险：**

- 若出站侧把内部 `"anonymous"` / `"runner"` 直接写入 `traceContext.agentId` 或认证主体，入库即使 fail closed，仍可能先留下本地缓冲或日志泄漏。
- 无 verifier 时当前实现抛 `missing_token` 并映射为 **401**，这与「必要授权依赖不可用应返回 503」尚未对齐，见 T2。不得把该实现细节当成已批准的对外契约。

**决策责任人：** 架构负责人 Yolanda Lee。  
**正式决策状态：`PENDING_OWNER`。**  
**决策日期：** 无（尚未签署）。  
**适用范围：** Phase 1 官方出站身份与入库认证。

---

## 3. D-03  Tenant + Service Identity + Agent 绑定；Allowlist、撤销与运维责任必须明确

**完整决策文本（待签批）：**  
官方运行时遥测授权为 Tenant + Service Identity + Agent 三方绑定。必须有可验证的身份签发、Agent allowlist 的创建/更新/审核/撤销责任主体、密钥轮换与紧急撤销、缓存 TTL 与撤销传播时限。身份或授权服务不可用时不得判定为成功。撤销后拒绝新事件，已接收事件不自动删除。

**当前建议（`RECOMMENDATION`，非 APPROVED）：** 建议批准原则。在签发主体、责任人和可验证撤销机制补齐之前，**不得宣布 D-03 已解除阻塞**。

**支持证据：**

- 入库 `ingest` 只检查 `event.tenantId !== auth.tenantId` → `tenant_mismatch` → 403；**不检查** `traceContext.agentId` 是否在名单中，也不检查 Service Identity 与 Agent 绑定（`services/telemetry-ingestion/src/index.ts` 18–27 行，`SOURCE_VERIFIED`）。三方绑定控制面未落地。
- OpenBot 仓内现有 allowlist 符号（如入站深度标志、技能演进治理）**不是** Telemetry Adapter 的三方绑定表（`SOURCE_VERIFIED`，详见 `SERVICE_IDENTITY_OPERATIONAL_CLOSURE.md`）。
- 签发主体、责任人姓名/部门、生产 IdP 产品名：本轮未在仓库或 PR 中发现，保持 `OWNER_DECISION_PENDING`。禁止编造。

**反对意见或风险：**

- 没有可验证的签发/撤销机制就实施出站，等于把「任何能出示某 Tenant JWT 的调用方」当成已授权 Agent。
- 撤销若只改本地缓存而不规定传播时限，会出现「已撤销仍短暂接受新事件」的窗口；窗口长度必须由 Owner 确认。
- 责任人未指定时，紧急撤销没有可执行的值班路径。

**决策责任人：** 架构负责人 Yolanda Lee（并须由 Owner 指定签发、密钥、allowlist、撤销的执行责任人）。  
**正式决策状态：`PENDING_OWNER`。**  
**决策日期：** 无（尚未签署）。  
**适用范围：** Phase 1 官方身份、授权与撤销控制面。

---

## 4. D-04  采用 W3C Trace Context；缺失或无效时本地生成并标记；Trace ID 不得充当幂等键

**完整决策文本（待签批）：**  
官方出站与入库采用 W3C Trace Context。入站 `traceparent` 合法则传播，并使 `traceContext.traceId` 等于其 trace-id；缺失或无效时由出站侧本地生成并显式标记为 generated，不得转发非法值。Trace ID **不得**作为幂等键，也不得充当 Experiment ID。

**当前建议（`RECOMMENDATION`，非 APPROVED）：** 建议批准。

**支持证据：**

- 对端契约已有 `traceContext.traceId` / `spanId` / `parentSpanId` / `runId` 等字段（`packages/shared-contracts/src/index.ts` 33–45 行，`SOURCE_VERIFIED`），但没有 W3C `traceparent` 解析或 generated 标记字段。
- 在 OpenBot 当前 `main` `b4e106de`（相关检索范围与 `13763b2d` 相同，本轮对当前树复核）的 `*.ts` / `*.tsx` / `*.swift` / `*.kt` 中检索 `traceparent`：**无匹配**（`SOURCE_VERIFIED`）。官方出站传播尚未实现。
- 当前入库不校验 W3C `traceId` 格式（`telemetry-ingestion/src/index.ts` 18–27 行，`SOURCE_VERIFIED`）。
- 现有幂等键是独立字段 `idempotencyKey`，与 `traceId` 分离（契约 25、34 行）。建议保持并禁止用后者替代前者。

**反对意见或风险：**

- 若生成标记不进入契约，下游无法区分「继承的追踪」与「本地补造」，排障会被误导。
- 若把 Trace ID 当幂等键，一次合法重放与一次新运行可能被错误合并或错误拆分。

**决策责任人：** 架构负责人 Yolanda Lee。  
**正式决策状态：`PENDING_OWNER`。**  
**决策日期：** 无（尚未签署）。  
**适用范围：** Phase 1 官方追踪上下文与幂等边界。

---

## 5. D-05  只允许真实运行时版本快照；无法证明来源的字段标记 UNVERIFIED，不得伪造 latest/default

**完整决策文本（待签批）：**  
Version Snapshot 只允许使用该次运行的真实运行时版本。无法证明来源的字段必须标 `UNVERIFIED` 或从 Phase 1 schema/contract 中排除。禁止用仓库当前 latest、配置默认值或投影常量冒充历史运行时版本。

**当前建议（`RECOMMENDATION`，非 APPROVED）：** 建议批准原则。建议 Phase 1 **只纳入**已有可信来源的字段；其余字段明确排除或标为不可用，待补证后再扩展。字段级结论见 `VERSION_SNAPSHOT_SOURCE_EVIDENCE.md`。

**支持证据：**

- `ModelCallEvidence` 有该次调用的 `provider` / `model`，无独立 `modelVersion`（`src/executor-evidence/model-call-evidence.ts` 29–44 行，`SOURCE_VERIFIED`）。
- `PROJECTION_PROMPT_VERSION = "rule-v2"` 是会话投影规则版本，不是已证明的 Agent 模型调用 Prompt Version（`src/conversations/projection.ts` 48、147 行，`SOURCE_VERIFIED`）。
- `DEFAULT_AGENT_ID = "main"` 是 Agent id 回退，不是 Agent Version（`src/routing/session-key.ts` 19、89–106 行，`SOURCE_VERIFIED`）。
- 本轮在 `src/task-outcome` 与 `src/executor-evidence` 下确认：普通 `TaskOutcomeRecord` 仍无 `experimentId` / `agentVersion` / `toolVersion` / 运行时 `promptVersion`（`SOURCE_VERIFIED`）。相关文件 blob 在 `b4e106de` 上与 `13763b2d` / `f3558f2` 完全相同。

**反对意见或风险：**

- 若为了「报表完整」用 latest 回填，历史对比将失去证据效力。
- 部分字段已有「看起来像版本」的常量（`JUDGEMENT_POLICY_VERSION`、`rule-v2`），极易被误用；必须禁止用今天的源码常量回填旧记录。

**决策责任人：** 架构负责人 Yolanda Lee。  
**正式决策状态：`PENDING_OWNER`。**  
**决策日期：** 无（尚未签署）。  
**适用范围：** Phase 1 Version Snapshot 契约与采集。

---

## 6. D-06  正式 API、未知字段、请求体限制、速率限制、429/Retry-After 与幂等行为

**完整决策文本（待签批）：**  
必须明确正式 API（建议仅 POST `/v1/telemetry/events`）、未知字段处理、请求体上限、Tenant 与 Service Identity 维度的速率限制、超限响应及 `Retry-After`、以及幂等键的生成、作用域、保留期和冲突行为。禁止信任客户端 `redaction.applied`，禁止超限后静默截断 payload，禁止用未验证 Tenant 信息做隔离，禁止通过 GET 绕过正式身份与授权边界。

**当前建议（`RECOMMENDATION`，非 APPROVED）：** 建议批准原则。64 KiB 及本包提出的限流/保留期数字**仅为候选**，见 `TELEMETRY_API_LIMITS_DECISION.md`。确认前不得称为最终批准值。

**支持证据：**

- 实现存在 GET `/v1/telemetry/events`：认证后 `listForTenant(auth)`，无分页、无额外角色门槛、无 OpenAPI 条目（`services/http-api/src/server.ts` 67–69 行，`SOURCE_VERIFIED`）。
- `readJsonBody` 无字节上限；限流 / 429 / 413 不存在（同文件 19–26 行及全文，`SOURCE_VERIFIED`）。
- 未知字段会随 `JSON.stringify(event)` 进入 `payload_json`（`services/telemetry-ingestion/src/index.ts`，`SOURCE_VERIFIED`）。
- 入库检查 `redaction.applied` 字段存在，但没有服务端 PII 检测，等于信任客户端声明（`SOURCE_VERIFIED`）。

**反对意见或风险：**

- 过小的体上限可能拒绝合法工具观察；过大则放大未红化载荷风险。必须由 Owner 选定数字，而不是由实施者在编码时「先写一个」。
- 若继续保留未授权 GET，正式契约即使只写 POST，调用方仍可能绕过。

**决策责任人：** 架构负责人 Yolanda Lee。  
**正式决策状态：`PENDING_OWNER`。**  
**决策日期：** 无（尚未签署）。  
**适用范围：** Phase 1 正式 Adapter API 安全与容量契约。

---

## 7. D-07  OpenBot 自有、默认关闭、异步、非阻塞的本地 WAL/buffer

**完整决策文本（待签批）：**  
官方出站缓冲在 OpenBot 仓库内自有实现，默认关闭，异步且不阻塞主执行链。语义为 at-least-once（不得宣称 exactly-once），接收端以 Tenant + Idempotency Key 去重。须明确崩溃恢复、容量/背压、发送失败与磁盘失败、以及不得静默丢弃未确认事件的边界。不得将进程崩溃测试表述为断电安全证明。PR #4 不得视为 `ai-optimization` `main` 已具备的能力，也不得在未经单独授权的情况下作为 OpenBot 依赖或被合并。

**当前建议（`RECOMMENDATION`，非 APPROVED）：** 建议批准原则。PR #4 处置的三个选项及比较见 `WAL_IMPLEMENTATION_DISPOSITION.md`。本阶段建议默认方向为选项 A 或 C（不把未合并 PR #4 当作依赖）；合并 PR #4 必须另获授权。

**支持证据：**

- OpenBot 当前 `main` `@b4e106de` 仍无官方 Telemetry Adapter 出站缓冲实现（`SOURCE_VERIFIED`；本轮 diff 未触及该路径）。
- `ai-optimization` `main@16b01d99` 的 telemetry-sdk 在队列满时 `shift()` 并增加 `droppedCount`（`packages/telemetry-sdk/src/index.ts` 110–112、161–163、184–186 行，`SOURCE_VERIFIED`），不满足「未确认事件不得静默丢失」。该实现也不是 OpenBot 出站缓冲。
- PR #4 HEAD `8324aa2441145bb1c685df5c8e65694277398f84` 仍 OPEN，未合并；其文档与锁实现明确：协作式锁、非 Linux fail-closed、at-least-once、未做真实断电（`SOURCE_VERIFIED` / `GITHUB_VERIFIED`）。

**反对意见或风险：**

- 把 main 上较弱 WAL 或未合并 PR #4 直接当成 OpenBot 能力，会在故障时出现静默丢事件或错误的跨仓依赖。
- 默认开启会在未完成身份与红化之前向对端试探连接，扩大泄漏面。

**决策责任人：** 架构负责人 Yolanda Lee。  
**正式决策状态：`PENDING_OWNER`。**  
**决策日期：** 无（尚未签署）。  
**适用范围：** Phase 1 OpenBot 官方出站缓冲；PR #4 合并为单独授权事项。

---

## 8. 签署栏（留空，待 Owner 亲笔或等效书面记录）

| 决策 | 状态（仅 Owner 填写：APPROVED / REJECTED / PENDING_OWNER / NOT_IN_SCOPE） | 日期（CST） | 签批意见 |
| --- | --- | --- | --- |
| D-01 |  |  |  |
| D-02 |  |  |  |
| D-03 |  |  |  |
| D-04 |  |  |  |
| D-05 |  |  |  |
| D-06 |  |  |  |
| D-07 |  |  |  |
| PR #4 处置（A / B / C） |  |  |  |
| API 数字（体上限、限流、保留期） |  |  |  |

签署人：________________  
日期：________________ CST（Asia/Shanghai）

**本轮填写状态：全部空白。任何预填 APPROVED 均无效。**

---

## 9. 本包结论

D-01 至 D-07 **均未签署**，状态全部为 `PENDING_OWNER`（`OWNER_DECISION_PENDING`）。  
本包可以提交给 Owner 审阅，但**不具备**进入已批准 Implementation Plan 阶段的资格，更不具备开始 Adapter / WAL / 身份 / API 编码或打开生产准入的资格。
