# OWNER_DECISION_REQUEST.md

> **后续指引（不改变下文作为「签署前请求」的性质）：** 2026-11-28 22:50 CST，Owner Yolanda Lee 已对决策控件（答复 t26s6）中的七条原则原文作出正式 `APPROVE`。正式签署记录见同目录 `OWNER_DECISION_RECORD.md` 与 `OWNER_DECISION_STATUS_MATRIX.md`。**本文件仍是签署前的请求原文，不得把下文的建议文本、完整待签批表述或空白签署栏理解为该次已签署范围。**已批准范围以记录文件中的控件原文为限。


> Owner 正式决策请求（指令 2）。  
> **本文件是请求，不是已作出的决定记录。**  
> 核验窗口：2026-11-28 22:39–22:41 CST（Asia/Shanghai）。  
> 决策文本忠实于既有签署包 `/workspace/owner-signoff/docs/architecture/handover/OWNER_SIGNOFF_PACKET.md`（21:43–21:50 CST 刷新稿，亦见于 [PR #10](https://github.com/flykingvip-cloud/ai-optimization/pull/10) HEAD `0b3f8727f65934da2821a14515d90209d74a8fce`）。本轮不发明新的架构立场。  
> t26u 执行令、既有建议、t20u「固化」、文档 PR、CI 成功或沉默，**一律不得**解释为 `APPROVE` 或 `REJECT`。

拟请签批人 / 决策责任人：架构负责人 Yolanda Lee。  
适用范围：Phase 1 官方 Telemetry Adapter（OpenBot 出站 → AI Optimization 入库）。本请求**不**构成实施计划批准，也**不**打开生产准入。

本轮检索（`GITHUB_VERIFIED`）：PR #4–#10 均仍开放、未合并，且 issue comments / reviews / review comments 均为空。未发现可归属 Owner 的 D-01 至 D-07 书面批准或否决。因此下列七项正式状态全部保持 **`PENDING_OWNER`**，签署栏全部留空，须待后续带有决策人身份、`APPROVE` 或 `REJECT`、决定时间与依据的明确书面答复后再填写。

请求的动作：请对每一项明确选择 **`APPROVE`** 或 **`REJECT`**。若决策文本需要改写后才能决定，可先退回修订稿（`REVISE`），但修订本身仍不是签署；正式状态在新文本被再次明确批准或否决之前，继续为 `PENDING_OWNER`。拒绝项必须同时给出替代方案。

当前建议一律标注为 **建议 / 非正式决定**（`RECOMMENDATION`）。

下列六条是此前已被接受的产品/章程约束，**不得**当作 D-01–D-07 的签署替代物（`USER_REPORTED` / 既有章程）：

1. OpenBot 是唯一 TaskOutcome 权威。  
2. Adapter 不得绕过 Evolution Control。  
3. AI Optimization 故障不得同步阻塞 OpenBot 主执行链。  
4. Knowledge SDK 的独立 Knowledge Core 职责不变。  
5. 不建立第二套 Run Ledger 或双写权威。  
6. 生产准入关闭。

源码依据：`ai-optimization@16b01d99d33b386102bb9b2b248558eb5517e245` `docs/architecture/SYSTEM_BOUNDARIES.md` 第 4–10 行（上一包 `SOURCE_VERIFIED`；本轮该仓 `main` 未移动）。

关联基线（本轮新鲜核验，`GITHUB_VERIFIED`）：

| 仓库 | `origin/main` 完整 SHA | 提交时间（CST） |
| --- | --- | --- |
| `flykingvip-cloud/ai-optimization` | `16b01d99d33b386102bb9b2b248558eb5517e245` | 2026-11-28 14:44:27 CST |
| `flykingvip-cloud/openbot-vp` | `b10ad59bf6205edaa1566847cfa1685e1283c8af` | 2026-11-28 22:30:03 CST |
| `flykingvip-cloud/knowledge-sdk` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | 2026-11-25 10:10:14 CST |

OpenBot 相对上一包 `b4e106de7562ce62d2e62057ba16864ec12a2645` 仅增加 UI 浏览器测试（PR #374–#376），身份 / 遥测 / WAL / Adapter 路径未出现在 diff 中。下列源码指针沿用上一包已复核位置，并以当前 SHA 的路径未变为前提。

---

## D-01  Enterprise-only 遥测边界

**完整决策文本（待签批）：**  
Phase 1 官方遥测出站与入库仅允许 Enterprise Tenant。Personal 范围不得通过日志、反馈、引用、附件、文件或任何间接关联进入企业遥测。禁止虚构 Personal Tenant ID，禁止用 `personalDomainId` 或 `personal:${subject}` 冒充 `tenantId`。

**当前建议（建议 / 非正式决定，非 APPROVE）：** 建议批准上述文本作为 Phase 1 强制范围。

**支持证据指针：**

- OpenBot `TrustedScope` 个人分支只有 `personalDomainId` / `subjectRef` / `authzScopeRef`，没有 `tenantId`；企业分支才有 `tenantId`（`src/task-outcome/types.ts` 63–71 行，上一包 `SOURCE_VERIFIED`）。  
- AI Optimization `TelemetryEvent.tenantId` 为必填（`packages/shared-contracts/src/index.ts` 22–28 行，`SOURCE_VERIFIED`，`main@16b01d99`）。  
- 详见 [PR #10](https://github.com/flykingvip-cloud/ai-optimization/pull/10) `OWNER_SIGNOFF_PACKET.md`、`VERSION_SNAPSHOT_SOURCE_EVIDENCE.md`。

**反对意见或风险：**

- 若 Phase 1 强行覆盖 Personal，必须先发明 Tenant ID，直接违反「不得虚构 Tenant ID」。  
- 间接泄漏路径（企业事件引用个人会话、附件名、反馈原文、日志片段）若没有强制剥离，仅限制 `scope.kind` 仍可能串桶。  
- 过滤必须发生在出站之前，且以 OpenBot 权威范围对象为准，而不是调用方自报。

**请 Owner 选择：** `APPROVE` 或 `REJECT`（如需改写文本可先 `REVISE`，修订不等于签署）。

| 待 Owner 填写 | 内容 |
| --- | --- |
| 决策人 |  |
| 决定（APPROVE / REJECT） |  |
| 决定时间（CST，Asia/Shanghai） |  |
| 依据 |  |
| 若 REJECT：替代方案 |  |

**正式决策状态：`PENDING_OWNER`。**

---

## D-02  用户身份与匿名/Runner 禁止规则

**完整决策文本（待签批）：**  
禁止将 `anonymous` 或 `runner` 作为正式遥测出站或入库身份。身份认证失败、身份缺失、租户不匹配必须 fail closed。认证失败不得降级为 anonymous，不得跨租户写入。

**当前建议（建议 / 非正式决定，非 APPROVE）：** 建议批准。内部账本回退可以继续存在，但不得出现在官方 Adapter 入口。

**支持证据指针：**

- runner 默认范围使用 `subjectRef: "runner"` / `authzScopeRef: "agent-runner"`，无 tenant 时 `personalDomainId: "personal:runner"`（`src/task-outcome/runtime-from-runner.ts` 1007–1023 行，上一包 `SOURCE_VERIFIED`）。  
- 当前 HTTP API 在路由前先 `authenticate`；认证失败路径不会调用 `ingest`（`services/http-api/src/server.ts` 33–48、51–64、113–124 行，`SOURCE_VERIFIED`）。  
- 详见 PR #10 `OWNER_SIGNOFF_PACKET.md`、`SERVICE_IDENTITY_OPERATIONAL_CLOSURE.md`。

**反对意见或风险：**

- 若出站侧把内部 `"anonymous"` / `"runner"` 写入 `traceContext.agentId` 或认证主体，入库即使 fail closed，仍可能先留下本地缓冲或日志泄漏。  
- 无 verifier 时当前实现映射为 401，与「必要授权依赖不可用应返回 503」尚未对齐，不得把该实现细节当成已批准的对外契约。

**请 Owner 选择：** `APPROVE` 或 `REJECT`（如需改写文本可先 `REVISE`）。

| 待 Owner 填写 | 内容 |
| --- | --- |
| 决策人 |  |
| 决定（APPROVE / REJECT） |  |
| 决定时间（CST，Asia/Shanghai） |  |
| 依据 |  |
| 若 REJECT：替代方案 |  |

**正式决策状态：`PENDING_OWNER`。**

---

## D-03  Tenant、Service Identity、Agent 绑定

**完整决策文本（待签批）：**  
官方运行时遥测授权为 Tenant + Service Identity + Agent 三方绑定。必须有可验证的身份签发、Agent allowlist 的创建/更新/审核/撤销责任主体、密钥轮换与紧急撤销、缓存 TTL 与撤销传播时限。身份或授权服务不可用时不得判定为成功。撤销后拒绝新事件，已接收事件不自动删除。

**当前建议（建议 / 非正式决定，非 APPROVE）：** 建议批准原则。在签发主体、责任人和可验证撤销机制补齐之前，**不得宣布 D-03 已解除阻塞**。

**支持证据指针：**

- 入库 `ingest` 只检查 `event.tenantId !== auth.tenantId`，不检查 Agent allowlist，也不检查 Service Identity 与 Agent 绑定（`services/telemetry-ingestion/src/index.ts` 18–27 行，`SOURCE_VERIFIED`）。  
- 仓内其他 allowlist 符号不是 Telemetry Adapter 三方绑定表。签发主体与责任人姓名/部门本轮仍未发现，禁止编造（`OWNER_DECISION_PENDING`）。  
- 详见 PR #10 `SERVICE_IDENTITY_OPERATIONAL_CLOSURE.md`。

**反对意见或风险：**

- 没有可验证的签发/撤销机制就实施出站，等于把「任何能出示某 Tenant JWT 的调用方」当成已授权 Agent。  
- 撤销若只改本地缓存而不规定传播时限，会出现已撤销仍短暂接受新事件的窗口。  
- 责任人未指定时，紧急撤销没有可执行的值班路径。

**请 Owner 选择：** `APPROVE` 或 `REJECT`（如需改写文本可先 `REVISE`）。若批准原则，仍须另行指定下文「待指定运维事项」中的责任主体与时限，否则 D-03 技术阻塞不能视为已解除。

| 待 Owner 填写 | 内容 |
| --- | --- |
| 决策人 |  |
| 决定（APPROVE / REJECT） |  |
| 决定时间（CST，Asia/Shanghai） |  |
| 依据 |  |
| 若 REJECT：替代方案 |  |

**正式决策状态：`PENDING_OWNER`。**

---

## D-04  W3C Trace Context

**完整决策文本（待签批）：**  
官方出站与入库采用 W3C Trace Context。入站 `traceparent` 合法则传播，并使 `traceContext.traceId` 等于其 trace-id；缺失或无效时由出站侧本地生成并显式标记为 generated，不得转发非法值。Trace ID **不得**作为幂等键，也不得充当 Experiment ID。

**当前建议（建议 / 非正式决定，非 APPROVE）：** 建议批准。

**支持证据指针：**

- 对端契约已有 `traceContext.traceId` / `spanId` / `parentSpanId` / `runId` 等字段（`packages/shared-contracts/src/index.ts` 33–45 行，`SOURCE_VERIFIED`），但没有 W3C `traceparent` 解析或 generated 标记字段。  
- 上一包在当时 `main` 的 `*.ts` / `*.tsx` / `*.swift` / `*.kt` 中检索 `traceparent`：**无匹配**（`SOURCE_VERIFIED`）。本轮 OpenBot `main` 漂移未触及相关实现路径。  
- 现有幂等键是独立字段 `idempotencyKey`，与 `traceId` 分离（契约 25、34 行）。  
- 详见 PR #10 `OWNER_SIGNOFF_PACKET.md`、`VERSION_SNAPSHOT_SOURCE_EVIDENCE.md`、`TELEMETRY_API_LIMITS_DECISION.md`。

**反对意见或风险：**

- 若生成标记不进入契约，下游无法区分继承的追踪与本地补造。  
- 若把 Trace ID 当幂等键，一次合法重放与一次新运行可能被错误合并或错误拆分。

**请 Owner 选择：** `APPROVE` 或 `REJECT`（如需改写文本可先 `REVISE`）。

| 待 Owner 填写 | 内容 |
| --- | --- |
| 决策人 |  |
| 决定（APPROVE / REJECT） |  |
| 决定时间（CST，Asia/Shanghai） |  |
| 依据 |  |
| 若 REJECT：替代方案 |  |

**正式决策状态：`PENDING_OWNER`。**

---

## D-05  运行时版本快照来源

**完整决策文本（待签批）：**  
Version Snapshot 只允许使用该次运行的真实运行时版本。无法证明来源的字段必须标 `UNVERIFIED` 或从 Phase 1 schema/contract 中排除。禁止用仓库当前 latest、配置默认值或投影常量冒充历史运行时版本。

**当前建议（建议 / 非正式决定，非 APPROVE）：** 建议批准原则。建议 Phase 1 **只纳入**已有可信来源的字段；其余字段明确排除或标为不可用，待补证后再扩展。字段级结论见 PR #10 `VERSION_SNAPSHOT_SOURCE_EVIDENCE.md`。

**支持证据指针：**

- `ModelCallEvidence` 有该次调用的 `provider` / `model`，无独立 `modelVersion`（`src/executor-evidence/model-call-evidence.ts` 29–44 行）。  
- `PROJECTION_PROMPT_VERSION = "rule-v2"` 是会话投影规则版本，不是已证明的 Agent 模型调用 Prompt Version（`src/conversations/projection.ts` 48、147 行）。  
- `DEFAULT_AGENT_ID = "main"` 是 Agent id 回退，不是 Agent Version（`src/routing/session-key.ts` 19、89–106 行）。  
- 普通 `TaskOutcomeRecord` 仍无 `experimentId` / `agentVersion` / `toolVersion` / 运行时 `promptVersion`。以上均为上一包 `SOURCE_VERIFIED`；本轮相关路径未出现在 OpenBot `main` diff 中。

**反对意见或风险：**

- 若为了「报表完整」用 latest 回填，历史对比将失去证据效力。  
- 部分字段已有「看起来像版本」的常量（`JUDGEMENT_POLICY_VERSION`、`rule-v2`），极易被误用。

**请 Owner 选择：** `APPROVE` 或 `REJECT`（如需改写文本可先 `REVISE`）。若批准原则，请同时确认 Phase 1 纳入/排除清单（或退回修订）。

| 待 Owner 填写 | 内容 |
| --- | --- |
| 决策人 |  |
| 决定（APPROVE / REJECT） |  |
| 决定时间（CST，Asia/Shanghai） |  |
| 依据 |  |
| 若 REJECT：替代方案 |  |

**正式决策状态：`PENDING_OWNER`。**

---

## D-06  Telemetry API、安全限制与字段策略

**完整决策文本（待签批）：**  
必须明确正式 API（建议仅 POST `/v1/telemetry/events`）、未知字段处理、请求体上限、Tenant 与 Service Identity 维度的速率限制、超限响应及 `Retry-After`、以及幂等键的生成、作用域、保留期和冲突行为。禁止信任客户端 `redaction.applied`，禁止超限后静默截断 payload，禁止用未验证 Tenant 信息做隔离，禁止通过 GET 绕过正式身份与授权边界。

**当前建议（建议 / 非正式决定，非 APPROVE）：** 建议批准原则。下列数字**仅为候选**，确认前不得称为最终批准值（详见 PR #10 `TELEMETRY_API_LIMITS_DECISION.md`）：

- 最大请求体：**65536 字节（64 KiB）**，按未解码原始请求体计量；超限 **413**，禁止静默截断。  
- Tenant 维限流：已验证 `auth.tenantId` 平均 20 请求/秒，突发 40，窗口 1 秒。  
- Service Identity 维限流：已验证服务主体平均 10 请求/秒，突发 20，窗口 1 秒。  
- 限流响应：**429**，候选 `Retry-After: 1`。  
- 未知字段：丢弃且不持久化。  
- 幂等作用域：已验证 Tenant ID + Idempotency Key；候选保留期 24 小时；同键不同载荷建议 **409**。  
- 正式路由建议仅 POST `/v1/telemetry/events`；现实现中未文档化的 GET 不得纳入官方契约。

**支持证据指针：**

- GET `/v1/telemetry/events` 实现存在且无 OpenAPI 条目（`services/http-api/src/server.ts` 67–69 行）。  
- `readJsonBody` 无字节上限；限流 / 429 / 413 不存在（同文件 19–26 行及全文）。  
- 未知字段会随事件对象进入 `payload_json`；入库信任客户端 `redaction.applied` 存在性，无服务端 PII 检测（`services/telemetry-ingestion/src/index.ts`，`SOURCE_VERIFIED`，`main@16b01d99`）。

**反对意见或风险：**

- 过小的体上限可能拒绝合法工具观察；过大则放大未红化载荷风险。必须由 Owner 选定数字。  
- 若继续保留未授权 GET，正式契约即使只写 POST，调用方仍可能绕过。

**请 Owner 选择：** `APPROVE` 或 `REJECT`（如需改写文本可先 `REVISE`）。若批准原则，请同时批准或改写上述候选数值；64 KiB 与限流数字在未单独确认前仍不是已批准限制。

| 待 Owner 填写 | 内容 |
| --- | --- |
| 决策人 |  |
| 决定（APPROVE / REJECT） |  |
| 决定时间（CST，Asia/Shanghai） |  |
| 依据 |  |
| 若 REJECT：替代方案 |  |
| 若 APPROVE：确认的体上限 / 限流 / 保留期数值（或写明改用何值） |  |

**正式决策状态：`PENDING_OWNER`。**

---

## D-07  OpenBot 本地异步 WAL 方案

**完整决策文本（待签批）：**  
官方出站缓冲在 OpenBot 仓库内自有实现，默认关闭，异步且不阻塞主执行链。语义为 at-least-once（不得宣称 exactly-once），接收端以 Tenant + Idempotency Key 去重。须明确崩溃恢复、容量/背压、发送失败与磁盘失败、以及不得静默丢弃未确认事件的边界。不得将进程崩溃测试表述为断电安全证明。PR #4 不得视为 `ai-optimization` `main` 已具备的能力，也不得在未经单独授权的情况下作为 OpenBot 依赖或被合并。

**当前建议（建议 / 非正式决定，非 APPROVE）：** 建议批准原则。PR #4 处置不是本条自动结论，须单独选择；合并 PR #4 必须另获授权。选项摘要（决策上下文，**不是**已选定处置，详见 PR #10 `WAL_IMPLEMENTATION_DISPOSITION.md`）：

- **A.** 保持 PR #4 `OPEN`，作为后续参考，不进入主干。  
- **B.** 经单独验收后合并 PR #4，作为 AI Optimization 共享 WAL；合并不会自动形成 OpenBot 出站缓冲。  
- **C.** 在 OpenBot 仓库内独立实现，PR #4 不作为依赖（可对照其测试经验，但须在本仓重新取证）。  

本阶段架构建议方向为 **C** 作为 OpenBot 官方出站默认路径，并以 **A** 保留 PR #4 作对照；若未来强化 SDK 自身 WAL，再单独评审 **B**。该方向仍是建议，不是批准。

**支持证据指针：**

- OpenBot 当前 `main@b10ad59` 仍无官方 Telemetry Adapter 出站缓冲实现（本轮 diff 相对 `b4e106de` 仅 UI 测试，`SOURCE_VERIFIED`）。  
- `ai-optimization` `main@16b01d99` 的 telemetry-sdk 在队列满时 `shift()` 并增加 `droppedCount`（`packages/telemetry-sdk/src/index.ts` 110–112、161–163、184–186 行），不满足「未确认事件不得静默丢失」。  
- PR #4 HEAD `8324aa2441145bb1c685df5c8e65694277398f84` 仍 OPEN，未合并；协作式锁、非 Linux fail-closed、at-least-once、未做真实断电（`SOURCE_VERIFIED` / `GITHUB_VERIFIED`）。

**反对意见或风险：**

- 把 `main` 上较弱 WAL 或未合并 PR #4 直接当成 OpenBot 能力，会在故障时静默丢事件或形成错误的跨仓依赖。  
- 默认开启会在未完成身份与红化之前向对端试探连接，扩大泄漏面。  
- 进程崩溃 / SIGKILL 测试不是断电安全证明。

**请 Owner 选择：** `APPROVE` 或 `REJECT`（如需改写文本可先 `REVISE`）。PR #4 的 A/B/C 请在下方运维事项中单独表态；即使批准 D-07 原则，也不等于批准合并 PR #4。

| 待 Owner 填写 | 内容 |
| --- | --- |
| 决策人 |  |
| 决定（APPROVE / REJECT） |  |
| 决定时间（CST，Asia/Shanghai） |  |
| 依据 |  |
| 若 REJECT：替代方案 |  |
| PR #4 处置意向（A / B / C，可稍后单独授权；B 的合并仍须另一次明确授权） |  |

**正式决策状态：`PENDING_OWNER`。**

---

## 待指定的运维与配套事项

以下事项在相关决策若获 `APPROVE` 后仍须由 Owner 指定或确认。本轮**不编造**人名、部门、产品名或未批准数字。当前全部为 `OWNER_DECISION_PENDING`。

| 事项 | 依赖 | 现状 | 请 Owner 指定或确认 |
| --- | --- | --- | --- |
| Service Identity 签发主体及系统 | D-03 | 未指定 | 唯一签发方与系统名称 |
| 密钥持有、轮换、紧急撤销责任人及流程 | D-03 | 无已验证流程 | 持有人、轮换窗口、紧急撤销值班路径 |
| Agent allowlist 创建 / 更新 / 审核 / 撤销责任人 | D-03 | 未指定 | 各动作的责任主体，禁止用空泛建议冒充已指定 |
| Allowlist 缓存 TTL、刷新策略、撤销传播时限 | D-03 | 无批准值；文档中 30 秒 TTL / 60 秒传播仅为候选 | 批准或改写数值与 SLA |
| 401 / 403 / 503 对外细则 | D-02 / D-03 | 有实现事实与建议，未签批 | 确认对外契约 |
| 新事件拒绝 vs 已接收事件保留 | D-03 | 原则建议已写，未签批 | 与 D-03 一并确认 |
| API 数字：体上限、双维限流、Retry-After、幂等保留期 | D-06 | 64 KiB 及限流/保留期均为候选 | 逐项确认或给出替代数值 |
| 正式 API 是否排除 GET、未知字段丢弃、服务端红化策略名 | D-06 | 原则建议，未签批 | 确认或改写 |
| PR #4 WAL 处置 A / B / C | D-07 | 未选择；合并须单独授权 | 选择处置；若选 B，另发合并授权 |
| 跨仓库验收最小可执行集，以及是否必须真实 IdP / 真实 OpenBot runtime / Knowledge SDK 实例 | 全项，尤其 T6 十四项 | 矩阵已起草，**均未执行** | 确认最小可启动集与责任仓 |

---

## 本请求的效力

- 本文件提交给 Owner 审阅后，在收到带有决策人身份、`APPROVE` 或 `REJECT`、决定时间与依据的明确书面答复之前，D-01 至 D-07 **全部保持 `PENDING_OWNER`**。  
- 本请求本身、本目录的本地文件、以及未来如将本请求上传到文档 PR，都**不是**签署。  
- 在七项正式决定、阻塞性技术证据、跨仓验收责任与对最终 Implementation Plan 的单独批准同时满足之前，准入状态保持 `BLOCKED_PENDING_BOTH`，`ADAPTER_CODING = NOT_AUTHORIZED`，生产准入关闭。
