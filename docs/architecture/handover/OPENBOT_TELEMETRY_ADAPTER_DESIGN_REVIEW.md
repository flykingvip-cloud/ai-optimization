# OPENBOT_TELEMETRY_ADAPTER_DESIGN_REVIEW.md

> 架构设计评审报告（只评审，不实施）。报告中的建议 **不等于** 负责人批准。未经后续明确授权，不得将建议转化为代码、配置、合并或实施工作包。不得把 RECOMMENDED 自动升为 APPROVED。

- 授权：Yolanda Lee，2026-11-28 18:03 CST（Asia/Shanghai），「OpenBot Telemetry Adapter 设计评审与 OPEN 项裁决」。
- 范围：独立审查 PR #6 设计冻结文档与当前源码证据，对 OPEN 项给出可批准的决策建议，并评估实施准入条件。
- 本轮未执行：实现 Adapter；修改任何仓库的业务代码、测试、Schema 或 API；改动 `openbot-vp` / `knowledge-sdk`；合并、批准或压缩 PR #4 / #5 / #6；创建实现分支或启动工作包；连接生产 IdP / PostgreSQL / 生产环境；部署、迁移或切流；擅自关闭 OPEN 项或批准实施。生产准入保持关闭。

状态标签仅使用以下含义：

- **APPROVED**：存在明确授权或负责人已接受的既有正式原则。本报告不为新的 Tenant / 身份 / API / WAL 选择使用此标签。
- **RECOMMENDED**：本评审推荐，尚未获批准。
- **OPEN**：尚未作出决策。
- **BLOCKED**：缺少必要前提，不得实施。

---

## 1. 审计基线及 SHA

活基线于 2026-11-28 18:04:27 CST（Asia/Shanghai）重读 GitHub。**发现一处相对参考表的漂移：`openbot-vp` `main` 已前进。** 其余对象与参考表一致。本报告先记录差异，再按当前源码继续评审；不沿用过期 SHA 作为“当前 main”结论。

| 对象 | 参考表 | 本轮 GitHub 实况 | 漂移 |
| --- | --- | --- | --- |
| `ai-optimization` `main` | `16b01d99d33b386102bb9b2b248558eb5517e245` | 同 SHA。提交：`Merge pull request #3 …`，提交时间 2026-11-28 14:44:27 CST。 | 无 |
| `openbot-vp` `main` | `8b83e4eba9b4eec5532046481ca98259c3bcf1d6` | **已变为** `f3558f2ccd24a1020dff8a378721786b3071f641`。提交：`Merge pull request #369 from flykingvip-cloud/codex/openbot-t1-ui-boundary`，提交时间 2026-11-28 17:54:38 CST。parents：`8b83e4eb…` 与 `a8efc341…`。相对 `8b83e4eb` ahead 3、behind 0。变更文件仅 `scripts/ui.js`、`test/scripts/ui.test.ts`（UI 边界，非身份/TaskOutcome/遥测路径）。 | **有。身份与遥测相关源码与 `8b83e4eb` 字节级一致（已用 `git diff` 核验）。PR #6 对该路径的源码引用在当前 main 仍成立，但“当前 main SHA”必须改为 `f3558f2`。** |
| `knowledge-sdk` `main` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | 同 SHA。仅边界参考。 | 无 |
| PR #4 | HEAD `8324aa2441145bb1c685df5c8e65694277398f84`，OPEN | 同 SHA，`state=OPEN`，`mergedAt=null`。其 WAL **不是** `main` 已有能力，也不得作为默认实施依赖。 | 无 |
| PR #5 | HEAD `74e75fbd0fcf26a648a4c80b24d7de9eb81bfbf6`，OPEN | 同 SHA，`state=OPEN`，`mergedAt=null`。仅作先前审计上下文，不是当前代码证明。 | 无 |
| PR #6 | HEAD `1ec34cca26deeb24d6fd54abcf3f2375e4b9ba7b`，OPEN | 同 SHA，`state=OPEN`，`mergedAt=null`。设计正文 `507392bbe62b20334ec954baec9b4ff5ac7089a5`。最终 CI run [46132975388](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46132975388) success 于 17:59:32 CST，**仅证明 `1ec34cc`**。正文 CI 46132861267 **仅证明 `507392b`**。 | 无 |
| OpenBot CI（参考 run） | 46122851166 在 `8b83e4eb` 失败；日志当时不可读 | 再次核验：conclusion `failure`。再次读取失败 job 日志仍为 HTTP 404 / `BlobNotFound`。**只记录失败事实，不推断根因。** | 无新日志证据 |
| OpenBot CI（当前 main） | 无（main 已前进） | `f3558f2` 上 CI Gate run [46132661254](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661254) conclusion `failure`（17:59:19 CST）；失败 job 名为 `delivery guard`（140941040719）。本轮未能以可读文本取得该 job 日志（工具返回需转义序列，未作为证据展开）。Workflow `CI` run [46132661255](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661255) 在 18:04 CST 重读时仍为 `in_progress`。**只记录状态，不推断根因。** | 新事实，根因未确认 |
| 短 SHA `25b6613e6` | 不可解析 | 再次 422：`No commit found for SHA: 25b6613e6`。不作猜测。 | 无 |

本报告对 OpenBot 身份/TaskOutcome/遥测相关结论，同时标注设计冻结基线 `8b83e4eb` 与当前 `main` `f3558f2`（该路径无差异）。对 AI Optimization 消费/契约侧结论针对 `16b01d99`。引用 PR #4 代码时一律标明「未合并，非 main，非默认依赖」。

证据分层保持：已实现 ≠ 测试覆盖 ≠ CI 验证 ≠ 跨仓库验证 ≠ 生产验证。本阶段最多产生评审建议，不提升 Engineering Complete / Integration Accepted / Production Accepted，也不申请 Adapter 实施授权。

---

## 2. PR #6 设计冻结文档评审结果

评审对象：[`OPENBOT_TELEMETRY_ADAPTER_DESIGN_FREEZE.md`](https://github.com/flykingvip-cloud/ai-optimization/blob/1ec34cca26deeb24d6fd54abcf3f2375e4b9ba7b/docs/architecture/handover/OPENBOT_TELEMETRY_ADAPTER_DESIGN_FREEZE.md) @ `1ec34cc`（正文 @ `507392b`）。本轮对冻结文档中的关键引用做了独立源码复核，不以 PR #5 / PR #6 叙述替代源码。

### 2.1 予以维持的结论（与源码/章程一致）

- 当前两仓 **没有** 已落地的官方 Telemetry Adapter。在 `openbot-vp@f3558f2`（同 `8b83e4eb`）全树检索仍无对 AI Optimization 的官方出站客户端。此为「已实现（缺失）」，不是跨仓或生产验证。
- OpenBot 是 `TaskOutcomeRecord` 的唯一权威（`src/task-outcome/types.ts`、`DurableTaskOutcomeStore`）；内部 `OutcomeOutboxEvent` 不是 AI Optimization `TelemetryEvent`。AI Optimization 仅有 `telemetry_events` 副本表。不得把 TaskOutcome 改造成对端账本。**APPROVED**（既有章程：`docs/architecture/SYSTEM_BOUNDARIES.md` 第 4、8 行；冻结文档 ADR-01）。
- 不得绕过 Evolution Control；本 Adapter 范围不含制品应用。**APPROVED**（章程第 4–9 行；冻结 ADR-07）。
- AI Optimization 故障不得同步阻塞 OpenBot。**APPROVED**（章程第 10 行：“严禁 OpenBot 同步阻塞等待 AI Optimization”）。官方适配器“默认关闭、异步旁路、七条故障隔离”的 **实现方案** 仍是冻结文档的 PROPOSED，本评审维持为 **RECOMMENDED**，不升为 APPROVED。
- 生产准入关闭；P0-1 OIDC/JWKS 在 `16b01d99` 仅为库，全仓 `packages/` 与 `services/` 无 `process.env` 生产接线。不得称 Integration / Production Accepted。**APPROVED**（既有门禁与本轮授权）。
- PR #4 WAL（`8324aa2`：锁、sentinel、`listTmpFiles` fail-closed、dir fsync）**不是** main 能力。main `BoundedTelemetryClient`（`packages/telemetry-sdk/src/index.ts`）为 tmp+fsync+rename，恢复与写入错误多处空 `catch`，无锁/sentinel。冻结文档对此区分正确，应维持。
- 入站缺口描述与源码一致：`TelemetryIngestionService.ingest` 第 25–26 行只检查 `redaction.applied`；`readJsonBody`（`services/http-api/src/server.ts` 第 19–26 行）无上限；无限流；OpenAPI `contracts/openapi/ai-optimization-v1.yaml` 对 `/v1/telemetry/events` 仅声明 `post`，HTTP 另实现 `GET`（`server.ts` 第 67–69 行）。
- 身份张力描述成立：`scopeFromChatEntry` 在空 `subjectRef` 时回退 `"anonymous"`（`chat-entry.ts` 第 48 行）；`defaultScope` 使用 `subjectRef: "runner"`（`runtime-from-runner.ts` 第 1007–1023 行）；对端 `auth.ts` 第 98–100 行要求 `sub` 与 `tenantId`。
- 决策标签使用大体正确；未把未验证能力写成已完成；九个工作包仅设计拆解。这些应维持。

### 2.2 评审补充与需要纠正的理解（不改冻结原文，记录在本报告）

- 冻结文档写「个人范围无 tenantId」是对的，但不够完整：个人范围 **已有** `personalDomainId`（`TrustedScope`，`types.ts` 第 63–64 行）。现行入口会把它合成为 `personal:${subject}`（含 `personal:anonymous`、`personal:runner`）。这是 OpenBot 内部隔离键，**不是** 已签发的 Tenant ID，不得为满足对端 API 而写入 `TelemetryEvent.tenantId`。
- HTTP 入库在认证失败时抛 `AuthError` 并返回 401/403（`server.ts` 第 113–124 行），**当前 HTTP 层没有**“认证失败后降级为 anonymous 继续写入”。匿名风险主要在 OpenBot **出站前** 的 scope 回退，以及若未来适配器把合成的 `personalDomainId` 当成租户。评审必须堵住出站侧，而不是误报对端已有匿名降级写入。
- `BoundedTelemetryClient.enqueue`（main 第 152–159 行）在本地 `sanitizeTelemetryPayload` 后把 `redaction.applied` 设为 `true`。即使将来复用该客户端，对端仍不得把该标志当作独立脱敏证明。
- 冻结文档审计时 OpenBot `main` 仍为 `8b83e4eb`。当前 `main` 已到 `f3558f2`；与本 Adapter 相关的源码路径未变，但后续实施必须以活 SHA 再核一次。
- 冻结文档将 ADR-09–15 标为 OPEN 是正确的；本报告给出 **RECOMMENDED** 方案，但 **不关闭** 这些 OPEN，也不将其标为 APPROVED。

### 2.3 对冻结文档总体评价

PR #6 作为设计基线可以进入架构评审：契约分层清楚，权威边界与章程一致，证据可追溯。它 **尚未** 给出可实施的身份与 API 决策。在负责人明确批准本报告所列事项之前，实施准入条件不满足。

---

## 3. 七类 OPEN 项逐项评审

下列每项包含：源码事实、位置、设计冲突、至少两个可行方案、推荐与理由、风险、批准人、是否阻塞实施。建议均为 **RECOMMENDED**，除非标明仍为 OPEN 或 BLOCKED。

### 3.A Personal TrustedScope 与 Tenant 映射

**（1）当前源码事实**

- OpenBot `TrustedScope` 是判别联合类型：个人分支 **没有** `tenantId` 字段，而有 `personalDomainId`、`subjectRef`、`authzScopeRef`；企业分支有 `enterpriseDomainId`、`tenantId`、`subjectRef`、`authzScopeRef`（`openbot-vp` `src/task-outcome/types.ts` 第 63–71 行，`f3558f2` / `8b83e4eb` 相同）。
- `scopeFromChatEntry`：若 `tenantId` 非空则构建 enterprise，`enterpriseDomainId = enterprise:${tid}`；否则构建 personal，`personalDomainId = personal:${subject}`，且 `subject = subjectRef.trim() || "anonymous"`（`chat-entry.ts` 第 47–65 行）。
- `scopeIdOf` 对个人返回 `personalDomainId`，对企业返回 `enterpriseDomainId`（`transitions.ts` 第 14–15 行）。内部 outbox 只带 `scopeKind` + `scopeId`，不带对端 `tenantId`（`types.ts` `OutcomeOutboxEvent` 第 221–229 行）。
- `callerOwnsTaskOutcome`：企业要求 caller 的 `tenantId` 与 scope 一致；个人只校验 `subjectRef`（`reject-result.ts` 第 39–51 行）。这说明个人隔离的权威维度是 subject，不是租户。
- AI Optimization `TelemetryEvent.tenantId` 与 `AuthContext.tenantId` 均为必填 `string`（`packages/shared-contracts/src/index.ts` 第 16–28 行）。`verifyJwtAuth` 缺少 `sub` 或 `tenantId` 即失败（`auth.ts` 第 98–100 行）。`ingest` 要求 `event.tenantId === auth.tenantId`（`telemetry-ingestion` 第 22–23 行）。

**（2）相关文件与位置：** 见上，SHA `f3558f2` / `16b01d99`。

**（3）现有设计冲突**

- 个人 TrustedScope 合法地没有 `tenantId`，对端契约却强制要求 `tenantId`。若适配器把 `personal:${subject}` 填进 `tenantId`，就是“为满足当前 API 而虚构 Tenant ID”，违反本轮禁令，并可能把匿名/runner 合成域变成跨主体租户桶。
- 企业员工的 Personal Space 若被写入该员工所在 `enterprise.tenantId`，则企业管理员/操作者可通过 `GET /v1/telemetry/events` 的租户列表（`listForTenant`，无角色细分）读取个人内容，造成管理员权限、个人内容与租户隔离的冲突。
- 独立个人用户与企业员工个人空间在 OpenBot 中都是 `kind: "personal"`，源码并未再分两种 Tenant。

**（4）可行方案（至少两个）**

- **方案 A（推荐，失败封闭）：** 承认个人 TrustedScope **可以且应当** 没有 Tenant ID。官方适配器 **第一期只接受企业范围** 事件。个人范围、以及任何缺少已验证 `tenantId` 的事件，**不出站、不入库**。不在适配器里合成 Personal Tenant。若未来需要个人遥测，必须由 IdP/控制面 **预配** 真正的个人租户或等价隔离分区，再另审扩约；不得在发送时发明 ID。
- **方案 B：** 扩展对端契约，增加一等字段 `scopeKind: personal | enterprise`。企业：强制已验证 `tenantId`。个人：强制已验证 `subjectId`，**禁止** `tenantId`；存储与限流按 `(scopeKind, subjectId)` 分区，而不是伪造租户。`personalDomainId` 仅可作 OpenBot 内部引用，不得自动成为 Tenant。企业员工 Personal Space 与独立个人用户采用 **同一** 个人分区模型，且不得落入企业租户桶。
- **方案 C（不推荐）：** 用 `personal:${subject}` 或哈希值冒充 `tenantId` 以兼容当前 API。这是虚构 Tenant，拒绝采用。

**（5）推荐及理由**

推荐 **方案 A 作为实施第一期**，同时把方案 B 列为后续扩约候选，而不是现在发明租户。理由：不破坏现行企业租户校验；不虚构 ID；避免个人数据进入企业租户列表；生产尚无真实数据，但契约一旦写错修复成本高。Token 建议（企业第一期）：`sub`（Service Identity 或用户主体）、`principalType`、`tenantId`（仅企业，来自 IdP 而非 body）、可选 `scopeKind=enterprise`。个人扩约若获批，Token 应显式 `scopeKind=personal`，**省略** `tenantId`，并以 IdP 签发的 `sub` 为隔离键。

企业员工 Personal Space 与独立个人用户：第一期均不送入企业租户遥测。若采用方案 B，二者同属个人分区，隔离键是已验证主体，而不是其雇主 `tenantId`。企业管理员角色 **不得** 默认读取个人分区。

**（6）风险：** 方案 A 会推迟个人场景的优化闭环（兼容/产品）。方案 B 需要改 `AuthContext` / OpenAPI / 入库 UNIQUE 维度，属于实施阶段另审的契约变更。方案 C 有跨主体污染与权限提升风险。迁移：当前无生产数据（生产准入关闭）；单仓测试假设“必有 tenantId”，实施时需同步测试，但仍不得称为生产迁移。

**（7）批准人：** 架构负责人（Yolanda Lee）。

**（8）阻塞实施：** **是。** 在批准前不得编写把个人范围映射为租户的代码。

剩余 OPEN：若批准方案 A，个人遥测何时以及是否升级到方案 B，仍待另审；IdP 是否将来预配“个人租户”本轮不臆造。

### 3.B anonymous / runner 身份策略

**（1）当前源码事实**

- `scopeFromChatEntry`：空 `subjectRef` → `"anonymous"`，并可生成 `personalDomainId: personal:anonymous`（`chat-entry.ts` 第 47–65 行）。这是 TaskOutcome 入口回退，不是遥测出站。
- `defaultScope`：无 `tenantId` 时为 `{ kind: "personal", personalDomainId: "personal:runner", subjectRef: "runner", authzScopeRef: "agent-runner" }`；有 `tenantId` 时为企业，但 `subjectRef` 仍为 `"runner"`（`runtime-from-runner.ts` 第 1007–1023 行）。
- HTTP `authenticate` 在未配置校验器时抛 `missing_token`；失败不继续 `ingest`（`server.ts` 第 33–48、113–124 行）。对端 **没有** 认证失败降级为 anonymous 写入。`principalType` 仅 `user` | `service`（`auth.ts` 第 102–121 行），无 anonymous 主体类型。
- `normalizeAgentId` 在非法输入时可能回退到 `DEFAULT_AGENT_ID = "main"`（`session-key.ts` 第 19、89–105 行）。若出站误用该函数，存在把未知 Agent 写成 `main` 的风险。

**（2）（3）冲突：** 内部账本允许 anonymous/runner 回退，以便本地任务继续；官方遥测若沿用同一回退，就会把未认证或非主体身份送入对端，甚至在 runner + 传入 tenantId 时写入企业桶。这与“缺失或无效身份不得降级为匿名跨租户接收”“认证失败不得自动降级为 anonymous 并继续跨租户写入”冲突。

**（4）方案**

- **方案 A（推荐）：** 分层处理。TaskOutcome 内部回退（是否改革）不在本 Adapter 范围擅自修改。官方遥测出站与对端入库对下表执行 **失败封闭**。认证失败、令牌无效、身份不足：拒绝发送 / 返回 401 或 403，**不得** 降级为 anonymous 后继续写。
- **方案 B：** 允许 anonymous/runner 进入专用“未认证诊断桶”。即使用户意图是排障，仍会造成跨租户或跨主体聚合风险，且难以审计，不推荐作为官方契约。

**（5）推荐策略表（方案 A）**

| 身份 | 是否允许发送 | Tenant 规则 | 跨租户 | 是否可关联 Agent | 允许事件范围 | 审计要求 |
| --- | --- | --- | --- | --- | --- | --- |
| anonymous（含空 subject、合成 `personal:anonymous`） | **No** | 不适用；不得发明租户 | 默认拒绝；发送即失败 | No | 无 | 记录拒绝原因与来源；不得入库 |
| runner（`subjectRef=runner` / `personal:runner` / 仅 runner 回退） | **No** | 即使携带了某个 tenantId 也不得出站 | 默认拒绝 | No | 无 | 同上 |
| 已认证 User | **Yes，受限** | 仅企业第一期：Token 中的已验证 `tenantId`；body 不得覆盖。个人范围按 3.A，第一期不出站 | 默认拒绝 | 仅当该 User 被明确授权为该 Agent 的操作者（默认 No，除非另审授权模型） | 建议仅用户反馈类（如 `runtime.feedback.recorded`）；默认 **不允许** 用户直接投递运行时/模型/工具事件 | `subject`、`principalType=user`、`tenantId`、来源组件 |
| 已认证 Service Identity | **Yes** | 仅 Token 中已验证的企业 `tenantId`（第一期） | 默认拒绝 | 不可任意填 Agent；必须通过 3.C 绑定后才能带 `agentId` | 运行时事件白名单：`runtime.run.*`、`runtime.model.called`、`runtime.tool.called`、`runtime.task_outcome.recorded`（摘要，非完整账本） | `sub`（服务主体）、`principalType=service`、`tenantId`、来源系统/组件 |
| Service Identity 代表 Agent | **Yes** | 同上，Tenant 必须与 Agent 所属租户一致 | 默认拒绝 | **必须** 通过 Tenant + Service Identity + Agent 三方绑定且 allowlist 命中 | 同上，且 `traceContext.agentId` 必须等于被授权 Agent | 上列字段 + `agentId` + allowlist 版本或引用 |

特别禁止（RECOMMENDED，待批）：认证失败、缺令牌、签名/issuer/audience 失败、缺 tenant 声明，一律失败封闭；禁止改写为 anonymous 后继续跨租户或同租户写入。

**（6）风险：** 严格拒绝会使现行 runner 路径在未接入可信身份前没有遥测（这是可接受的安全代价）。若有人把内部 TaskOutcome 回退误认为可以出站，会形成漏洞。User 若被允许投递运行时事件，可能冒充 Agent。

**（7）批准人：** 架构负责人。

**（8）阻塞实施：** **是。**

### 3.C Agent 允许名单与服务身份绑定

**（1）当前源码事实**

- 入库 **不校验** `traceContext.agentId`（`ingest` 只检查 eventId、idempotencyKey、runId、tenant 匹配、redaction 标志）。
- JWT 有 `principalType` 与 `disallowServiceImpersonation`（禁止 service `actAsUser`），但无 Agent allowlist claim，也无服务-Agent 绑定表（`auth.ts` 第 102–105 行；`AuthContext` 仅 `subjectId`/`tenantId`/`roles`）。
- OpenBot `isValidAgentId` 只做格式校验；`resolveConfiguredTaskOutcomeRoot` 要求 agent 是已配置目录，未知 id 不建目录（`reject-result.ts` 第 54–63 行）。这是本地配置解析，不是对端授权。
- `normalizeAgentId` 可回退为 `"main"`，出站不得使用该回退作为授权后的 Agent。
- 谁签发服务身份、谁维护 allowlist：两仓源码中 **均无** 已落地的官方适配器签发器或控制面名单。P0-1 只是校验库，无生产 IdP 接线。

**（2）（3）冲突：** 合法 Service Identity 一旦通过租户校验，即可在 body 中填写任意 `agentId`，对端会接受。这与“禁止客户端冒充 Agent”冲突。冻结文档 ADR-13 正确保持 OPEN。

**（4）方案**

- **方案 A（推荐）：** 控制面维护的允许名单，ingest 时强制查找。绑定关系为 `(tenantId, serviceSubjectId, agentId)` 三元组。Agent 禁用、迁移、删除时更新名单，**入库当时** 检查，而不仅依赖 JWT 过期。
- **方案 B：** 把允许的 `agentId` 列表放进 JWT claim。撤销受 token TTL 限制，迁移窗口存在越权，只可作补充，不能作为唯一撤销机制。

**（5）推荐逻辑顺序（方案 A，可叠加短 TTL 的 claim 作提示而非权威）**

1. **认证**：校验 Bearer（issuer、audience、签名、exp/nbf、`sub`）。失败 → 401/403，停止。不得降级。
2. **租户绑定**：`tenantId` 只来自已验证令牌，不来自 body；body.tenantId 必须相等否则 403。
3. **主体类型**：出站运行时事件要求 `principalType=service` 且具备 service 角色；拒绝 service 扮演用户（已有 `disallowServiceImpersonation` 方向，应保持）。
4. **Agent 授权**：若事件携带 `agentId`（运行时事件应视为必填），在当前有效 allowlist 上查找 `(token.tenantId, token.sub, agentId)`。未命中、Agent 已禁用/删除/迁出该租户 → 403，不得入库。
5. **契约与二次安全**：schema、体大小、限流、独立脱敏检查（不信任 `redaction.applied`）。
6. **持久化与幂等**：按租户 + idempotencyKey 去重。

职责建议（RECOMMENDED，因控制面尚未实现，细节仍部分 OPEN）：

- **谁签发 Service Identity：** 由架构负责人指定的平台 IdP（AI Optimization 配置的 issuer），而不是 OpenBot 进程自己签发可被客户端任意伪造的令牌。生产接线仍为 BLOCKED，本建议不授权接线。
- **谁维护 Agent allowlist：** 该企业租户的授权管理员 + 平台控制面；适配器与入库只消费名单，不在事件里“自称已授权”。
- **防冒充：** body/traceContext 中的 `agentId` 不得覆盖令牌主体；必须命中三方绑定。禁止把格式合法但未绑定的 id 当作已授权。禁止 `normalizeAgentId` 回退为 `main` 后出站。

**（6）风险：** 名单延迟会导致短暂误拒或（若只信 JWT）短暂误放。缺少控制面实现是实施前提缺口（生产 IdP 仍 BLOCKED）。名单本身不可含密钥。

**（7）批准人：** 架构负责人。签发机构与名单运营责任需其指定。

**（8）阻塞实施：** **是。** 无绑定规则不得实施运行时事件出站。

### 3.D Trace Context

**（1）当前源码事实**

- 在 `openbot-vp@f3558f2` 的 `src/` 与 `extensions/` 检索，**未找到** `traceparent` / `tracestate` 字符串作为 W3C 传播实现（与冻结文档一致）。OpenBot 另有默认关闭的 OTLP 出口（`extensions/diagnostics-otel/src/service.ts`，未配置则不启用），与官方 Adapter 不是同一通道。
- `TaskOutcomeRecord` **没有** `traceId` 字段；有 `decisiveRunId` / `runs[].runId`（`types.ts`）。
- 对端 `TelemetryEvent.traceContext.traceId` 与 `runId` 在类型上为必填字符串，但 `ingest` 只强制 `runId`，**不校验** `traceId` 格式或 W3C 合规（`index.ts` 第 33–35 行；`ingest` 第 19–20 行）。
- OpenBot 内部幂等/事件 id 已存在且与 trace 无关：`eventIdFor(taskId, outcomeVersion, eventType)` → `evt_` + SHA256 截断（`result-service.ts` 第 56–61 行）。

**（2）（3）冲突：** 对端把 `traceId` 标为必填，OpenBot 运行时不一定有 W3C 上下文。若用 runId 或随机值冒充 W3C，或把 Trace ID 当幂等键，会造成关联断裂或重试误伤。

**（4）方案**

- **方案 A（推荐）：** 官方适配器出站强制采用 W3C Trace Context 语义。`traceContext.traceId` **必须等于** W3C `trace-id`（32 位小写十六进制）。传播 `traceparent`；`tracestate` 若存在且合法则原样传递，非法则丢弃 tracestate 但保留/新生成合法 traceparent。
- **方案 B：** 不强制 W3C，允许任意不透明 `traceId`。不利于与现有 OTel 出口及外部追踪系统对齐，不推荐。

**（5）推荐统一契约（方案 A）**

- **有合法上游 `traceparent`：** 解析并沿用其 `trace-id` / parent `span-id`；出站可生成新的 `span-id`；填写 `traceContext.traceId`、可选 `spanId`/`parentSpanId`。标记来源为 `propagated`。
- **上游缺失或非法：** **不得** 把非法值写入 `traceContext.traceId`。由 OpenBot 出站侧生成符合 W3C 的新 `trace-id`（及 span），标记来源为 `generated`。生成失败则该事件不出站（失败封闭），但 **不得** 因此失败 Agent 任务或 TaskOutcome 写入。
- **与 runId 关系：** `traceContext.runId` 必须能对应 OpenBot 的运行/任务运行标识（优先 TaskOutcome `runs[].runId` / `decisiveRunId`）。runId **不是** Trace ID。
- **幂等键：** **禁止** 用 Trace ID 作为 `idempotencyKey`。推荐 `idempotencyKey` 派生自稳定的事件身份，例如 OpenBot `eventId`（`evt_…`）或 `source.system + eventId`，并与租户（隔离键）组成 UNIQUE。同一追踪下有多次模型/工具调用，共享 Trace ID 是预期，故不能当幂等键。
- 对端应校验 `traceId` 的 W3C 格式；不合规则拒绝该事件（不影响 OpenBot 主路径）。

**（6）风险：** 生成新 trace 会使与上游网关跨系统关联变弱（应用 `generated` 标记可观测）。强制格式会让旧的非合规事件无法入库（第一期尚无生产流量）。实施不得把 OTel 诊断通道与 Adapter 混为同一出口。

**（7）批准人：** 架构负责人。

**（8）阻塞实施：** **是（契约冻结）**。字段语义未批不得把 `traceId` 写入稳定契约。不阻塞内部讨论，但阻塞出站编码。

### 3.E Prompt / Model / Tool / Policy 版本快照

**（1）当前源码事实**

- `TaskOutcomeRecord` 含 `schemaVersion`、`taskContractVersion`、`judgementPolicyVersion`、可选 `taskContract.version`，以及验收证据上的 `validatorVersion`（`types.ts`）。**没有** prompt / model / tool / agent / experiment 版本字段。
- `ModelCallEvidence` 记录 `provider`、`model`（字符串），以及 usage；**不存储 prompt 文本**（`model-call-evidence.ts` 文件头与第 29–44 行）。没有独立的 `modelVersion` / `promptVersion` 字段。
- 对端 `traceContext` 已预留可选 `agentVersion`、`promptVersion`、`toolPolicyVersion`、`experimentId`（`shared-contracts` 第 41–44 行），均为可选字符串，未定义“无法获得时”的语义。
- 版本来源在 OpenBot 仓内分散（任务契约、判断策略、模型调用证据、观察实验、治理 policyVersion 等），冻结文档 ADR-12 正确指出无统一权威快照。
- `diagnostics.cacheTrace.includePrompt` 默认 true（`schema.help.ts`），属独立诊断通道，不得作为官方 Adapter 载荷来源。

**（2）（3）冲突：** 若实施时在出站瞬间读取“当前最新”配置版本，会伪造历史运行时事实。若因字段缺失而拒绝一切事件，则在统一快照建成前无法出站。若随意留空又不声明规则，分析侧会把空值误解为“无版本”。

**（4）方案**

- **方案 A（推荐）：** 只记录 **该次运行实际使用** 的版本。拿不到就显式标记不可用，**禁止** 回填当前 latest。按事件类型区分必填/可选。
- **方案 B：** 所有版本字段一律必填，缺失即拒绝事件。在当前源码未提供统一快照之前，这会全面阻塞出站，不适合作为第一期硬条件，除非负责人明确要求。

**（5）推荐字段规则（方案 A）**

通用禁令：禁止用“当前最新”配置、默认模型或仓库 tip 版本代替历史运行时版本。禁止把 prompt 全文、工具原始参数中的密钥/PII 作为版本快照的一部分。

| 字段 | 适用事件 | 必填性 | 无法获得时 |
| --- | --- | --- | --- |
| Model Provider | `runtime.model.called` | 必填（该事件若出站） | 不出站该模型事件；不得填 `"latest"` 或默认供应商 |
| Model ID（即证据中的 `model`） | 同上 | 必填 | 同上 |
| Model Version（若供应商单独提供） | 同上 | 可选 | 省略或显式 `unavailable`，并记录原因码；不得用今日最新型号版本顶替 |
| Prompt Version | 实际使用了受版本管理 Prompt 的运行时事件 | 若该次调用确有 Prompt 版本则必填 | 无受管 Prompt 则省略；禁止回填当前生产 Prompt 版本 |
| Tool Name | `runtime.tool.called` | 必填 | 不出站该工具事件 |
| Tool Version | 同上 | 可选（有则记） | 省略 / `unavailable`，不得用最新工具版本顶替 |
| Policy Version（Agent/Tool Policy 等） | 运行时事件，当该策略实际参与判定/授权 | 可选，有则记实际版本 | 省略 / `unavailable` |
| Agent Version | 运行时事件 | 可选，有则记实际版本 | 省略 / `unavailable`；不得用当前部署 latest |
| Experiment ID | 仅当该运行确属某实验 | 可选 | 无实验则省略，禁止填入正在进行的其他实验 ID |
| Task / Judgement / Contract 版本 | `runtime.task_outcome.recorded` 摘要 | 可选，优先使用记录上已有的 `taskContractVersion` / `judgementPolicyVersion` | 省略；不得另造 |

`runtime.task_outcome.recorded` 只允许脱敏摘要（taskId、runId、lifecycle/judgement 等），禁止把完整 `TaskOutcomeRecord` 复制为第二账本。

**（6）风险：** 部分可选会造成分析缺口。强制全部必填则在快照能力建成前无法出站。错误回填 latest 会造成不可逆的错误训练/评估关联。

**（7）批准人：** 架构负责人。

**（8）阻塞实施：** **部分阻塞。** “不得回填 latest”与模型/工具事件的最小必填集未批不得编码这些事件。不阻塞对“默认关闭客户端壳”的设计讨论，但阻塞带版本字段的事件契约实施。

### 3.F 入站 API 与可靠性参数

本类覆盖两个决策主题：API 兼容性，以及 WAL/缓冲依赖。

**（1）当前源码事实**

- HTTP：`POST /v1/telemetry/events` 与 **未在 OpenAPI 声明的** `GET /v1/telemetry/events`（`server.ts` 第 56–69 行）。GET 在认证后调用 `listForTenant`，按 `auth.tenantId` 返回全部事件，**无角色细分、无分页、无条目上限**。
- OpenAPI 仅 `post`，响应 202/400/403（`ai-optimization-v1.yaml` 第 7–14 行）。与实现漂移。
- `readJsonBody` 无限读取（第 19–26 行）。无限流。无未知字段白名单；`payload` 为 `Record<string, unknown>`，整份 event 被 `JSON.stringify(event)` 入库（`ingest` 第 40 行），未知字段会被持久化。
- 幂等：`UNIQUE (tenant_id, idempotency_key)`（`db.ts`）；`ingest` 要求键存在，但不校验格式，也不禁止用 traceId 当键。
- main WAL：见第 2.1 节，错误常被吞掉，恢复弱。PR #4 @ `8324aa2` 为更强的 fail-closed WAL，**未合并**，不得当 main 能力或默认依赖。
- OpenBot 侧 **没有** 官方出站缓冲。

**（2）（3）冲突：** GET 扩大了只应按租户隔离、但应按角色授权的读面；未知字段入库可能夹带 PII；无限体/无限流使认证后的服务身份可造成资源耗尽；若实施等待 PR #4 合并，会把未批准变更变成 Adapter 前提。

**（4）（5）推荐（均为 RECOMMENDED，阈值数字供批准，不是已批准标准）**

- **GET /v1/telemetry/events：** 推荐 **不纳入官方 Adapter 契约**。第一期出站只依赖 POST 入库。现有 GET 若暂时保留在 HTTP 服务器中，必须加角色门槛（例如仅 `owner`/`operator`/`approver`，禁止普通 service 身份列举）、分页与上限；并补进 OpenAPI 或从实现中删除以消除漂移。推荐方向是：官方契约删除或降级该 GET，而不是把它当成适配器查询接口。
- **未知字段：** 推荐 **丢弃且不持久化**（ignore/drop）。缺少必填字段或必填字段非法则拒绝整事件。不为了“兼容保留”而把未知键写入 `payload_json`（防 PII/密钥夹带）。不推荐第一期用 reject-unknown 导致任何附加字段即失败，除非负责人要求严格模式。
- **请求体上限：** 推荐硬上限 **64 KiB**（超限 413），与“只传脱敏摘要”一致。精确数字待批。
- **限流：** 推荐同时按 **Tenant** 与 **Service Identity（token.sub）** 限流；超限 429。出站侧必须把 429 视为可恢复错误，**不得** 失败 Agent 任务。建议作为起点的数量级（待批，不是标准）：每 Service Identity 约 100 事件/秒，每 Tenant 约 1000 事件/秒，可突发短窗。最终数值由负责人定。
- **幂等键：** 由 OpenBot 出站生成，不得用 Trace ID。推荐使用稳定 `eventId` 或由其派生的键；非空、最大长度建议 128、允许 `evt_` + hex 或等价受限字符集；校验失败 400。去重键为 `(isolationKey, idempotencyKey)`，第一期 isolationKey = 已验证 `tenantId`。重复返回已有的 202 `duplicate: true`，不覆盖载荷。
- **OpenBot 侧缓冲：** 推荐 **在 `openbot-vp` 仓库内** 实现默认关闭的有界异步缓冲（与故障隔离七条一致），**不要** 把共享库或 PR #4 当作开工前提。
- **是否等待 PR #4 WAL 合并：** **否。** 独立评估。不预设依赖 PR #4，也不把 main 弱 WAL 描述为已满足崩溃恢复。若负责人 **另行** 批准合并 PR #4，再考虑是否抽取共享库；那是另一授权，不是本评审的默认路径。

备选方案：等待 PR #4 合并后再做出站 WAL——这会把 Adapter 实施绑定到一个仍 OPEN 的 PR，拒绝作为默认依赖。备选：保留未加角色的 GET——拒绝。

**（6）风险：** 64 KiB 可能截断过大摘要（应在出站侧先裁剪）。限流过严会增加本地丢弃（需指标）。丢弃未知字段要求发送方版本协商。仓库内缓冲可能与将来共享 WAL 重复，但避免错误依赖。使用 main 弱 WAL 会在 SIGKILL/损坏尾部场景丢数据或双写（at-least-once 仍要求消费者幂等）。

**（7）批准人：** 架构负责人（含具体阈值）。PR #4 合并必须另审。

**（8）阻塞实施：** **是**（API 契约、限体限流、幂等规则、缓冲依赖均需先批）。

---

## 4. 推荐决策及风险（汇总）

| 决策主题 | 评审建议 | 状态 | 阻塞实施 |
| --- | --- | --- | --- |
| Personal Tenant 模型 | 个人 TrustedScope **允许且应当** 没有 Tenant ID；第一期官方出站仅企业范围；不得把 `personalDomainId`（如 `personal:${subject}`）虚构为 Tenant ID；企业员工 Personal Space 与独立个人均不得写入企业租户桶。个人一等分区列为后续扩约，不在适配器内发明租户。 | **RECOMMENDED** | **是** |
| anonymous / runner | 两者均 **禁止** 官方出站与入库。已认证 User 仅限授权后的反馈类事件。已认证 Service Identity 及“代表 Agent”按 3.B/3.C。认证失败禁止降级为 anonymous 后继续写入。跨租户默认拒绝。 | **RECOMMENDED** | **是** |
| Agent allowlist | Tenant + Service Identity + Agent 三方绑定；ingest 时查当前名单；禁用/迁移/删除立即拒绝。签发由指定平台 IdP，名单由租户管理员 + 控制面维护。 | **RECOMMENDED** | **是** |
| Trace Context | 官方出站采用 W3C Trace Context；`traceContext.traceId` = W3C trace-id；缺失或非法则本地生成并标记 `generated`，不得转发非法值；**禁止** 用 Trace ID 作幂等键。 | **RECOMMENDED** | **是（契约）** |
| 版本快照 | 只记录运行时实际版本；禁止用当前 latest 顶替；模型/工具事件有最小必填；缺失则省略或 `unavailable`，不得编造。 | **RECOMMENDED** | **部分阻塞** |
| API 兼容性 | GET 不纳入官方 Adapter 契约（保留则必须角色门槛+分页+消除 OpenAPI 漂移）；未知字段丢弃不持久化；体上限建议 64 KiB；按 Tenant 与 Service Identity 限流；幂等键由出站生成并校验。 | **RECOMMENDED** | **是** |
| WAL 依赖 | OpenBot 仓库内自建默认关闭缓冲；**不** 等待、也不预设依赖 PR #4；main 弱 WAL 不视为已满足崩溃恢复。PR #4 合并另审。 | **RECOMMENDED** | **是**（依赖关系必须先被负责人确认） |

既有原则（不是本轮新裁决，可标 APPROVED）：OpenBot 为 TaskOutcome 唯一权威；不绕过 Evolution Control；不得因 AI Optimization 不可用而同步阻塞 OpenBot；生产准入关闭；本阶段不实施、不合并。

主要残余风险：个人场景第一期无遥测；控制面 allowlist 与生产 IdP 仍不存在（接线 BLOCKED）；阈值未批；OpenBot 当前 main CI 有失败/进行中作业且日志不完整，根因未确认，不得当作平台已绿。

---

## 5. ADR 决策记录

以下 ADR 属于本评审报告。除引用既有章程的项外，**不得** 视为已批准。

| ID | 决策 | 状态 | 依据或缺口 |
| --- | --- | --- | --- |
| REV-ADR-01 | OpenBot 是 TaskOutcome 与生产执行的唯一权威；AI Optimization 只持有脱敏摘要副本 | **APPROVED** | 章程 `SYSTEM_BOUNDARIES.md` 第 4、8 行；源码结构 |
| REV-ADR-02 | 不得绕过 Evolution Control；本 Adapter 不含制品应用 | **APPROVED** | 章程第 4–9 行 |
| REV-ADR-03 | 严禁 OpenBot 同步阻塞等待 AI Optimization；出站故障不得失败 Agent 任务 | **APPROVED**（原则） | 章程第 10 行。具体七条实现方案仍为 RECOMMENDED |
| REV-ADR-04 | 生产准入关闭；无生产 IdP/PostgreSQL 接线授权 | **APPROVED** | 本轮及既有门禁 |
| REV-ADR-05 | 本阶段只评审不实施；不合并 PR #4/#5/#6；不启动工作包 | **APPROVED** | 本轮授权范围 |
| REV-ADR-06 | 第一期仅企业范围出站；个人 TrustedScope 可无 tenantId；禁止虚构 Tenant ID | **RECOMMENDED** | 3.A；与现行 `TrustedScope` 一致，与现行对端必填 tenantId 冲突，需批契约策略 |
| REV-ADR-07 | anonymous / runner 禁止官方出站；认证失败不得降级写入 | **RECOMMENDED** | 3.B |
| REV-ADR-08 | Service Identity 出站运行时事件；User 默认不可投递运行时事件 | **RECOMMENDED** | 3.B |
| REV-ADR-09 | Tenant + Service Identity + Agent 三方绑定，ingest 时校验 | **RECOMMENDED** | 3.C；控制面尚未实现 |
| REV-ADR-10 | 官方出站使用 W3C Trace Context；禁止 Trace ID 作幂等键 | **RECOMMENDED** | 3.D |
| REV-ADR-11 | 版本快照只记录实际运行时版本，禁止回填 latest | **RECOMMENDED** | 3.E |
| REV-ADR-12 | GET /v1/telemetry/events 不纳入官方 Adapter 契约；未知字段丢弃不落库；建议 64 KiB 与双维度限流 | **RECOMMENDED** | 3.F；具体阈值待批 |
| REV-ADR-13 | OpenBot 侧缓冲在仓内实现；不预设依赖 PR #4 WAL | **RECOMMENDED** | 3.F；PR #4 仍 OPEN |
| REV-ADR-14 | 将 main 或未合并 PR #4 的 WAL 当作实施前提 | **BLOCKED** | PR #4 未合并；main 实现较弱 |
| REV-ADR-15 | 在身份/API/WAL 建议获批、生产 IdP 接线之前宣称 Integration Accepted 或开始生产接入 | **BLOCKED** | P0-1 仅库级 |
| REV-ADR-16 | 用单仓 mock 或冻结状态机冒充跨仓/生产验收 | **BLOCKED** | 证据分层 |
| REV-ADR-17 | 启动实施工作包、创建实现分支，或将本报告建议当作已批准 | **BLOCKED** | 等待架构负责人评审批准 |

---

## 6. OPEN / BLOCKED 问题清单

**仍为 OPEN（建议已给出，但负责人尚未裁决；本报告不关闭）：**

- 是否接受第一期仅企业范围（REV-ADR-06），以及个人遥测是否/何时按方案 B 扩约。
- 是否接受 anonymous/runner 全面禁出站，以及 User 是否仅限反馈事件。
- Service Identity 的签发机构具体是哪一个 IdP；allowlist 的运营角色与撤销 SLA。
- 是否强制 W3C，以及非法上游的生成策略。
- 版本字段必填集与 `unavailable` 编码。
- GET 的去留与角色模型；未知字段策略；64 KiB 与限流数值是否采纳。
- 仓内缓冲方案是否确认；PR #4 是否另审合并（非本报告授权）。
- OpenBot `f3558f2` 上 CI Gate `delivery guard` 失败及 `CI` run 46132661255 的最终结论/根因（日志不足，保持未确认）。
- 历史 run 46122851166 根因（日志仍不可读）。

**BLOCKED：**

- 生产 IdP 接线、生产 PostgreSQL、部署、切流、生产迁移。
- 依赖 PR #4 或把其 WAL 当作 main 能力。
- 宣称 Adapter Engineering Complete / Integration Accepted / Production Accepted。
- 实施编码、创建实现分支、启动九个工作包。
- 将 RECOMMENDED 当作 APPROVED。

---

## 7. Adapter 实施准入条件

只有在以下条件 **全部获得架构负责人明确批准** 后，才可以 **申请** 下一阶段 Adapter 实施授权。本阶段 **不申请** 该授权。

| # | 准入条件 | 当前是否满足 |
| --- | --- | --- |
| 1 | Personal Tenant 与身份映射决策获批 | **否**（仅有 RECOMMENDED） |
| 2 | anonymous / runner 策略获批 | **否** |
| 3 | Service Identity 与 Agent allowlist 机制获批 | **否**（控制面仍不存在；建议未批） |
| 4 | Trace Context 和事件版本契约获批 | **否** |
| 5 | 入站 API、安全和可靠性参数获批 | **否** |
| 6 | WAL 与缓冲依赖关系明确且获确认 | **否**（建议不依赖 PR #4，尚未确认） |
| 7 | 九个实施工作包的范围及验收标准获批 | **否**（见第 8 节更新，仍待批） |

**结论：当前不具备申请 Adapter 实施授权的条件。** 建议不是批准。

---

## 8. 九个实施工作包的依赖关系更新

在第 7 节准入条件全部批准之前，所有工作包保持 **未授权 / BLOCKED 开工**。以下更新依赖，不创建分支、不编码。

| 工作包 | 更新后的依赖 | 可能修改的仓库 | 依赖关系说明 | 验收条件（仍待批） |
| --- | --- | --- | --- | --- |
| Adapter Outbound Client | 第 7 节全部获批；尤其 3.B 出站许可、默认关闭与故障隔离原则 | 主要 `openbot-vp` | 不依赖 PR #4；不改 TaskOutcome SoT；第一期不发送 personal/anonymous/runner | 未配置零出站；主路径无 await；失败不改账本 |
| Event Contract / Schema Compatibility | 3.A/3.D/3.E/3.F API 建议获批 | 主要 `ai-optimization` 契约/OpenAPI（实施阶段另审才能改 schema） | 按批准后的 tenant/scope、trace、版本、未知字段规则对齐；禁止完整 TaskOutcome 入库 | 契约与实现一致 |
| Identity Propagation | 3.A、3.B、3.C 获批 | 双方 | Token 权威租户；禁止 body 覆盖；禁止匿名降级 | 错租户/无效令牌/未绑定 Agent 被拒 |
| Redaction and Payload Validation | 冻结原则 + 3.F 限体/未知字段获批 | 双方 | 出站脱敏；对端再校验，不信任 `redaction.applied`；含对 main 客户端自贴标志的不信任 | 伪造标志被拒；敏感值不出站/不入库 |
| Async Queue and Fault Isolation | 故障隔离原则获批 | 主要 `openbot-vp` | 与仓内缓冲一起设计；readiness 不对对端 | 超时/5xx/满队列不影响任务 |
| WAL / Delivery / Idempotency | 3.F WAL 建议获确认；**明确不依赖 PR #4 合并** | 主要 `openbot-vp` 出站缓冲；对端去重已有雏形可在加固中扩展 | 若未来另审合并 PR #4 再评估共享库，不是本包开工门闩 | at-least-once + 租户幂等；重启行为符合批准语义 |
| AI Optimization Ingestion Hardening | 3.A–3.C、3.F、脱敏再校验获批 | `ai-optimization` | 限体、限流、GET 处理、trace 格式、allowlist 查找；无生产 IdP 则不得称 Integration Accepted | 缺口关闭且有测试 |
| Cross-Repository Integration Tests | 上述包的实施已另审启动；测试 IdP（非生产）；OpenBot CI 通道现状需记录 | 双方或独立测试工程 | 不得用 mock 冒充跨仓验收 | 固定 SHA 的可复核日志；证据分层 |
| Operational Metrics and Diagnostics | 客户端与加固 | 双方 | 拒绝/丢弃/重复/生成-trace 来源指标；禁止 PII；探针对端不可作为就绪硬依赖 | 有指标；readiness 不对对端失败 |

建议开工顺序（仅在实施授权之后）：契约与身份/脱敏规则定稿 → 入库加固与仓内出站缓冲并行 → 出站客户端挂钩 → 指标 → 真实跨仓测试。任何一步都不得提前于第 7 节批准。

---

## 9. 需要架构负责人明确批准的事项

请对下列事项逐项给出批准、修改或否决。在此之前，OPEN 保持开放，实施保持 BLOCKED。

1. 是否批准第一期仅企业范围出站，以及禁止将 `personalDomainId` 虚构为 Tenant ID（REV-ADR-06）？
2. 是否批准 anonymous / runner 禁止出站，以及认证失败不得降级写入的策略表（REV-ADR-07/08）？
3. 是否批准 Tenant + Service Identity + Agent 三方绑定与 ingest 时校验，并指定 Service Identity 签发机构与 allowlist 维护责任（REV-ADR-09）？
4. 是否批准 W3C Trace Context 契约，以及禁止 Trace ID 作为幂等键（REV-ADR-10）？
5. 是否批准“只记录实际运行时版本、禁止回填 latest”的字段必填/可选规则（REV-ADR-11）？
6. 是否批准 GET 不纳入官方 Adapter 契约（或给出替代读模型）、未知字段丢弃、64 KiB 体上限与双维度限流起点数值（REV-ADR-12）？
7. 是否确认 OpenBot 仓内缓冲、**不** 将 PR #4 作为默认实施依赖（REV-ADR-13）？是否对 PR #4 另启合并评审（本报告不申请）？
8. 是否批准第 8 节更新后的九个工作包范围、依赖与验收条件？

本文件结束。提交评审报告与证据后停止，等待架构负责人评审。不得自行将建议转为实施，不得合并 PR #4 / #5 / #6，不得申请本阶段的 Adapter 实施授权。
