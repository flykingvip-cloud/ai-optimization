# OWNER_DECISION_REGISTER.md

> Owner Decision Register **建议稿**（只读核验与决策整理，不实施）。  
> 本文件中的「建议 APPROVE / 建议 REJECT / 建议 REVISE」**不等于**架构负责人已批准。  
> **Owner 结论栏一律为「待 Owner 决策」。** 不得把 PR #7 的 RECOMMENDED 自动升级为 APPROVED，不得将本登记中的任何建议性结论标记为 Owner 已批准。  
> 未经负责人对 D-01–D-07 作出明确批准、否定或修订，并另行授予 Adapter Implementation Plan 授权之前，不得编写 Adapter、不得修改业务代码、不得合并 PR、不得创建实现分支。

- 授权范围：Yolanda Lee，2026-11-28（Asia/Shanghai），「Telemetry Adapter 架构决策闭环（Phase 1）」——只读审查与决策整理。
- 本轮未执行：编写 OpenBot Telemetry Adapter；修改任何仓库的业务代码、测试、Schema 或 API；合并 PR #4 / #5 / #6 / #7；创建分支、向 GitHub 仓库写入文件、提交 commit 或开设新 PR；接入生产 IdP / PostgreSQL / 生产环境；部署、迁移或切流；将 PR #4 WAL 视为已进入 `main` 或作为默认实施依赖；将单仓 CI 通过视为跨仓集成验收。
- 生产准入：**保持关闭**。
- 核验窗口：2026-11-28 18:49–18:53 CST（Asia/Shanghai）。
- 建议批准人：架构负责人 Yolanda Lee。

---

## 1. 审计基线及当前 SHA（含是否漂移）

活基线于 2026-11-28 18:49–18:53 CST（Asia/Shanghai）重新读取 GitHub（已登录 `gh` 账号 `flykingvip-cloud`，并对三个仓库执行 `git fetch origin`，未改动既有 worktree 的工作区或追踪分支）。

**本轮相对上次记录的基线：三个仓库 `origin/main` 与 PR #4–#7 的 HEAD 均无 SHA 漂移。** 不把上一轮结论直接当作已批准决策；下列 SHA 已重新核验后，上一轮对身份 / TaskOutcome / 遥测路径的源码引用在当前 SHA 上仍然可以对照。

| 对象 | 上次记录的基线 | 本轮 GitHub 实况 | 漂移 |
| --- | --- | --- | --- |
| `ai-optimization` `main` | `16b01d99d33b386102bb9b2b248558eb5517e245` | 同 SHA。提交：`Merge pull request #3 from flykingvip-cloud/docs/p0-1-merged-main-baseline`，提交时间 2026-11-28 14:44:27 CST。CI run [46118003722](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46118003722)（workflow `CI`，event `push`）success，完成于 2026-11-28 14:44:43 CST。**仅证明该 SHA，不是跨仓集成验收。** | **无** |
| `openbot-vp` `main` | `f3558f2ccd24a1020dff8a378721786b3071f641` | 同 SHA。提交：`Merge pull request #369 from flykingvip-cloud/codex/openbot-t1-ui-boundary`，提交时间 2026-11-28 17:54:38 CST。相对更早的 `8b83e4eb` 仍仅差 `scripts/ui.js` 与 `test/scripts/ui.test.ts`（上一轮已记录；本轮 SHA 未再前进）。 | **无 SHA 漂移。** CI 状态有更新，见下表，不改变源码 SHA。 |
| `knowledge-sdk` `main` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | 同 SHA。提交：`fix(ci): give HTTPError fixtures closeable bodies on Python 3.9`，提交时间 2026-11-25 10:10:14 CST。CI run [45536468206](https://github.com/flykingvip-cloud/knowledge-sdk/actions/runs/45536468206)（workflow `tests`）success，完成于 2026-11-25 10:57:48 CST。仅作边界参考。 | **无** |
| PR #4 WAL | HEAD `8324aa2441145bb1c685df5c8e65694277398f84`，OPEN | 同 SHA。`state=OPEN`，`mergedAt=null`，`isDraft=false`，`mergeable=MERGEABLE`，`reviewDecision` 为空（无 approved review）。base 仍为建立 PR 时的 `main` `c5779f20c8f9011396cd0aea299f8c2b9cd9e240`，不是当前 `main` `16b01d99`。CI job `verify` run [46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496) success（作业完成 2026-11-28 17:23:44 CST）。**WAL 不是 `main` 已有能力，也不得作为默认实施依赖。** | **无** |
| PR #5 Adapter Interface Audit | HEAD `74e75fbd0fcf26a648a4c80b24d7de9eb81bfbf6`，OPEN | 同 SHA。`state=OPEN`，`mergedAt=null`，`mergeable=MERGEABLE`，`reviewDecision` 为空。CI run [46131574686](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46131574686) success（17:40:46 CST）。仅作先前审计上下文。 | **无** |
| PR #6 Design Freeze | HEAD `1ec34cca26deeb24d6fd54abcf3f2375e4b9ba7b`，OPEN | 同 SHA。`state=OPEN`，`mergedAt=null`，`mergeable=MERGEABLE`，`reviewDecision` 为空。设计正文 `507392bbe62b20334ec954baec9b4ff5ac7089a5`。最终 CI run [46132975388](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46132975388) success（17:59:31 CST），**仅证明 `1ec34cc`**。 | **无** |
| PR #7 Design Review | HEAD `3753da21be151bad8047cd73253f74c4681f4765`，OPEN | 同 SHA。`state=OPEN`，`mergedAt=null`，`mergeable=MERGEABLE`，`reviewDecision` 为空，`reviews=[]`。评审正文 `8b86c69f85a5426d5d369cb5f7aef1f64f537b76`。最终 CI run [46133991480](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46133991480) success（18:11:50 CST），**仅证明 `3753da2`**。正文 CI [46133935688](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46133935688) **仅证明 `8b86c69`**。 | **无** |

### 1.1 OpenBot `main` CI 状态更新（非 SHA 漂移）

上一轮用户提供记录：`f3558f2` 上 CI Gate run [46132661254](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661254) 于 17:59:19 CST 失败（job `delivery guard`）；Workflow CI run [46132661255](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661255) 当时仍在进行。本轮只记录现状，**不推断根因**，也**不把单仓 CI 结果当作跨仓集成验收**。

本轮在 18:49–18:53 CST 读取到的 `f3558f2` 相关 run：

| Workflow | Run | 结论 | 完成时间（CST） | 事实摘录 |
| --- | --- | --- | --- | --- |
| CI Gate | [46132661254](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661254) | **failure**（completed） | 17:59:19 | job `check (types, lint, format)` success；job `delivery guard` **failure**（17:55:34 CST）。与上一轮记录一致。 |
| CI | [46132661255](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661255) | **failure**（completed） | **18:13:48** | **相对上一轮的状态更新**：此前为 in_progress，现已结束。失败 jobs 包括：`secrets`、`check`、`checks (node, protocol, pnpm protocol:check)`、`android (test, ./gradlew --no-daemon :app:testDebugUnitTest)`、`checks (node, test, pnpm canvas:a2ui:bundle && pnpm test)`，以及多个 `checks-windows (node, test, …)` 分片。部分 jobs success 或 skipped。本轮 `gh run view --log-failed` 可以取到日志（不再是上一轮对更早 SHA `8b83e4eb` run 46122851166 的日志不可读情况）。**此处只记录作业结论与日志可读取这一事实，不根据日志推断根因。** |
| Install Smoke | [46132661258](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661258) | success | 18:07:52 | 仅证明该 workflow。 |
| Memory Workspace Freeze | [46132661256](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661256) | success | 17:56:53 | 仅证明该 workflow。 |
| Workflow Sanity | [46132661276](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661276) | success | 17:55:00 | 仅证明该 workflow。 |
| Docker Release | [46132661257](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661257) | **in_progress**（核验时尚未结束） | 核验时 `updatedAt` 仍为 17:54:44 | job `build-amd64` success（18:02:47 CST）；job `build-arm64` 核验时仍 in_progress。只记录状态。 |
| CogniWeave SDK Nightly | [46135827242](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46135827242) | **failure**（`schedule`） | 18:35:26 | job `longrun-benchmark` failure（18:35:25 CST）。这是本轮新出现的 scheduled run，不是 SHA 漂移。不推断根因。 |

结论：当前 `openbot-vp` `main` 的 CI Gate 与 CI 在 `f3558f2` 上为失败状态；不得将 OpenBot 平台表述为“已绿”。该 CI 状况 **不改变** D-01–D-07 的建议方向，也 **不是** 本阶段可以关闭的架构决策。

---

## 2. 证据分类说明

本登记中每条结论都按下列四类标记。不得混用。

| 类别 | 含义 | 本文件中的用法 |
| --- | --- | --- |
| **GitHub 已验证事实** | 本轮用 `gh` / `git fetch` 从 GitHub 核实的 SHA、PR 状态、CI run 号与结论、时间戳。 | 第 1 节基线表、PR 合并状态、CI 结论。 |
| **源码验证事实** | 本轮在指定 SHA 上直接阅读的类型、函数、路由与文档原文。给出仓库、SHA、路径与行号。 | 第 3、5 节中的“当前源码事实”。 |
| **用户提供记录** | 任务指令或上一轮交付中提供、本轮已重新核验或明确标注未再核验细节的材料。 | 上次记录的基线表；上一轮关于 `8b83e4eb` → `f3558f2` 仅 UI 文件差异的记录（本轮 SHA 未变，未重新展开 diff）。 |
| **待 Owner 决策** | 需要架构负责人明确批准、否定或修订的事项。建议不等于批准。 | 第 4、5 节全部 D-01–D-07；阈值数字；签发机构与名单运营责任；个人遥测是否以及何时升级到方案 B；PR #4 是否另启合并评审。 |

已接受原则（见第 6 节）来自既有章程与先前负责人已接受的边界，**不是**本轮对 D-01–D-07 的批准。

---

## 3. PR #7 七项建议的源码对照结果

对照对象：

- 评审报告：`ai-optimization` PR #7 @ `3753da2`，`docs/architecture/handover/OPENBOT_TELEMETRY_ADAPTER_DESIGN_REVIEW.md`
- 设计冻结：PR #6 @ `1ec34cc`（正文 `507392b`）
- `openbot-vp` `origin/main` @ `f3558f2`（本地只读 checkout：`/workspace/repos/openbot-vp-design-review`）
- `ai-optimization` `origin/main` @ `16b01d99`（`git show origin/main:…`）
- PR #4 分支 @ `8324aa2`（明确标注 **未合并**，仅作 WAL 语义对照，不是当前 `main` 能力）

对照标签含义：

- **SUPPORTED**：当前源码证据支持该项建议方向（含：源码缺口本身构成采纳该建议的证据）。
- **CONFLICT**：建议方向与现有代码或文档存在需要在实施前解决的冲突；若冲突足以改变建议方向，则在第 5 节改为「建议 REVISE」。
- **NOT VERIFIED**：缺少可复现的源码或运行时对象依据，不得猜测补全。

本轮复核 **未发现足以把默认建议方向改为 REJECT 或整体 REVISE 的源码冲突**。跨仓契约冲突（例如个人范围无 `tenantId`、对端却必填 `tenantId`）是 PR #7 建议要解决的问题，列在第 7 节冲突清单，不视为应改建议方向的理由。D-05 的“只记录真实运行时版本、不得伪造”原则为 SUPPORTED，但若干可选字段的**具体运行时对象来源**仍为 NOT VERIFIED，必须保持未决，不得编造映射。

| ID | 主题 | 与当前源码关系 | 说明（摘要） |
| --- | --- | --- | --- |
| D-01 | Personal TrustedScope / Tenant | **SUPPORTED**（伴随已记录的跨仓契约冲突，见第 7 节） | OpenBot 个人 `TrustedScope` 合法地没有 `tenantId`；对端 `TelemetryEvent.tenantId` 与 JWT `tenantId` 均为必填。建议第一期只出站企业范围、禁止虚构 Tenant ID，与源码模型一致，并能避免该冲突被错误“兼容”掉。 |
| D-02 | anonymous / runner 身份 | **SUPPORTED** | 内部账本存在 `anonymous` / `runner` 回退；对端 HTTP 认证失败已 fail-closed，且无 anonymous 主体类型。建议禁止将内部回退用于官方出站，并禁止认证失败降级写入，与“不得把内部回退变成跨租户入口”一致。 |
| D-03 | Agent Allowlist | **SUPPORTED**（控制面实现与签发机构为 **NOT VERIFIED / 未落地**） | 入库不校验 `agentId`；无服务–Agent 绑定表。该缺口支持“必须三方绑定、ingest 时查当前名单”的建议。谁签发、谁运维名单在两仓源码中均无已落地控制面，不得写成已存在能力。 |
| D-04 | Trace Context | **SUPPORTED** | 在 `openbot-vp@f3558f2` 的 `src/` 与 `extensions/` 未找到 `traceparent` / `tracestate` 传播实现；`ingest` 不校验 `traceId` 的 W3C 格式。建议采用 W3C、禁止用 Trace ID 作幂等键，与现有缺口及 `eventIdFor` 已存在的非 trace 事件身份一致。 |
| D-05 | Runtime Version Snapshot | **SUPPORTED**（原则）；若干字段来源 **NOT VERIFIED** | `ModelCallEvidence` 有 `provider` / `model`，无独立 `modelVersion` / `promptVersion`。`TaskOutcomeRecord` 有契约与判断策略版本。Agent Version、工具版本、运行时 Prompt 版本、一次 Agent 运行与 Evolution `experimentId` 的绑定，均缺乏可直接复用的统一快照对象。原则（只记实际版本、禁止回填 latest）有源码依据；具体字段映射不得猜测。 |
| D-06 | API Compatibility | **SUPPORTED**（伴随实现与 OpenAPI 漂移冲突，见第 7 节） | `GET /v1/telemetry/events` 存在于 `server.ts` 但未写入 OpenAPI；`readJsonBody` 无限读；未知字段随整份 event 入库；无按 Tenant / Service Identity 的限流或 64 KiB 上限。建议与这些事实对齐。 |
| D-07 | WAL Dependency | **SUPPORTED** | `openbot-vp` 无官方出站缓冲。`ai-optimization` `main` 的 telemetry-sdk WAL 在错误路径上吞异常、容量满时 `shift()` 丢弃，且无 `wal-lock.ts`。PR #4 更强 WAL **未合并**。建议在 OpenBot 仓内自建默认关闭缓冲、不依赖 PR #4，与源码状态一致。 |

---

## 4. 七项决策矩阵

下表全部为**建议**，状态均为 **待 Owner 决策**。阻塞实施指：在负责人给出明确批准 / 否定 / 修订之前，不得开始对应的 Adapter 实施编码。

| 决策 ID | 主题 | 建议方向 | 建议结论 | 状态 | 阻塞实施 |
| --- | --- | --- | --- | --- | --- |
| D-01 | Personal TrustedScope / Tenant | 第一阶段仅允许 Enterprise Scope 正式出站；Personal 不得伪装成 Enterprise Tenant；不得虚构 Tenant ID | **建议 APPROVE** | **待 Owner 决策** | **是** |
| D-02 | anonymous / runner 身份 | 禁止作为正式 Adapter 身份；认证失败必须 fail closed，不得降级后继续发送 | **建议 APPROVE** | **待 Owner 决策** | **是** |
| D-03 | Agent Allowlist | Tenant + Service Identity + Agent 三方绑定；撤销后立即拒绝新事件；名单查询失败失败封闭 | **建议 APPROVE** | **待 Owner 决策** | **是** |
| D-04 | Trace Context | 使用 W3C Trace Context；缺失或非法时本地生成合法上下文并标记 `generated`；禁止用 Trace ID 作幂等键 | **建议 APPROVE** | **待 Owner 决策** | **是（契约）** |
| D-05 | Runtime Version Snapshot | 只记录真实运行时版本；未知时标记 `unavailable` 或省略，不得伪造或回填 latest | **建议 APPROVE**（原则）；字段来源未决项不得在批准时被默认值掩盖 | **待 Owner 决策** | **部分阻塞** |
| D-06 | API Compatibility | 正式 Adapter 不开放 GET 查询；未知字段不持久化；64 KiB 作为初始请求体上限**候选**（数字待批）；按 Tenant + Service Identity 限流 | **建议 APPROVE** | **待 Owner 决策** | **是** |
| D-07 | WAL Dependency | 在 OpenBot 仓库内实现默认关闭的本地异步缓冲，不依赖尚未合并的 PR #4；语义为 at-least-once，不得宣称 exactly-once | **建议 APPROVE** | **待 Owner 决策** | **是** |

既有已接受原则（不是本轮 D-01–D-07 的批准）见第 6 节。

---

## 5. D-01–D-07 逐项完整决策记录

### D-01 Personal TrustedScope / Tenant

| 项 | 内容 |
| --- | --- |
| 决策 ID | D-01 |
| 选项 | A. 第一期仅企业范围正式出站，个人 TrustedScope 允许且应当没有 Tenant ID，不虚构 Personal Tenant。B. 扩展对端契约，增加一等 `scopeKind`，个人按已验证 `subjectId` 分区、禁止 `tenantId`。C. 用 `personal:${subject}` 或哈希冒充 `tenantId`（不推荐）。 |
| 建议方向 | 方案 A 作为实施第一期；方案 B 仅列为后续扩约候选，须另审。拒绝方案 C。 |
| 建议的 Owner 结论 | **建议 APPROVE** 方案 A。 |
| 状态 | **待 Owner 决策**。不是已批准。 |
| 源码对照 | **SUPPORTED**（跨仓契约冲突见第 7 节，不改变建议方向）。 |
| 是否阻塞实施 | **是**。 |
| 批准人 | 架构负责人 Yolanda Lee。 |

**当前源码事实（源码验证事实）**

- OpenBot `TrustedScope` 是判别联合类型：个人分支只有 `personalDomainId`、`subjectRef`、`authzScopeRef`，**没有** `tenantId`；企业分支有 `enterpriseDomainId`、`tenantId`、`subjectRef`、`authzScopeRef`（`openbot-vp@f3558f2` `src/task-outcome/types.ts` 第 63–71 行）。
- `scopeFromChatEntry`：`tenantId` 非空则构建 enterprise（`enterpriseDomainId = enterprise:${tid}`）；否则构建 personal（`personalDomainId = personal:${subject}`），且空 `subjectRef` 会被填成 `"anonymous"`（`src/task-outcome/chat-entry.ts` 第 47–65 行）。
- `scopeIdOf` 对个人返回 `personalDomainId`，对企业返回 `enterpriseDomainId`（`src/task-outcome/transitions.ts` 第 14–15 行）。内部 `OutcomeOutboxEvent` 只带 `scopeKind` + `scopeId`，不带对端 `tenantId`（`types.ts` 第 221–229 行）。
- `callerOwnsTaskOutcome`：企业要求 caller 的 `tenantId` 与 scope 一致；个人只校验 `subjectRef`（`src/task-outcome/reject-result.ts` 第 39–51 行）。个人隔离的权威维度是 subject，不是租户。
- AI Optimization `TelemetryEvent.tenantId` 与 `AuthContext.tenantId` 均为必填 `string`（`16b01d99` `packages/shared-contracts/src/index.ts` 第 16–28 行）。`verifyJwtAuth` 缺少 `sub` 或 `tenantId` 即失败（`packages/shared-contracts/src/auth.ts` 第 98–100 行）。`ingest` 要求 `event.tenantId === auth.tenantId`（`services/telemetry-ingestion/src/index.ts` 第 22–23 行）。`listForTenant` 按 `auth.tenantId` 返回该租户全部事件，无角色细分（同文件第 54–59 行；`services/http-api/src/server.ts` 第 67–69 行）。
- 源码中企业员工 Personal Space 与独立个人用户都表现为 `kind: "personal"`，**没有**再分成两种 Tenant。

**建议理由**

承认个人 TrustedScope 可以且应当没有 Tenant ID，才能避免“为满足当前 API 而虚构 Tenant ID”。第一期只出站已验证的企业范围，可在不改对端必填 `tenantId` 之前，先堵住个人数据进入企业租户桶的路径。方案 C 会把 `personal:${subject}` 甚至 `personal:anonymous` 变成租户键，造成跨主体污染，应拒绝。

**必须补齐的隔离规则（建议，待批）**

1. **官方出站判定键是 OpenBot `TrustedScope.kind`，不是“同一个自然人是否恰好也有企业账号”。** `kind: "personal"` 的运行、反馈、日志、引用、附件、知识条目，第一期 **一律不出站、不入库**。
2. **禁止间接进入 Enterprise Tenant。** 即使某企业运行的主体同时也有 Personal Space，也不得把该 Personal Space 中的任务结果、用户反馈、日志、引用、附件、文件或知识片段，附加或内嵌到企业租户遥测事件中。不得把个人 `scopeId` / `personalDomainId` 写入企业事件的 `tenantId` 或当作租户分区键。
3. **企业运行只允许企业范围内已授权、已脱敏的摘要。** 若一条企业事件需要引用外部对象，引用目标也必须属于同一已验证 `tenantId`。来源不明或跨 scope 的引用，第一期应省略该引用，而不是为了“完整”而带入个人内容。此交叉引用的未来白名单路径 **未决**，默认拒绝。
4. **诊断通道不得充当官方载荷来源。** OpenBot `diagnostics.cacheTrace.includePrompt` 默认 true（`src/config/schema.help.ts` 第 615 行）属于独立诊断配置，可能包含 prompt / 消息全文，**不得**作为 Adapter 事件来源。
5. **企业员工 Personal Space 与独立个人用户采用同一归属策略：** 均为个人范围，隔离键是已验证主体，而不是其雇主 `tenantId`。二者第一期都不写入企业租户桶。不得为其中任何一类发明 Personal Tenant ID。
6. **管理员权限不得默认打通个人内容。** 即使未来批准方案 B，企业 `owner` / `operator` / `approver` 也不得默认列举或读取个人分区。现行无角色细分的 `listForTenant` 恰好说明：若错误把个人数据写入企业 `tenantId`，租户内持有令牌的调用方即可读到。
7. **不得虚构 Tenant ID。** 禁止使用 `personal:${subject}`、`personal:anonymous`、`personal:runner`、主体哈希、或任何发送时临时生成的值去填充对端必填 `tenantId`。

**Token 中 `tenantId` / `scope` / `subject` 的建议表达（第一期，待批）**

- `sub`：IdP 签发的主体（Service Identity 或已认证 User），不得为空，不得在出站侧改写为 `anonymous` / `runner`。
- `principalType`：`user` 或 `service`（与现行 `auth.ts` 第 102 行一致）。
- `tenantId`：仅企业；**只来自已验证令牌**，不来自请求体，不来自 OpenBot `personalDomainId`。
- 可选 `scopeKind=enterprise`（显式约束，避免默认推断）。
- 若未来另审批准个人扩约（方案 B）：Token 应显式 `scopeKind=personal`，**省略** `tenantId`，并以 IdP 签发的 `sub` 为隔离键；同时必须改对端 `AuthContext` / 入库 UNIQUE 维度。这不是本阶段默许的实施范围。

**影响的接口或模块**

OpenBot 出站 Adapter（尚未实现）；对端 `AuthContext`、`TelemetryEvent.tenantId`、`verifyJwtAuth`、`ingest` 租户匹配、`listForTenant`；OpenBot `TrustedScope` / `scopeFromChatEntry`（内部账本不在本阶段擅自修改）。

**验收条件（获批后方可用于实施计划，本轮不实施）**

- 个人 scope 事件在官方出站被拒绝，且对端无对应入库记录。
- 用 `personal:…` 或任何合成值填充 `tenantId` 的请求被拒绝。
- 企业员工 Personal Space 的反馈、日志、引用、附件不会出现在该员工所属企业 `tenantId` 的事件或其 payload 中。
- Token 的 `tenantId` 来自令牌而非 body；body 不一致则拒绝。
- 测试不得为了“让当前 API 变绿”而发明 Tenant ID。

**未决风险**

- 个人场景第一期没有官方遥测，优化闭环推迟。是否以及何时升级到方案 B，**待另审**，本轮不臆造 IdP 是否预配“个人租户”。
- 企业内部运行误标为 personal、或 personal 运行被错误带上某个 `tenantId` 从而在 `scopeFromChatEntry` / `defaultScope` 中升级为企业——这是既有入口行为，Adapter 必须在出站前再校验已验证身份，不得盲信内部回退后的 scope。该入口是否改革 **不在本 Adapter 范围擅自修改**（待 Owner 决定是否另开议题）。
- 交叉引用/附件的完整治理策略在方案 A 下默认拒绝，细节仍待产品补充，但不得用默许夹带代替决策。

---

### D-02 anonymous / runner 身份

| 项 | 内容 |
| --- | --- |
| 决策 ID | D-02 |
| 选项 | A. 分层：内部 TaskOutcome 回退不在本阶段擅自修改；官方出站与入库对 anonymous / runner 失败封闭，认证失败不得降级写入。B. 允许其进入专用“未认证诊断桶”（不推荐）。 |
| 建议方向 | 方案 A。拒绝方案 B 作为官方契约。 |
| 建议的 Owner 结论 | **建议 APPROVE** 方案 A 及下表。 |
| 状态 | **待 Owner 决策**。 |
| 源码对照 | **SUPPORTED**。 |
| 是否阻塞实施 | **是**。 |
| 批准人 | 架构负责人 Yolanda Lee。 |

**当前源码事实（源码验证事实）**

- 空 `subjectRef` → `"anonymous"`，并可生成 `personalDomainId: personal:anonymous`（`chat-entry.ts` 第 47–65 行）。这是 TaskOutcome 入口回退，不是遥测出站。
- `defaultScope`：无 `tenantId` 时为 `{ kind: "personal", personalDomainId: "personal:runner", subjectRef: "runner", authzScopeRef: "agent-runner" }`；有 `tenantId` 时为企业，但 `subjectRef` 仍为 `"runner"`（`runtime-from-runner.ts` 第 1007–1023 行）。
- HTTP `authenticate` 在未配置校验器时抛 `missing_token`；`AuthError` 返回 401/403，不继续 `ingest`（`server.ts` 第 33–48、113–124 行）。对端 **没有** 认证失败降级为 anonymous 写入。`principalType` 仅 `user` | `service`（`auth.ts` 第 102–121 行）。
- `normalizeAgentId` 在空输入或清洗后为空时回退到 `DEFAULT_AGENT_ID = "main"`（`src/routing/session-key.ts` 第 19、89–106 行）。

**建议策略表（待批）**

| 身份 | 是否允许发送 | Tenant 规则 | 跨租户 | 是否可关联 Agent | 允许事件范围 | 审计要求 |
| --- | --- | --- | --- | --- | --- | --- |
| anonymous（含空 subject、合成 `personal:anonymous`） | **No** | 不适用；不得发明租户 | 默认拒绝；发送即失败 | No | 无 | 记录拒绝原因与来源；不得入库 |
| runner（`subjectRef=runner` / `personal:runner` / 仅 runner 回退；即使携带了某个 tenantId） | **No** | 不得出站 | 默认拒绝 | No | 无 | 同上 |
| 已认证 User | **Yes，受限** | 仅企业第一期：Token 中已验证的 `tenantId`；body 不得覆盖。个人范围按 D-01，第一期不出站 | 默认拒绝 | 仅当该 User 被明确授权为该 Agent 的操作者（默认 No，除非另审授权模型） | 建议仅用户反馈类（如 `runtime.feedback.recorded`）；默认 **不允许** 用户直接投递运行时 / 模型 / 工具事件 | `subject`、`principalType=user`、`tenantId`、来源组件 |
| 已认证 Service Identity | **Yes** | 仅 Token 中已验证的企业 `tenantId` | 默认拒绝 | 不可任意填 Agent；必须通过 D-03 绑定后才能带 `agentId` | 运行时事件白名单：`runtime.run.*`、`runtime.model.called`、`runtime.tool.called`、`runtime.task_outcome.recorded`（摘要，非完整账本） | `sub`（服务主体）、`principalType=service`、`tenantId`、来源系统/组件 |
| Service Identity 代表 Agent | **Yes** | 同上，Tenant 必须与 Agent 所属租户一致 | 默认拒绝 | **必须** 通过 Tenant + Service Identity + Agent 三方绑定且 allowlist 命中 | 同上，且 `traceContext.agentId` 必须等于被授权 Agent | 上列字段 + `agentId` + allowlist 版本或引用 |

**认证失败、身份缺失、跨 Tenant 的拒绝规则（待批）**

- 缺令牌、畸形令牌、签名失败、issuer / audience 失败、过期、尚未生效（nbf）、缺 `sub`、企业路径缺 `tenantId` 声明：对端返回 401 或 403，**停止**。出站侧不得发送。
- **特别禁止：** 身份认证失败后自动降级为 anonymous（或 runner）并继续同租户或跨租户写入。
- body 中的 `tenantId` 与令牌不一致，或请求试图写入令牌租户以外的分区：403，不得入库。
- 身份不足以发送该事件类型（例如 User 投递 `runtime.model.called`，或 Service 未绑定却携带 `agentId`）：403，不得入库。
- 内部 TaskOutcome 仍可按现有回退继续本地任务；这 **不构成** 官方遥测授权。

**影响的接口或模块**

出站身份闸门；对端 `authenticate` / `verifyJwtAuth` / `ingest`；不得在本阶段修改 `scopeFromChatEntry` / `defaultScope` 的内部账本行为，除非 Owner 另开授权。

**验收条件**

- 无令牌、坏令牌、缺 tenant 声明的请求不能产生入库记录。
- 将失败请求改写为 anonymous / runner 后重放，仍被拒绝。
- `subjectRef=runner` 即使带企业 `tenantId` 也不得出站。
- 已认证 User 不能投递运行时模型/工具事件（除非 Owner 另行批准授权模型）。
- 跨租户请求 403，且目标租户无新行。

**未决风险**

- 严格拒绝会使现行 runner 路径在未接入可信身份前没有遥测（建议视为可接受的安全代价，仍待 Owner 确认）。
- User 作为 Agent 操作者的授权模型 **未决**，默认 No。
- `runtime.feedback.recorded` 的完整字段与脱敏规则待实施计划阶段细化，但不得回退到允许 User 投递运行时事件。

---

### D-03 Agent Allowlist

| 项 | 内容 |
| --- | --- |
| 决策 ID | D-03 |
| 选项 | A. 控制面维护 `(tenantId, serviceSubjectId, agentId)` 三元组，ingest 时查当前名单。B. 仅把允许的 `agentId` 放进 JWT claim（只可作补充，不得作为唯一撤销机制）。 |
| 建议方向 | 方案 A；短 TTL 的 claim 最多作为提示，不能替代名单。 |
| 建议的 Owner 结论 | **建议 APPROVE** 方案 A。 |
| 状态 | **待 Owner 决策**。签发机构与名单运维责任须负责人指定，目前源码中 **尚未落地**。 |
| 源码对照 | **SUPPORTED**（控制面本身 NOT VERIFIED / 未落地）。 |
| 是否阻塞实施 | **是**。 |
| 批准人 | 架构负责人 Yolanda Lee。 |

**当前源码事实（源码验证事实）**

- `ingest` 只检查 `eventId`、`idempotencyKey`、`traceContext.runId`、租户匹配、`redaction.applied`（`services/telemetry-ingestion/src/index.ts` 第 18–27 行），**不校验** `traceContext.agentId`。
- JWT 有 `principalType` 与 `disallowServiceImpersonation`（禁止 service `actAsUser`），但无 Agent allowlist claim，`AuthContext` 仅 `subjectId` / `tenantId` / `roles`（`auth.ts` 第 102–121 行；`index.ts` 第 16–20 行）。
- OpenBot `isValidAgentId` 只做格式校验；`resolveConfiguredTaskOutcomeRoot` 要求 agent 是已配置目录（`reject-result.ts` 第 54–73 行）。这是本地配置解析，不是对端授权。
- `normalizeAgentId` 可回退为 `"main"`（`session-key.ts` 第 89–106 行）。出站不得使用该回退作为授权后的 Agent。
- 两仓源码中 **均无** 已落地的官方适配器签发器或控制面名单。P0-1 只是校验库，无生产 IdP 接线（生产接线仍为 BLOCKED，本建议不授权接线）。

**建议的验证与授权逻辑顺序（待批）**

1. **认证**：校验 Bearer（issuer、audience、签名、exp/nbf、`sub`）。失败 → 401/403，停止。不得降级。
2. **租户绑定**：`tenantId` 只来自已验证令牌；body.tenantId 必须相等，否则 403。
3. **主体类型**：出站运行时事件要求 `principalType=service` 且具备 service 角色；拒绝 service 扮演用户。
4. **Agent 授权**：运行时事件应将 `agentId` 视为必填。在 **当前有效** allowlist 上查找 `(token.tenantId, token.sub, agentId)`。未命中，或 Agent 已禁用 / 删除 / 迁出该租户 → 403，不得入库。
5. **契约与二次安全**：schema、体大小、限流、独立脱敏检查（不信任 `redaction.applied` 自声明）。
6. **持久化与幂等**：按 `(已验证 tenantId, idempotencyKey)` 去重。

**Allowlist 查询失败、撤销、已接收事件（待批）**

- **名单查询失败**（控制面超时、5xx、数据不可用、本地缓存失效且无法证实当前有效）：**失败封闭**，拒绝新事件（建议 503 或 403，并写审计）。**禁止**“查询失败则默认放行”。是否允许极短的只读缓存，属实施计划细节，但缓存命中不得延长到可以绕过已发布的撤销；撤销发布后必须以当前名单为准。缓存 TTL 数值 **未决**，不得用默认值假装已定。
- **即时撤销：** Agent 被禁用、删除、迁出租户，或 Service Identity 与该 Agent 解绑后，**新事件**在下一次 ingest 查找当前名单时立即拒绝。不得只依赖 JWT 过期。
- **已接收事件：** 已经成功入库的脱敏副本 **保留**，不因后续撤销而删除或改写。遥测是 OpenBot 权威记录的副本，不是第二套 Run Ledger，也不是授权状态的权威。撤销影响的是“今后是否接受新事件”，不是改写历史副本。对已入库事件的治理删除/法定删除若未来需要，必须另审，不得与授权撤销混为一谈。
- **防冒充：** body / `traceContext` 中的 `agentId` 不得覆盖令牌主体；必须命中三方绑定。禁止把格式合法但未绑定的 id 当作已授权。禁止把 `normalizeAgentId` 回退得到的 `"main"` 做出站 Agent。

**职责建议（待 Owner 指定，当前未落地）**

- **谁签发 Service Identity：** 由架构负责人指定的平台 IdP（作为 AI Optimization 配置的 issuer），而不是 OpenBot 进程自己签发可被客户端任意伪造的令牌。本建议 **不授权** 生产接线。
- **谁维护 Agent allowlist：** 该企业租户的授权管理员 + 平台控制面；适配器与入库只消费名单，不在事件里“自称已授权”。具体角色与变更审计流程 **未决**，须负责人指定。

**影响的接口或模块**

对端 ingest 授权；尚未存在的控制面名单 API；出站侧在发送前的本地拒绝（减少无授权流量，但不替代对端强制查找）。

**验收条件**

- 合法 Service Identity 填写未绑定 `agentId` 被 403，且无入库。
- 绑定解除或 Agent 禁用后，新事件立即被拒；解除前已入库事件仍在，且未被改写。
- 名单查询失败时新事件被拒，而不是被接受。
- 出站路径不使用 `normalizeAgentId` 回退值。

**未决风险**

- 控制面与生产 IdP 均不存在；无 Owner 指定的签发机构与运维责任前，不能实施运行时事件出站。
- 名单延迟可能导致短暂误拒；若错误只信 JWT claim，则存在短暂误放窗口——故 claim 不得作为唯一机制。
- 名单本身不可含密钥。

---

### D-04 Trace Context

| 项 | 内容 |
| --- | --- |
| 决策 ID | D-04 |
| 选项 | A. 官方出站强制 W3C Trace Context 语义。B. 允许任意不透明 `traceId`（不推荐）。 |
| 建议方向 | 方案 A。 |
| 建议的 Owner 结论 | **建议 APPROVE** 方案 A 及下列契约。 |
| 状态 | **待 Owner 决策**。 |
| 源码对照 | **SUPPORTED**。 |
| 是否阻塞实施 | **是（契约）**。 |
| 批准人 | 架构负责人 Yolanda Lee。 |

**当前源码事实（源码验证事实）**

- 在 `openbot-vp@f3558f2` 的 `src/` 与 `extensions/` 检索，**未找到** `traceparent` / `tracestate` 字符串作为 W3C 传播实现。存在默认关闭的 OTLP 出口（`extensions/diagnostics-otel/src/service.ts` 第 80–85 行：未同时启用 `diagnostics.enabled` 与 `otel.enabled` 则直接 return），与官方 Adapter **不是**同一通道。
- `TaskOutcomeRecord` **没有** `traceId` 字段；有 `decisiveRunId` / `runs[].runId`（`types.ts`）。
- 对端 `TelemetryEvent.traceContext.traceId` 与 `runId` 在类型上为必填字符串（`packages/shared-contracts/src/index.ts` 第 33–35 行），但 `ingest` 只强制 `runId`，**不校验** `traceId` 格式或 W3C 合规（ingestion 第 19–20 行）。
- OpenBot 内部事件 id 已存在且与 trace 无关：`eventIdFor(taskId, outcomeVersion, eventType)` → `evt_` + SHA256 截断（`src/task-outcome/result-service.ts` 第 56–61 行）。

**建议的统一 Trace Context 契约（待批）**

- **`traceparent` 校验：** 仅接受 W3C Trace Context 版本 `00`（若未来需支持更高版本须另审）。格式为 `{version}-{trace-id}-{parent-id}-{trace-flags}`，四段以 `-` 分隔。`trace-id` 必须是 32 位小写十六进制，且不得为全 0；`parent-id` / `span-id` 必须是 16 位小写十六进制，且不得为全 0；`trace-flags` 为 2 位小写十六进制。大小写不合规、段数错误、长度错误、全 0，均视为非法。
- **`tracestate` 校验：** 若存在，须符合 W3C `tracestate` 的 key/value 列表约束（可解析、长度与成员数量合法）。非法则 **丢弃 tracestate**，但不得因此丢弃已经合法的 `traceparent`。不得把非法 `tracestate` 原样写入事件。
- **有合法上游 `traceparent`：** 解析并沿用其 `trace-id` 与上游 `parent-id`；出站可生成新的非全 0 `span-id`；填写 `traceContext.traceId`、可选 `spanId` / `parentSpanId`。来源标记为 `propagated`。
- **上游缺失或非法：** **不得** 把非法值写入 `traceContext.traceId`。由 OpenBot 出站侧生成合法 W3C 上下文：使用密码学安全随机数生成 16 字节 `trace-id`、8 字节 `span-id`（均不得为全 0），构造 `00-{trace-id}-{span-id}-{flags}`（`flags` 是否采样的具体值 **未决**，实施前须确定，不得静默写死后当作已批标准；在未批前不得把采样策略写成已定）。来源标记为 `generated`。生成失败则该事件不出站（失败封闭），但 **不得** 因此失败 Agent 任务或 TaskOutcome 写入。
- **`traceContext.traceId` 与 W3C Trace ID 的关系：** **必须相等**。即 `traceContext.traceId` 等于 `traceparent` 中的 32 位 `trace-id`，小写十六进制，无 `0x` 前缀，无分隔符。
- **与 `runId` 的关系：** `traceContext.runId` 必须能对应 OpenBot 的运行标识（优先 TaskOutcome `runs[].runId` / `decisiveRunId`）。runId **不是** Trace ID，不得互相顶替。
- **幂等键：** **禁止** 用 Trace ID 作为 `idempotencyKey`。同一追踪下多次模型/工具调用共享 Trace ID 是预期行为。推荐幂等键派生自稳定事件身份（例如 OpenBot `eventId` `evt_…` 或 `source.system + eventId`），并与租户隔离键组成 UNIQUE。
- 对端应校验 `traceId` 的 W3C 格式；不合规则拒绝该事件，且不影响 OpenBot 主路径。
- 不得把 OTel 诊断通道与 Adapter 混为同一出口。

**影响的接口或模块**

出站 Trace 构造；对端 `traceContext` 校验；幂等键生成（与 D-06 共同约束）。

**验收条件**

- 合法 `traceparent` 被传播，`traceContext.traceId` 等于其 trace-id。
- 非法或缺失上游时，出站事件带有合法 W3C `trace-id` 且标记 `generated`，不转发非法值。
- 以 Trace ID 作为 `idempotencyKey` 的事件被拒。
- 同一 trace 下两条不同事件（不同 `eventId`）均可被接受（在其他校验通过时），证明 Trace ID 不是幂等键。
- 生成失败或出站失败不导致 Agent 任务失败。

**未决风险**

- 生成新 trace 会使与上游网关的跨系统关联变弱（用 `generated` 标记保持可观测）。
- `trace-flags` 采样位、以及是否强制记录 `spanId` / `parentSpanId` 的必填性 **未决**。
- 对端当前不校验格式，获批后属于契约变更，需在实施计划中单列，不得在未批时编码为已定行为。

---

### D-05 Runtime Version Snapshot

| 项 | 内容 |
| --- | --- |
| 决策 ID | D-05 |
| 选项 | A. 只记录该次运行实际使用的版本；拿不到就省略或显式 `unavailable`，禁止回填 latest。B. 所有版本字段一律必填，缺失即拒绝（不适合作为第一期硬条件，除非负责人明确要求）。 |
| 建议方向 | 方案 A。 |
| 建议的 Owner 结论 | **建议 APPROVE** 原则与“不得伪造”规则；同时接受下表中若干字段来源仍为 **未决 / 待验证**，不得用猜测映射去填满表格。 |
| 状态 | **待 Owner 决策**。 |
| 源码对照 | **SUPPORTED**（原则）；部分字段来源 **NOT VERIFIED**。 |
| 是否阻塞实施 | **部分阻塞。** “不得回填 latest”与模型/工具事件的最小必填集未批不得编码这些事件。 |
| 批准人 | 架构负责人 Yolanda Lee。 |

**当前源码事实（源码验证事实）与字段来源**

通用禁令（建议）：禁止用“当前最新”配置、默认模型、仓库 tip 或今日最新型号代替历史运行时版本。禁止把 prompt 全文、工具原始参数中的密钥 / PII 作为版本快照的一部分。`runtime.task_outcome.recorded` 只允许脱敏摘要，禁止把完整 `TaskOutcomeRecord` 复制为第二账本。

| 字段 | 适用事件 | 建议必填性 | 本轮已验证的真实运行时对象 | 无法获得时 | 对照 |
| --- | --- | --- | --- | --- | --- |
| Model Provider | `runtime.model.called` | 该事件若出站则必填 | `ModelCallEvidence.provider`（`src/executor-evidence/model-call-evidence.ts` 第 29–44、43 行） | 不出站该模型事件；不得填 `"latest"` 或默认供应商 | SUPPORTED |
| Model ID | 同上 | 必填 | `ModelCallEvidence.model`（同文件第 44 行） | 同上 | SUPPORTED |
| Model Version（供应商单独提供的版本串） | 同上 | 可选 | **未找到** `ModelCallEvidence` 上的独立 `modelVersion` 字段 | 省略或显式 `unavailable` 并记录原因码；不得用今日最新版本顶替 | **NOT VERIFIED**（无依据则不得编造来源） |
| Prompt Version | 实际使用了受版本管理 Prompt 的运行时事件 | 若该次调用确有 Prompt 版本则应记录 | **未找到** Agent 模型调用上的统一 Prompt 版本字段。`src/conversations/projection.ts` 第 23–28、48 行的 `promptVersion` / `PROJECTION_PROMPT_VERSION = "rule-v2"` 属于会话投影，**不得**当作 Agent 运行时 Prompt 版本 | 无受管 Prompt 则省略；禁止回填当前生产 Prompt 或投影常量 | **NOT VERIFIED**（运行时 Prompt 版本对象待验证） |
| Tool Name | `runtime.tool.called` | 必填 | 尝试级 `toolObservations[].toolName`（`types.ts` 第 51 行）；另有 modality 产物上的 `toolName`。注意部分路径使用聚合名 `turn_tools`（`runtime-from-runner.ts` 约第 1262–1264 行），不得把聚合名冒充为未观测到的具体工具 | 无真实工具名则不出站该工具事件 | SUPPORTED（名称）；聚合名限制须在实施时遵守 |
| Tool Version | 同上 | 可选 | `toolObservations` 仅有 `toolName` / `ok` / `summary`，**无** `toolVersion` | 省略 / `unavailable`，不得用最新工具版本顶替 | **NOT VERIFIED** |
| Policy Version | 当该策略实际参与判定/授权的运行时事件 | 可选，有则记实际版本 | `TaskOutcomeRecord.judgementPolicyVersion` 与常量 `JUDGEMENT_POLICY_VERSION`（`types.ts` 第 10–11、161 行）；验收证据 `validatorVersion`（第 75 行）。对端预留了可选 `toolPolicyVersion`，但 OpenBot 无统一 Agent/Tool Policy 快照对象 | 省略 / `unavailable`；不得另造 | 判断策略：部分 SUPPORTED。Agent/Tool Policy：**NOT VERIFIED** |
| Agent Version | 运行时事件 | 可选 | 在 `openbot-vp@f3558f2` 非测试 `src/` 中 **未找到** `agentVersion` 字段 | 省略 / `unavailable`；不得用当前部署 latest | **NOT VERIFIED** |
| Experiment ID | 仅当该运行确属某实验 | 可选 | Evolution Control / `evolution-core` 存在 `experimentId`，但 **未验证** TaskOutcome 或 `ModelCallEvidence` 上存在“本次 Agent 运行已绑定该实验”的字段 | 无绑定则省略；禁止填入正在进行的其他实验 ID，也禁止从控制面“当前实验”回填 | **NOT VERIFIED**（运行绑定待验证） |
| Task / Judgement / Contract 版本 | `runtime.task_outcome.recorded` 摘要 | 可选，优先使用记录上已有字段 | `taskContractVersion`、`judgementPolicyVersion`、可选 `taskContract.version`、`schemaVersion`（`types.ts`） | 省略；不得另造 | SUPPORTED |

**影响的接口或模块**

出站快照组装；对端 `traceContext` 可选字段语义；`ModelCallEvidence` 与 `TaskOutcomeRecord` 只读消费。不在本阶段扩展这些对象，除非实施计划获另授权。

**验收条件**

- 模型事件同时具备该次调用的 `provider` 与 `model`，否则不出站。
- 测试证明：当某可选版本缺失时，事件为省略或 `unavailable`，而不是被填入 latest / tip / 默认模型。
- `runtime.task_outcome.recorded` 不含完整 TaskOutcome 记录，只含脱敏摘要。
- 不得把会话投影的 `PROJECTION_PROMPT_VERSION` 写入 Agent 运行时 Prompt 版本。

**未决风险**

- 多个可选字段当前没有权威运行时对象，分析侧会有缺口。这应予承认，而不是用猜测填满。
- 若 Owner 改为方案 B（全部必填），将在统一快照建成前全面阻塞出站。
- 错误回填 latest 会造成不可逆的训练/评估关联污染。

---

### D-06 API Compatibility

| 项 | 内容 |
| --- | --- |
| 决策 ID | D-06 |
| 选项 | A. 官方 Adapter 契约以 POST 入库为准，不把 GET 列为官方查询接口；未知字段丢弃不落库；64 KiB 作为初始体上限候选；按 Tenant + Service Identity 限流；出站生成幂等键。B. 保留未加角色与分页的 GET，或 reject-unknown 作为第一期硬模式（不推荐为默认）。C. 等待共享约定以外的宽松无限体（拒绝）。 |
| 建议方向 | 方案 A。64 KiB 与限流数量级是**候选值，待批**，不是已批准标准。 |
| 建议的 Owner 结论 | **建议 APPROVE** 方案 A，并由 Owner 确认或改写阈值数字。 |
| 状态 | **待 Owner 决策**。 |
| 源码对照 | **SUPPORTED**（实现与 OpenAPI 漂移见第 7 节）。 |
| 是否阻塞实施 | **是**。 |
| 批准人 | 架构负责人 Yolanda Lee（含具体阈值）。 |

**当前源码事实（源码验证事实）**

- HTTP：`POST /v1/telemetry/events` 与 **未在 OpenAPI 声明的** `GET /v1/telemetry/events`（`services/http-api/src/server.ts` 第 56–69 行）。GET 在认证后调用 `listForTenant`，按 `auth.tenantId` 返回全部事件，**无角色细分、无分页、无条目上限**。
- OpenAPI 仅 `post`，响应 202/400/403（`contracts/openapi/ai-optimization-v1.yaml` 第 7–14 行）。与实现漂移。
- `readJsonBody` 无限读取（`server.ts` 第 19–26 行）。无未知字段白名单；`payload` 为 `Record<string, unknown>`，整份 event 被 `JSON.stringify(event)` 入库（ingestion 第 40 行），未知字段会被持久化。
- 幂等：`UNIQUE (tenant_id, idempotency_key)`（`packages/shared-contracts/src/db.ts` 第 15–22 行）；`ingest` 要求键存在，但不校验格式，也不禁止用 traceId 当键。
- 在 `services/http-api` 与 `packages/shared-contracts` 的遥测入站路径上，**未找到** 按 Tenant 或 Service Identity 的限流，也 **未找到** 64 KiB 体上限（OIDC JWKS 客户端另有 `readResponseBodyBounded`，与遥测入站无关）。

**建议细则（待批）**

1. **GET /v1/telemetry/events：** 不纳入官方 Adapter 契约。第一期出站只依赖 POST 入库。若现有 GET 暂时保留在 HTTP 服务器中，必须加角色门槛（例如仅 `owner` / `operator` / `approver`，禁止普通 service 身份列举）、分页与上限，并补进 OpenAPI 或从实现中删除以消除漂移。推荐方向是官方契约删除或降级该 GET，而不是把它当成适配器查询接口。
2. **未知字段：** 丢弃且不持久化。缺少必填字段或必填字段非法则拒绝整事件。不为了兼容而把未知键写入 `payload_json`。不推荐第一期用 reject-unknown 导致任何附加字段即失败，除非负责人要求严格模式。
3. **64 KiB 超限：** 建议硬上限 **64 KiB** 为初始候选。超限返回 **413**（若 Owner 改用 400，须在批准中明示）。在达到上限时停止继续读取；**不得解析、不得入库、不得把截断体当合法事件**。审计至少记录：已验证 `tenantId`、Service Identity `sub`、声明或观测到的大小、原因码（如 `payload_too_large`）、时间。计量上将超限拒绝与成功接受、校验拒绝、限流拒绝分开计数。精确数字待批。
4. **限流：** 同时按 **Tenant** 与 **Service Identity（token.sub）** 执行；任一维度超限返回 **429**。出站侧必须把 429 视为可恢复错误，**不得** 失败 Agent 任务。建议作为起点的数量级（**待批，不是标准**）：每 Service Identity 约 100 事件/秒，每 Tenant 约 1000 事件/秒，可突发短窗。最终数值由负责人定。限流键必须使用已验证令牌中的身份，不得使用 body 自称值。
5. **幂等键：** 由 OpenBot 出站生成，不得用 Trace ID（与 D-04 一致）。推荐使用稳定 `eventId` 或由其派生的键；非空、最大长度建议 128、允许 `evt_` + hex 或等价受限字符集；校验失败 400。去重键为 `(isolationKey, idempotencyKey)`，第一期 isolationKey = 已验证 `tenantId`。重复返回已有的 202 `duplicate: true`，**不覆盖**已入库载荷。

**影响的接口或模块**

`services/http-api/src/server.ts`、`TelemetryIngestionService`、OpenAPI、出站客户端的重试与限流处理。

**验收条件**

- 官方 Adapter 文档与契约不把未加角色/分页的 GET 当作查询接口。
- 带未知字段的事件入库后，`payload_json` 不含被丢弃的未知键；必填缺失则整事件拒绝。
- 超过批准上限的请求返回约定状态码，无新行，且有审计与独立计量。
- 超限流返回 429；出站重试不失败 Agent 任务。
- 相同 `(tenantId, idempotencyKey)` 重放返回 `duplicate: true` 且不覆盖；用 traceId 当幂等键被拒。

**未决风险**

- 64 KiB 可能截断过大摘要（应在出站侧先裁剪）。该上限是候选，Owner 可改写。
- 限流过严会增加本地丢弃，需要指标；数量级未批。
- 丢弃未知字段要求发送方版本协商。
- 现有 GET 若在实施前仍保留且不加门槛，将继续扩大读面——这是获批后必须处理的漂移，不是现在就可以忽略的细节。

---

### D-07 WAL Dependency

| 项 | 内容 |
| --- | --- |
| 决策 ID | D-07 |
| 选项 | A. 在 `openbot-vp` 仓库内实现默认关闭的有界异步缓冲，不依赖尚未合并的 PR #4，也不把 `main` 弱 WAL 当作已满足崩溃恢复。B. 等待 PR #4 合并后再做出站 WAL（拒绝作为默认依赖）。 |
| 建议方向 | 方案 A。PR #4 合并必须另审，不是本决策的默许实施路径。 |
| 建议的 Owner 结论 | **建议 APPROVE** 方案 A。 |
| 状态 | **待 Owner 决策**。 |
| 源码对照 | **SUPPORTED**。 |
| 是否阻塞实施 | **是**（依赖关系必须先被负责人确认）。 |
| 批准人 | 架构负责人 Yolanda Lee。 |

**当前源码事实（源码验证事实）——须区分两套实现**

- **OpenBot 侧：** 在当前 `f3558f2` 未找到面向 AI Optimization 官方 Adapter 的出站缓冲。
- **AI Optimization `main` @ `16b01d99` 的 `packages/telemetry-sdk`：** 存在较弱 WAL：`persistWalAtomic` / `enqueue` / `flush` 在多处 `catch` 后吞掉错误；队列满时 `shift()` 丢弃；`origin/main` **没有** `packages/telemetry-sdk/src/wal-lock.ts`。不得把该实现描述为已满足崩溃恢复。
- **PR #4 @ `8324aa2`（未合并，不是 `main` 能力）：** 在 AI Optimization 客户端 WAL 上实现了更强的单写者锁、清理哨兵、I/O fail-closed 与 at-least-once 重放，并由该 PR 的工程文档与 CI 证明 **该分支自身**。这 **不是** OpenBot 出站缓冲，也 **不得** 当作 Adapter 开工前提。

**建议：OpenBot 缓冲应满足的语义（学习点，不是把 PR #4 设计复制为 OpenBot 实现）**

下列条目是对 OpenBot 仓内缓冲的**建议要求**。标注“PR #4 中已实现”的内容仅作为对照，实施时不得预设复用该未合并代码。

| 语义要求（OpenBot 缓冲应满足） | 说明 | PR #4 对照（未合并，仅学习点） |
| --- | --- | --- |
| 默认关闭，异步旁路 | 未显式启用则不出站、不写缓冲；启用后失败也不得同步阻塞 Agent 主执行链或 TaskOutcome 写入 | 不适用（那是对端 SDK 客户端） |
| 交付语义为 **at-least-once** | 允许在 send 成功但本地清理未完成、或重试整批时重复投递。下游必须按 `idempotencyKey` 去重。**不得宣称 exactly-once** | PR #4 文档明确 at-least-once，且写明 send 成功不等于 WAL 生命周期结束 |
| 单写者进程锁 | 同一缓冲路径同一时刻只能有一个活持有者。持有者崩溃（含 SIGKILL）后锁必须可安全回收，且回收过程不得让两个活进程同时持有，也不得在 close 时误删后继者的锁 | PR #4 `wal-lock.ts` 用 Linux 抽象 Unix socket 解决 stale unlink 竞态；非 Linux 当前 fail-closed。这是其实现选择，不是要求 OpenBot 复制该机制，但等价安全目标应被满足 |
| 初始化 / 读写失败 fail-closed | 不得在持久化未成功时仍把缓冲标为“已启用并安全”。I/O 错误应显式失败并保持可恢复状态，而不是吞掉异常后继续声称已持久 | PR #4 将 init/I/O 失败改为抛错并将状态置为失败；`main` 弱 WAL 仍吞异常 |
| 崩溃恢复与清理顺序 | 恢复不得把已经完成导出且进入退役/清理意图的事件重新当作未导出事件复活。清理前崩溃可以重放（at-least-once）。容量满时不得驱逐尚未确认的在途事件，而应拒绝新事件并审计 | PR #4 使用 cleanup sentinel，禁止在哨兵存在时晋升 leftover `.complete`；并修复了重叠 flush、空锁文件、目录读取失败被当成空目录等问题。OpenBot 实现不必照搬文件名，但应满足同等语义 |
| 重试 | 对可恢复错误（网络、429、5xx）重试；不可恢复错误（401/403/400 中的契约拒绝）不得靠重试“变合法”。重试不得失败 Agent 任务 | PR #4 客户端按批重试，部分成功依赖下游幂等 |
| 幂等 | 出站事件必须带稳定 `idempotencyKey`（见 D-06）。缓冲重放不得生成新的幂等键 | PR #4 明确下游按 `idempotencyKey` 去重 |

**明确不是本决策内容的事项**

- 不把 PR #4 合并视为 Adapter 实施前提。
- 不把 `main` 弱 WAL 当作 OpenBot 可以依赖的崩溃恢复能力。
- 不在本阶段把 AI Optimization 共享库抽进 OpenBot。若负责人 **另行** 批准合并 PR #4，再考虑是否抽取共享库——那是另一授权。
- 不在本阶段编写缓冲代码。

**影响的接口或模块**

未来位于 `openbot-vp` 仓库内的出站缓冲（路径未定，不得提前创建实现分支）；对端 ingest 幂等；与故障隔离原则（第 6 节）的关系。

**验收条件（获批并进入实施计划后）**

- 默认关闭时，无出站、无因缓冲产生的主路径失败。
- 文档与测试只声明 at-least-once，不出现 exactly-once 宣称。
- 存在可验证的单写者、崩溃恢复、清理不复活已退役事件、容量拒绝并审计、可恢复错误重试 + 幂等去重的验收项。
- 实施计划的依赖图不把 PR #4 列为默认 blocker。

**未决风险**

- 仓内缓冲将来可能与共享 WAL 重复，但避免错误依赖未合并 PR。
- 进程锁的具体原语（抽象 socket、flock 或其他）未定；须在实施计划中按平台能力选择，并写明非目标平台的 fail-closed 行为。
- 未提交写入在崩溃时仍可能丢失——这与 at-least-once / 非断电耐久声明一致，必须写明，不得暗示断电级耐久。
- PR #4 自身仍 OPEN，其合并策略（合并、关闭、或改方向）须另审，见第 9 节。

---

## 6. 架构边界一致性检查

下列五条是此前已由负责人接受的原则，可记为 **已接受原则**。它们 **不是** 本轮对 D-01–D-07 的批准，也不得与待批决策混淆。本轮建议稿已对照这五条，**未发现建议决策会破坏这些边界**。

| 已接受原则 | 对照结果 | 证据 |
| --- | --- | --- |
| OpenBot 仍是唯一 TaskOutcome 权威 | 保持。官方事件 `runtime.task_outcome.recorded` 只允许脱敏摘要；禁止把完整 `TaskOutcomeRecord` 复制为第二账本。对端仅有 `telemetry_events` 副本表 | 章程 `docs/architecture/SYSTEM_BOUNDARIES.md` 第 4、8 行（`16b01d99`）；OpenBot `DurableTaskOutcomeStore` / `TaskOutcomeRecord` |
| Adapter 不得绕过 Evolution Control | 保持。本 Adapter 范围不含制品应用或直接改生产配置。D-05 即使记录 `experimentId`，也只在“该运行确已绑定”且来源可验证时记录，不形成第二条进化控制路径 | 章程第 4–9 行 |
| AI Optimization 故障不得同步阻塞 OpenBot Agent 主执行链 | 保持。D-02/D-04/D-06/D-07 均要求出站失败、限流、生成 Trace 失败、缓冲失败不得失败 Agent 任务；缓冲默认关闭、异步旁路 | 章程第 10 行：“严禁 OpenBot 同步阻塞等待 AI Optimization” |
| Knowledge SDK 的独立 Knowledge Core 职责不变 | 保持。本轮建议不把 Knowledge SDK 改造成遥测管道。`knowledge-sdk@b953c99` 中仅见 Workbench“无 telemetry”的离线声明，无与 AI Optimization 入站契约的耦合 | `docs/ui-workbench.md`、`src/knowledge_sdk/ui/static/workbench.js` 文件头 |
| 不建立第二套 Run Ledger 或双写权威 | 保持。内部 `OutcomeOutboxEvent` 不是对端 `TelemetryEvent`。D-03 规定已入库事件保留但不成为授权或结果权威。幂等去重不得演化为对端改写 OpenBot 记录 | 章程第 8 行；ingestion 只插入副本 |

另外仍维持、但属于既有门禁而非本轮新批的原则：生产准入关闭；本阶段不实施、不合并 PR #4/#5/#6/#7。

---

## 7. 冲突清单

这些是已用源码或 GitHub 状态核验的冲突 / 漂移。它们支持而非推翻第 4 节的建议方向。实施前必须按获批决策处理，不得用兼容hack 掩盖。

| ID | 冲突 | 性质 | 建议处理（仍待 Owner 决策） |
| --- | --- | --- | --- |
| C-01 | OpenBot 个人 `TrustedScope` 无 `tenantId`；对端 `TelemetryEvent` / JWT 强制 `tenantId` | 跨仓契约冲突 | 按 D-01 方案 A：第一期个人不出站，不虚构 ID。方案 B 另审 |
| C-02 | 内部账本允许 `anonymous` / `runner` 回退；若直接用于官方出站，可在 runner + tenantId 时写入企业桶 | 内部回退 vs 官方身份 | 按 D-02 分层：内部不在本阶段擅自改；官方 fail-closed |
| C-03 | `GET /v1/telemetry/events` 已实现但未写入 OpenAPI；无角色、无分页 | 实现 / 契约漂移 | 按 D-06：不纳入官方 Adapter 契约；保留则必须补门槛或删除 |
| C-04 | `ingest` 不校验 `agentId`、不校验 `traceId` W3C 格式、不校验幂等键不得为 Trace ID | 授权与契约缺口 | 按 D-03、D-04、D-06 在获批后补齐 |
| C-05 | `readJsonBody` 无限读；未知字段整份入库；无租户/服务身份限流 | 可靠性 / 安全缺口 | 按 D-06 上限、丢弃未知字段、双维度限流（阈值待批） |
| C-06 | `normalizeAgentId` 可回退为 `"main"` | 出站误用风险 | 按 D-03：官方出站禁止使用该回退 |
| C-07 | `main` 弱 WAL 吞异常、容量丢弃；PR #4 更强但未合并；OpenBot 无官方缓冲 | 依赖与实现缺口 | 按 D-07：仓内自建，不依赖 PR #4，不把 main WAL 当已满足 |
| C-08 | 对端无角色细分的租户列举，放大了“个人数据一旦误写入企业 tenantId 即可被租户令牌读出”的风险 | 读面过宽 | 与 D-01、D-06 一并处理 |
| C-09 | OpenBot `main` @ `f3558f2` 的 CI Gate 与 CI 为失败；Docker Release 核验时仍在进行 | 平台 CI 状态，非本决策可关闭项 | 只记录事实，不推断根因；不得称为平台已绿；不作为跨仓验收 |

---

## 8. 剩余阻塞项与未决问题

**在 Owner 对 D-01–D-07 作出明确批准 / 否定 / 修订之前，Adapter 实施保持 BLOCKED。** 不得用本节的建议默认值假装问题已关闭。

### 8.1 阻塞实施的决策项（全部待 Owner 决策）

1. D-01 Personal / Enterprise 身份边界与“不得虚构 Tenant ID”。
2. D-02 anonymous / runner 禁出站，以及认证失败 fail-closed。
3. D-03 三方绑定、查询失败封闭、撤销只影响新事件、已接收事件保留。
4. D-04 W3C Trace Context 契约与禁止 Trace ID 作幂等键。
5. D-05 “只记录真实运行时版本”原则及模型/工具事件最小必填集（部分阻塞）。
6. D-06 GET、未知字段、64 KiB 候选上限、限流、幂等规则。
7. D-07 OpenBot 仓内缓冲位置与 at-least-once 语义，以及“不依赖 PR #4”的依赖关系。

### 8.2 即使七项方向获批，仍须单独确定、不得用默认值掩盖的未决问题

- **Service Identity 签发机构与 allowlist 运维责任**尚未被负责人指定；控制面与生产 IdP 接线仍为 BLOCKED。
- **个人遥测是否以及何时升级到 D-01 方案 B**（一等个人分区）未决；不得预先发明个人租户。
- **User 作为 Agent 操作者的授权模型**默认 No，若要放开须另审。
- **Allowlist 只读缓存 TTL** 未决；查询失败的对外状态码（503 或 403）待批。
- **Trace flags 采样位**、`spanId` / `parentSpanId` 必填性未决。
- **D-05 字段来源未决：** Model Version、运行时 Prompt Version、Tool Version、Agent Version、一次运行与 Evolution `experimentId` 的绑定。获批原则不等于获批“可以随便找个邻近字段填上”。
- **64 KiB、每 Service Identity / 每 Tenant 限流数量级**是候选，不是标准。
- **PR #4 的处理策略**（另启合并评审、保持 OPEN、或改方向）未在本轮决定，也不得在本轮申请。
- **OpenBot 身份接入方式**（如何把已验证企业身份注入出站，而不是沿用 `defaultScope` 的 runner 回退）须在下一阶段计划中单独设计，本轮只给出不得沿用的禁令。
- **跨仓测试方案**未定。单仓 CI（含 PR #7 verify success、AI Optimization main CI success）**不是**跨仓集成验收。
- **OpenBot main CI 失败**仍是未关闭的平台事实，根因本轮不推断。
- 交叉 scope 的引用/附件未来白名单 **未决**，第一期默认拒绝夹带。

### 8.3 申请 Adapter 实施授权的前提（本轮全部不满足）

须同时满足，且实施计划本身还需要**单独授权**：

1. Personal Tenant 与身份映射决策获批。
2. anonymous / runner 策略获批。
3. Service Identity 与 Agent allowlist 机制获批（含签发与运维责任）。
4. Trace Context 和事件版本契约获批。
5. 入站 API、安全和可靠性参数获批（含阈值或负责人改写后的值）。
6. WAL 与缓冲依赖关系明确（不把未合并的 PR #4 当默认依赖）。
7. 还须确定：PR #4 WAL 处理策略、OpenBot 身份接入方式、跨仓测试方案。
8. 九个实施工作包的范围及验收标准获批（本轮不重开工作包，也不把 PR #7 第 8 节自动视为已批）。

---

## 9. 下一阶段建议

下一阶段名称：**Adapter Implementation Plan**。

- 它 **仍然需要单独授权**。本登记即使被 Owner 批准，也不等于实施计划授权，更不等于可以开始编码。
- 必须先获得 Owner 对 D-01–D-07 的明确 **批准 / 否定 / 修订**。若为修订，应更新本登记后再进入计划阶段。
- 计划阶段还须先确定：PR #4 的 WAL 处理策略、OpenBot 身份接入方式、跨仓测试方案。
- **生产准入仍然关闭。** 不得将单仓 CI 通过、设计评审通过或本建议稿本身称为 Integration / Production Accepted。
- 本轮完成建议稿后 **立即停止**，不申请实施授权，不开始下一阶段，不创建分支，不写入仓库，不提交 PR。

请架构负责人 Yolanda Lee 对第 4 节七项逐项给出批准、否定或修订。

---

## 10. 证据索引

### 10.1 GitHub 已验证事实

| 对象 | SHA 或标识 | 链接 |
| --- | --- | --- |
| `ai-optimization` `main` | `16b01d99d33b386102bb9b2b248558eb5517e245` | 仓库 `flykingvip-cloud/ai-optimization`；CI [46118003722](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46118003722) |
| `openbot-vp` `main` | `f3558f2ccd24a1020dff8a378721786b3071f641` | 仓库 `flykingvip-cloud/openbot-vp`；CI Gate [46132661254](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661254)；CI [46132661255](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661255)；Docker Release [46132661257](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661257)；Nightly [46135827242](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46135827242) |
| `knowledge-sdk` `main` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | CI [45536468206](https://github.com/flykingvip-cloud/knowledge-sdk/actions/runs/45536468206) |
| PR #4 | `8324aa2441145bb1c685df5c8e65694277398f84`，OPEN | [PR #4](https://github.com/flykingvip-cloud/ai-optimization/pull/4)；CI [46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496) |
| PR #5 | `74e75fbd0fcf26a648a4c80b24d7de9eb81bfbf6`，OPEN | [PR #5](https://github.com/flykingvip-cloud/ai-optimization/pull/5)；CI [46131574686](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46131574686) |
| PR #6 | `1ec34cca26deeb24d6fd54abcf3f2375e4b9ba7b`，OPEN；正文 `507392b` | [PR #6](https://github.com/flykingvip-cloud/ai-optimization/pull/6)；最终 CI [46132975388](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46132975388) |
| PR #7 | `3753da21be151bad8047cd73253f74c4681f4765`，OPEN；正文 `8b86c69` | [PR #7](https://github.com/flykingvip-cloud/ai-optimization/pull/7)；最终 CI [46133991480](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46133991480)；正文 CI [46133935688](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46133935688) |
| 评审报告 | PR #7 路径 | [OPENBOT_TELEMETRY_ADAPTER_DESIGN_REVIEW.md](https://github.com/flykingvip-cloud/ai-optimization/blob/3753da21be151bad8047cd73253f74c4681f4765/docs/architecture/handover/OPENBOT_TELEMETRY_ADAPTER_DESIGN_REVIEW.md) |

### 10.2 源码验证事实（路径与关键行号）

| 主题 | 仓库 @ SHA | 路径与行号 |
| --- | --- | --- |
| TrustedScope / Outbox | `openbot-vp@f3558f2` | `src/task-outcome/types.ts` 63–71、221–229；`JUDGEMENT_POLICY_VERSION` 10–11、161；`toolObservations` 51 |
| 个人/企业映射 | 同上 | `src/task-outcome/chat-entry.ts` 47–65；`transitions.ts` 14–15；`reject-result.ts` 39–73 |
| runner 默认 scope | 同上 | `src/task-outcome/runtime-from-runner.ts` 1007–1023 |
| Agent id 回退 | 同上 | `src/routing/session-key.ts` 19、89–112 |
| 内部事件 id | 同上 | `src/task-outcome/result-service.ts` 56–61 |
| 模型调用证据 | 同上 | `src/executor-evidence/model-call-evidence.ts` 29–44 |
| 会话投影 Prompt（不得误用） | 同上 | `src/conversations/projection.ts` 23–28、48 |
| OTel 默认关闭 | 同上 | `extensions/diagnostics-otel/src/service.ts` 80–85 |
| 诊断 includePrompt 默认 true | 同上 | `src/config/schema.help.ts` 615 |
| 对端事件与 Auth | `ai-optimization@16b01d99` | `packages/shared-contracts/src/index.ts` 16–52；`auth.ts` 36–122 |
| 入库与列举 | 同上 | `services/telemetry-ingestion/src/index.ts` 18–62；`services/http-api/src/server.ts` 19–26、33–48、56–69、113–124 |
| OpenAPI / UNIQUE | 同上 | `contracts/openapi/ai-optimization-v1.yaml` 7–14；`packages/shared-contracts/src/db.ts` 15–22 |
| 章程边界 | 同上 | `docs/architecture/SYSTEM_BOUNDARIES.md` 4–10 |
| `main` 弱 WAL | 同上 | `packages/telemetry-sdk/src/index.ts`（多处 `catch` 吞错与 `shift()` 丢弃）；`wal-lock.ts` **不存在于 main** |
| PR #4 WAL（未合并） | `ai-optimization@8324aa2` | `packages/telemetry-sdk/src/wal-lock.ts`；`packages/telemetry-sdk/src/index.ts`；`docs/architecture/handover/TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md` |
| Knowledge SDK 边界 | `knowledge-sdk@b953c99` | `docs/ui-workbench.md`；`src/knowledge_sdk/ui/static/workbench.js` 文件头 |

### 10.3 本轮交付物

- 本地建议稿（**不在任何 git 仓库工作树内**，未 `git add` / `commit` / `push`）：`/workspace/owner-decision-register/OWNER_DECISION_REGISTER.md`
- 核验窗口：2026-11-28 18:49–18:53 CST（Asia/Shanghai）

---

本文件结束。提交建议稿后停止，等待架构负责人评审。不得自行将建议转为实施，不得合并 PR #4 / #5 / #6 / #7，不得申请 Adapter 实施授权，不得开始 Adapter Implementation Plan。
