# OWNER_DECISION_CLOSURE_REPORT.md

> Owner Decision Closure 总报（决策收口，不实施）。  
> **最终结论：`BLOCKED_PENDING_OWNER_DECISIONS`**  
> 本文件中的「本阶段指令要求固化的原则」是负责人在任务指令中给出的收口方向，属于**用户提供记录**，**不是**正式 `APPROVED` 签批。  
> PR #7 的 RECOMMENDED、PR #8 决策登记中的「建议 APPROVE」**均不得**升级为 `APPROVED`。  
> 生产准入：**关闭**。本阶段未申请 Adapter 实施授权，未开始 Implementation Plan，未编码。

核验窗口：2026-11-28 19:19–19:23 CST（Asia/Shanghai）。  
批准人（待签批）：架构负责人 Yolanda Lee。

---

## 0. 最终三选一结论

**`BLOCKED_PENDING_OWNER_DECISIONS`**

选择该主结论的原因：身份签发与 Allowlist 运维责任人尚未指定，D-06 体上限与限流数值尚未确认，D-05 若干关键字段来源仍为 `UNVERIFIED` 且不得用推断补全，跨仓验收中真实 IdP / 真实出站接线方式仍待 Owner 确认。这些都是负责人必须签批或指定的事项，因此主门禁是 Owner 决策，而不是已经可以把剩余问题全部归因于技术证据缺口。

同时存在的技术证据剩余项（不升格为主结论，但不得忽视）见第 6.2 节，标签为 **兼有 `BLOCKED_PENDING_TECHNICAL_EVIDENCE` 剩余项**：主要包括版本字段无法从当前源码证明统一采集位置，以及 OpenBot `main` CI 持续失败（不得称为平台已绿，也不得当作跨仓验收通过）。

- **是否具备编写 Adapter Implementation Plan 的条件？否。** 即使架构原则已被本阶段指令要求固化，只要身份责任、版本来源和跨仓验收未闭环，就不应进入计划编写，更不应把计划当作可以开始编码的授权。计划阶段若另行授权，仍须先确定 PR #4 的 WAL 处理策略、OpenBot 身份接入方式和跨仓测试方案。
- **是否具备开始 Adapter 编码的条件？否。**
- **是否具备生产准入条件？否。生产准入关闭。**

---

## 1. 审计基线及是否漂移

方法：本轮用已登录账号 `flykingvip-cloud` 的 `gh` 与对已有克隆执行 `git fetch origin --prune`（只更新远端引用，不 checkout、不在工作树中 commit）。相对决策登记核验窗口（2026-11-28 18:49–18:53 CST）比较。

### 1.1 三仓 `origin/main` 与 PR #4–#8

| 项目 | 上次记录 | 本轮核实（完整 SHA） | 差异 | 是否影响身份 / TaskOutcome / 遥测路径 |
| --- | --- | --- | --- | --- |
| `ai-optimization` `main` | `16b01d99d33b386102bb9b2b248558eb5517e245` | **同 SHA。** 提交：`Merge pull request #3 from flykingvip-cloud/docs/p0-1-merged-main-baseline`，提交时间 2026-11-28 14:44:27 CST。CI [46118003722](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46118003722) 仍为 push / `CI` **success**（完成 2026-11-28 14:44:43 CST）。 | **无 SHA 漂移。** | 否 |
| `openbot-vp` `main` | `f3558f2ccd24a1020dff8a378721786b3071f641` | **`13763b2d85c6ca72d3bf5b10acb1825457776ff6`**。提交：`Merge pull request #370 from flykingvip-cloud/codex/openbot-t2-vite-7.3.7`，提交时间 2026-11-28 19:07:48 CST。合并提交只引入 `7e3b8139e5c8e62678cdcdf9f804ebf0655fdebc`（`chore(ui): bump vite from 7.3.5 to 7.3.7`）。变更文件仅 `ui/package.json`、`pnpm-lock.yaml`。 | **有 SHA 漂移。** | **否。** `git diff --name-only` 仅上述两文件。本轮抽查的身份 / TaskOutcome / 遥测相关文件 blob 与 `f3558f2` 完全相同（见第 8 节）。原 D-01–D-07 源码对照结论在新 SHA 上仍然适用。 |
| `knowledge-sdk` `main` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | **同 SHA。** 提交：`fix(ci): give HTTPError fixtures closeable bodies on Python 3.9`，提交时间 2026-11-25 10:10:14 CST。CI [45536468206](https://github.com/flykingvip-cloud/knowledge-sdk/actions/runs/45536468206) 仍为 push / `tests` **success**（完成 2026-11-25 10:57:48 CST）。 | **无 SHA 漂移。** | 否 |
| PR #4 WAL | HEAD `8324aa2441145bb1c685df5c8e65694277398f84`，OPEN | 同 SHA，`state=OPEN`，`mergedAt=null`，`isDraft=false`，`mergeable=MERGEABLE`。CI [46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496) job `verify` **success**（17:23:44 CST）。**不得视为 `main` 已有能力，本阶段不合并。** | **无** | 否 |
| PR #5 | HEAD `74e75fbd0fcf26a648a4c80b24d7de9eb81bfbf6`，OPEN | 同 SHA，OPEN。CI [46131574686](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46131574686) **success**（17:40:46 CST）。 | **无** | 否 |
| PR #6 | HEAD `1ec34cca26deeb24d6fd54abcf3f2375e4b9ba7b`，OPEN | 同 SHA，OPEN。CI [46132975388](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46132975388) **success**（17:59:31 CST）。 | **无** | 否 |
| PR #7 | HEAD `3753da21be151bad8047cd73253f74c4681f4765`，OPEN | 同 SHA，OPEN。CI [46133991480](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46133991480) **success**（18:11:50 CST）。 | **无** | 否 |
| PR #8 决策登记建议稿 | HEAD `62c10a412efeefc8df3e3e9c78f4f72bd6599965`，OPEN；CI 当时 in_progress | 同 SHA，OPEN，`mergedAt=null`。CI [46138701291](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46138701291) job `verify` 现已 **success**（完成 2026-11-28 19:11:48 CST）。本地建议稿 `/workspace/owner-decision-register/OWNER_DECISION_REGISTER.md` 与该 SHA 文件内容 SHA-256 一致（`57e77814dcacb1bc0e6ae50959ccbd4371a39d28f51d1ce15f716fe5f4b005e8`）。 | **无 SHA 漂移；CI 状态从 in_progress 更新为 success。** 建议稿仍不是批准。 | 否 |

本轮未合并 PR #4、#5、#6、#7、#8。

### 1.2 OpenBot `main` CI 状态（详见本包对 T7 的记录及第 7 节）

当前 `origin/main` 为 `13763b2d`。本轮核验时（约 19:22:55 CST）：

| Workflow | Run | 结论 / 状态 | 完成或更新时间（CST） |
| --- | --- | --- | --- |
| CI Gate | [46138406419](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406419) | **failure** | 19:13:42 |
| CI | [46138406398](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406398) | **in_progress**（已有多个 job failure） | 创建 19:07:51；核验时尚未结束 |
| Install Smoke | [46138406420](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406420) | **success** | 19:17:29 |
| Workflow Sanity | [46138406431](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406431) | **success** | 19:08:08 |
| Docker Release | [46138406470](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406470) | **pending**（jobs=0） | updatedAt 仍为 19:07:52 |

上一 SHA `f3558f2` 上的历史失败仍在：CI Gate [46132661254](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661254) failure（17:59:19）；CI [46132661255](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661255) failure（18:13:48）；Nightly [46135827242](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46135827242) failure（18:35:26）；Docker Release [46132661257](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661257) 核验时仍 **in_progress**（`build-amd64` 已于 18:02:47 success，`build-arm64` 自 17:54:43 起仍 in_progress）。

**不得将 OpenBot 平台表述为已绿。不得将单仓 CI 通过等同于跨仓验收通过。本阶段不为修 CI 而改代码。** 这些失败与本阶段 Adapter 文档收口无直接实施耦合，也不解除 Owner 决策阻塞。

---

## 2. 证据分类说明

| 类别 | 含义 | 本文件用法 |
| --- | --- | --- |
| **GitHub 已验证事实** | 本轮 `gh` / `git fetch` 核实的 SHA、PR 状态、CI run / job 结论与时间戳、可读日志原文摘录。 | 第 1、7 节。 |
| **源码验证事实** | 在指定完整 SHA 上直接阅读的类型、函数、路由与文档原文。 | 第 3 节及配套五份契约文档。OpenBot 引用以 `13763b2d` 为准（与 `f3558f2` 相关文件 blob 相同）。 |
| **用户提供记录** | 任务指令（t20u）中的「本阶段要求 / 固化」方向，以及既有已被负责人接受的跨仓原则。 | 第 3、4 节原则栏。 |
| **架构建议** | 评审或本轮收口提出的可审议方案，尚未签批。 | 各决策的建议栏与配套文档。 |
| **待 Owner 决策** | 需要明确批准、否定、修订、指定责任人或确认数值。 | 凡未签批项。 |
| **尚未验证的假设 / UNVERIFIED** | 当前源码无法证明，禁止推断或补造。 | 尤其 D-05 字段来源。 |

---

## 3. D-01 至 D-07 决策总表

状态词定义：

- **APPROVED**：仅当有负责人明确的批准表述。本轮**没有任何一项**达到该状态。
- **本阶段指令要求固化的原则**：t20u 给出的收口方向（用户提供记录），不得自动盖 `APPROVED` 章。
- **PENDING_OWNER**：需要指定 Owner 最终确认或指定责任人 / 数值。
- **IMPLEMENTATION_BLOCKED**：原则已明确或已被要求固化，但缺少实施条件。
- **NOT_IN_SCOPE**：当前阶段明确不处理（例如开始 Adapter 编码、合并 PR、生产接入）。

| ID | 主题 | 本阶段指令要求固化的原则（用户提供记录，非 APPROVED） | 正式批准状态 | 仍待 Owner 的细项 | 实施状态 | 源码对照（本轮复核） |
| --- | --- | --- | --- | --- | --- | --- |
| D-01 | Personal Tenant | 第一阶段仅允许 Enterprise Scope 正式出站；Personal 不得伪装成 Enterprise Tenant；不得虚构 Tenant ID；禁止 Personal 数据间接进入企业遥测 | **非 APPROVED** | 是否以及何时扩约到方案 B（一等 `scopeKind` / 按已验证 subject 分区）须另审；隔离规则的实施细则见配套身份文档，待与原则一并签批 | **IMPLEMENTATION_BLOCKED** | **SUPPORTED**（跨仓 `tenantId` 必填冲突仍在，是待解决契约问题，不改变方向） |
| D-02 | anonymous / runner | 禁止作为正式 Adapter 身份；认证失败必须 fail closed，不得降级后继续发送 | **非 APPROVED** | User 与 Service Identity 的事件类型白名单需随原则签批（建议见身份文档） | **IMPLEMENTATION_BLOCKED** | **SUPPORTED** |
| D-03 | Agent Allowlist | Tenant + Service Identity + Agent 三方绑定；撤销后立即拒绝新事件 | **非 APPROVED** | **签发方 / 密钥持有方 / 轮换方 / 撤销方 / Allowlist 运维责任人尚未指定**（不得猜测人名或部门名）；缓存 TTL 与对外 403/503 细则待批 | **IMPLEMENTATION_BLOCKED**（责任人未指定） | **SUPPORTED**（控制面未落地，属 **NOT VERIFIED / 未落地**） |
| D-04 | Trace Context | 使用 W3C Trace Context；本地生成必须标记 `generated`；禁止用 Trace ID 作幂等键 | **非 APPROVED** | `trace-flags` 采样位、`spanId` / `parentSpanId` 是否必填仍未决 | **IMPLEMENTATION_BLOCKED**（作为契约） | **SUPPORTED**（`src/` 与 `extensions/` 无 `traceparent` / `tracestate` 传播实现） |
| D-05 | Version Snapshot | 只记录真实运行时版本；缺失时不伪造 latest | **非 APPROVED**（原则已被要求固化，但不得视为字段映射已批准） | 多个关键字段来源 **UNVERIFIED**，见 `TELEMETRY_VERSION_SNAPSHOT_CONTRACT.md` | **IMPLEMENTATION_BLOCKED**（部分：原则可写入契约，字段映射不可用猜测实施） | 原则 **SUPPORTED**；字段来源部分 **UNVERIFIED** |
| D-06 | API Contract | 正式 Adapter 不提供 GET；未知字段不得持久化 | **非 APPROVED** | **64 KiB 仅为候选，限流数字仅为候选，Owner 确认前不得标为最终批准值** | **IMPLEMENTATION_BLOCKED** | **SUPPORTED**（实现与 OpenAPI 漂移仍在） |
| D-07 | WAL | OpenBot 自有默认关闭的异步缓冲；不依赖尚未合并的 PR #4；at-least-once，不得宣称 exactly-once | **非 APPROVED** | PR #4 是否另启合并评审、OpenBot 缓冲是否借鉴其锁/恢复设计，须单独决策，不得把未合并代码当作 main 能力 | **IMPLEMENTATION_BLOCKED** | **SUPPORTED** |

既有已被负责人接受、且不得与 D-01–D-07 混淆的原则（可记为已接受）：

1. OpenBot 是唯一 TaskOutcome 权威。
2. Adapter 不得绕过 Evolution Control。
3. AI Optimization 故障不得同步阻塞 OpenBot 主执行链。
4. Knowledge SDK 的独立 Knowledge Core 职责不变。
5. 不建立第二套 Run Ledger 或双写权威。
6. 生产准入关闭。

源码依据仍见 `ai-optimization@16b01d99` `docs/architecture/SYSTEM_BOUNDARIES.md` 第 4–10 行，以及 Knowledge SDK `@b953c99` `docs/ui-workbench.md` 对核心包零依赖、无产品侧遥测启动的说明。

---

## 4. 哪些阻塞已解除，哪些仍阻塞

**本轮没有解除任何实施阻塞。** 本阶段只把原则、责任缺口、验收条件和证据写成可签批记录。

仍阻塞实施（须 Owner 决策或指定）：

1. D-01–D-07 的正式签批（当前只有指令要求固化的原则，没有 `APPROVED`）。
2. Service Identity 与 Agent Allowlist 的签发 / 密钥 / 轮换 / 撤销 / 运维责任人。
3. D-06 HTTP Body 上限与 Tenant + Service Identity 限流的批准值。
4. D-05 中 UNVERIFIED 字段：在没有真实运行时来源证据前，不得写入实施映射。
5. 跨仓验收：真实 IdP、真实 OpenBot 出站接线与 Mock 的分界，以及何为计划阶段可启动的最小矩阵，待确认。
6. PR #4 WAL 处理策略（继续独立评审 / 修改后再议 / 明确永不作为 OpenBot 出站默认依赖）待确认。
7. OpenBot 平台 CI 未绿，不能作为跨仓或生产证据；它不代替上述 Owner 决策，也不构成本阶段可以开始修 CI 或编码的授权。

---

## 5. 配套文档索引

均位于本目录，未写入任何 git 仓库：

| 文件 | 内容 |
| --- | --- |
| `SERVICE_IDENTITY_AND_AGENT_AUTHORITY.md` | 身份签发、授权、撤销、403/503、责任矩阵 |
| `TELEMETRY_VERSION_SNAPSHOT_CONTRACT.md` | 版本快照字段来源表 |
| `TELEMETRY_API_SECURITY_LIMITS.md` | API 安全与容量约束 |
| `OPENBOT_TELEMETRY_WAL_ACCEPTANCE.md` | OpenBot 异步缓冲验收标准 |
| `CROSS_REPO_TELEMETRY_ACCEPTANCE_PLAN.md` | 跨仓测试矩阵与生产准入门槛 |

---

## 6. 待 Owner 决策清单与技术证据剩余项

### 6.1 待 Owner 决策（主门禁）

| ID | 事项 | 建议（非正式批准） | 后续动作 |
| --- | --- | --- | --- |
| O-01 | 对 D-01–D-07 的原则作正式 APPROVE / REJECT / REVISE | 建议按本阶段指令方向批准原则，但必须逐项书面签批 | 架构负责人签批本总报或等效决策记录 |
| O-02 | 指定 Service Identity 签发方、密钥持有方、轮换方、撤销方 | 不得由执行者猜测人名或部门 | 写入责任矩阵后才能做实施计划中的控制面工作包 |
| O-03 | 指定 Agent Allowlist 创建 / 修改 / 撤销权限及责任人 | 同上 | 同上 |
| O-04 | 确认或改写 64 KiB 体上限、限流数值与 429 重试约定 | 64 KiB 与「按 Tenant + Service Identity 限流」仅为候选 | 无批准值不得在编码中写死为已定契约 |
| O-05 | 确认 D-05 UNVERIFIED 字段在来源未证明前的处理：禁止出站该字段，或先做源码补证再纳入 | 禁止用 latest 或推断值填入 | 补证或明确排除 |
| O-06 | 确认个人遥测是否以及何时进入方案 B | 第一期不做；另审 | 第一期范围锁定 |
| O-07 | PR #4 处理策略与 OpenBot 缓冲是否借鉴其设计 | 不依赖、不合并；语义可对照但须在 OpenBot 仓内自建 | 计划阶段单独决定 |
| O-08 | 跨仓验收最小集：哪些必须真实 OpenBot 源码 / 真实 IdP，哪些可用 Mock | 见验收计划建议，待批 | 未批不得称为验收方案已闭环 |

### 6.2 兼有的技术证据剩余项

| ID | 事项 | 状态 | 说明 |
| --- | --- | --- | --- |
| T-01 | Agent Version、运行时 Prompt Version、Model Version、Tool Version、一次运行与 `experimentId` 的可复用快照对象 | **UNVERIFIED** | 不得补造映射 |
| T-02 | OpenBot `main` CI Gate / CI 失败 | 日志可读的失败事实已记录；部分 Windows 分片在最新 run 上核验时仍未结束 | 不推断与 Adapter 无关失败的产品根因；最新 CI run 若在本报完成后再结束，以其最终结论为准，本报只记录核验时刻事实 |
| T-03 | 断电级 WAL 持久性 | 未做真实断电试验 | 禁止宣称已证明 |
| T-04 | Service Identity 控制面与生产 IdP 接线 | 源码未落地 | 非本阶段实现范围 |

---

## 7. OpenBot CI 诊断摘要（T7）

确定事实与推测严格分开。日志不可读则标 `ROOT_CAUSE_UNKNOWN`。本轮对已结束的失败 job 成功取到日志；对仍在进行的父 run，`gh run view --log-failed` 拒绝下载，已改为对**已结束失败 job**单独取日志。

### 7.1 当前 `13763b2d`（GitHub 已验证事实）

**CI Gate [46138406419](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406419)**：job `check (types, lint, format)` success；job `delivery guard` **failure**（19:07:53–19:08:38 CST）。日志确定事实：步骤 `Release ledger audit` 执行 `pnpm delivery:ledger:audit` → `node --import tsx scripts/delivery/ledger-audit.ts`，输出 `ledger: 163 releases, 157 errors, 24 warnings`；157 条 `ERROR` 的类型均为 `[missing-object]`（示例：`cannot adjudicate whether 1e1143012db2 (release 1) is still live: missing object(s) ... under the current object graph`）。警告类型包括 `[timeline-gap]`、`[missing-tag]`、`[overlay-debt]`。该失败日志与上一 SHA 的 CI Gate [46132661254](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46132661254) 失败日志经 `diff` **字节级相同**（两份均为 43303 字节）。**不把「相同日志」解释为同一根因已在本轮被独立复现证明之外的额外结论；只记录比对结果。** 退出：作业 `Process completed with exit code` 出现在日志中（delivery guard 失败）。

**CI [46138406398](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406398)**：核验结束时（19:22:55 CST）仍为 **in_progress**。已结束且 failure 的 job 及日志摘录：

| Job | 完成时间 CST | 退出 | 日志中的确定事实 |
| --- | --- | --- | --- |
| `secrets` | 19:08:21 | hook `pnpm-audit-prod` exit code 1，随后作业 exit 1 | `58 vulnerabilities found`；`Severity: 12 low \| 36 moderate \| 10 high`。出现的 GHSA：`GHSA-22jm-h49p-29qw`、`GHSA-46jr-4wx8-v453`、`GHSA-mrhx-c7xc-m3w5`、`GHSA-27r3-jxmh-p828`、`GHSA-xcx6-jx8p-x3h5`。**未出现** `GHSA-587h-7wmj-h5pm`。 |
| `check` | 19:11:36 | `pnpm check` ELIFECYCLE exit 1 | `Architecture manifest violations:` 两条 `runtime-capabilities-public-entry`：`src/agent-runtime/capabilities/invocation/authorize-stored-result-read.test.ts` 与 `src/agents/pi-tools.stored-result-read-acl.test.ts` 导入 `authorize-stored-result-read.js`，被 `src/agent-runtime/capabilities/*/**` 拒绝。 |
| `checks (node, protocol, pnpm protocol:check)` | 19:09:30 | `pnpm protocol:check` ELIFECYCLE exit 1 | 命令为 `pnpm protocol:gen && pnpm protocol:gen:swift && git diff --exit-code -- dist/protocol.schema.json apps/macos/Sources/OpenBotProtocol/GatewayModels.swift apps/shared/OpenBotKit/Sources/OpenBotProtocol/GatewayModels.swift`。`git diff` 显示两份 `GatewayModels.swift` 在生成后新增 `dependencyresumeid` / `dependencyresumecapability`（`dependencyResumeId` / `dependencyResumeCapability`）相关字段，与已提交文件不一致。 |
| `android (test, ... testDebugUnitTest)` | 19:09:43 | Gradle / 作业 exit 1 | `309 tests completed, 6 failed`。失败测试名：`GatewayConfigResolverTest > resolveGatewayConnectConfigManualOnly`、`GatewayConfigResolverTest > parseGatewayEndpointAcceptsWssUrl`、`KnowledgeBrowserModelsTestKt > initializationError`、`MeHubModelsTest > parseRobotWorkspaceGet_mapsBlocks`、`VaultSyncCryptoTest > encryptAeadMatchesBrowserVectorWithFixedNonce`、`VaultSyncCryptoTest > unlockAndOpaquePathMatchBrowserVectors`。 |
| `checks (node, test, pnpm canvas:a2ui:bundle && pnpm test)` | 19:11:05 | Test failed，作业 exit 1 | 最终汇总：`Test Files  163 failed \| 453 passed \| 2 skipped (618)`；`Tests  8 failed \| 3557 passed \| 10 skipped (3575)`。日志中可见 `ERR_VM_MODULE_DIFFERENT_CONTEXT`、`AssertionError: expected '/root/.openclaw/workspace' to be '/tmp/openbot-cwd-fallback-...'`、`TypeError: Cannot redefine property: location`（堆栈含 `ui/src/ui/controllers/platform-auth.test.ts`）。此处只摘录日志原文，不归纳单一根因。 |

核验时刻已 conclusion=failure、但因父 run 未结束而**未在本轮完整下载日志**的 Windows 分片：`checks-windows (node, test, 2/4/5/6, 6, pnpm test)`（约 19:20–19:22 CST 结束）。仍 in_progress：分片 1 与 3。对这些分片 **不引用上一 SHA 的日志冒充本 SHA 日志**。其确定事实仅限于 GitHub 记录的 `conclusion=failure` 或 `in_progress` 与完成时间。

**对照（GitHub 已验证事实，不是因果证明）：** 上一 SHA `f3558f2` 的 `secrets` 日志为 `63 vulnerabilities found`；`Severity: 13 low | 39 moderate | 11 high`；GHSA 集合比当前多 `GHSA-587h-7wmj-h5pm`。当前 SHA 的 secrets 日志为 58 / 12 / 36 / 10，且不含该 GHSA。这与 PR #370「去掉 Vite / launch-editor 顾问」的变更范围一致，但 **secrets 作业在新 SHA 上仍然失败**。不得把「顾问条数下降」写成 secrets 已通过。

### 7.2 历史失败 run（`f3558f2`）日志现可读

**CI Gate 46132661254**：与 7.1 中新 CI Gate 失败日志相同（见上）。

**CI 46132661255**（18:13:48 CST 已结束）：失败 job 包括 `secrets`、`check`、`protocol`、`android test`、Linux `pnpm test`，以及全部 6 个 Windows 分片。Linux 测试汇总同为 `Test Files 163 failed | 453 passed | 2 skipped (618)`、`Tests 9 failed | 3556 passed | 10 skipped (3575)`（与新 SHA 的 Tests 失败数 8 相比，日志数字不同，只记录，不解释原因）。Windows 分片最终 Test Files / Tests 失败计数（摘录最终汇总行）：1/6 为 11 files / 39 tests failed；2/6 为 8 / 22；3/6 为 3 / 4；4/6 为 7 / 85；5/6 为 10 / 34；6/6 为 15 / 42。Windows 日志中还出现 `EACCES` 监听 `store.lock.sock`、`spawnSync pnpm ENOENT`、`spawnSync rg ENOENT`、`EBUSY` rename sqlite、路径分隔符 `\` vs `/` 等断言失败。只记录这些行，不把它们归纳为「Windows 环境问题」或「产品缺陷」的单一根因。

**Nightly 46135827242**：job `longrun-benchmark` failure，exit 1。日志确定事实：CogniWeave SDK long-run benchmark diff gate 输出指标 `distillation_throughput`，`baseline` 16335.58039042947，`current` 8419.3713806016，`allowed` 9801.34823425768，`passed`: false，`status`: `FAIL`。

### 7.3 推测（非确定事实）

- 交付账本 `missing-object` 可能与浅克隆或历史对象不在当前 object graph 有关；**本轮未验证 runner 的 fetch 深度或对象是否确实缺失，故根因不升级为确定事实。**
- Linux 大量 Test Files 失败可能与 vitest mock / `ERR_VM_MODULE_DIFFERENT_CONTEXT` 及 `location` 重定义有关，但 163 个失败文件是否同属一类，**未逐文件证明**。
- Windows 失败可能混合了路径、权限与缺失工具；**未做根因归并**。

### 7.4 与本阶段 Adapter 工作的关系

未发现这些失败 job 的日志指向本阶段未实现的 Telemetry Adapter、也未指向 PR #8 文档。OpenBot 变更仅为 Vite 补丁。因此：**这些 CI 失败不构成本阶段文档收口的代码缺陷修复任务，也不解除 D-01–D-07 的 Owner 决策阻塞。** 它们确实阻塞任何「平台已绿 / 可生产准入 / 单仓 CI 等于跨仓验收」的表述。本阶段不为变绿而绕过测试或改代码。

对仍 pending / in_progress 且尚无失败日志的 Docker Release（新旧两个 SHA），其最终结论在核验结束时 **未知**，不得当作成功或失败。

---

## 8. 源码复核要点（完整路径见配套文档）

OpenBot `@13763b2d` 与 `@f3558f2` 相比，下列文件 blob 不变：`src/task-outcome/types.ts`、`chat-entry.ts`、`transitions.ts`、`reject-result.ts`、`runtime-from-runner.ts`、`result-service.ts`、`src/routing/session-key.ts`、`src/executor-evidence/model-call-evidence.ts`、`src/conversations/projection.ts`、`extensions/diagnostics-otel/src/service.ts`、`src/config/schema.help.ts`。行号与决策登记一致，本轮已重新阅读。

关键事实不变：个人 `TrustedScope` 无 `tenantId`；`scopeFromChatEntry` 在空 subject 时填 `"anonymous"`；runner 默认 `subjectRef: "runner"`；对端 JWT 与 `TelemetryEvent.tenantId` 必填；认证失败返回 401/403，无 anonymous 降级入库；`GET /v1/telemetry/events` 存在于 `server.ts` 但不在 OpenAPI；`readJsonBody` 无上限；`JSON.stringify(event)` 会持久化未知字段；无按 Tenant / Service Identity 限流；入库不校验 `agentId` 绑定；`src/` 与 `extensions/` 无 `traceparent`/`tracestate`；`TaskOutcomeRecord` 无 `experimentId` / `agentVersion` / `toolVersion` / `promptVersion` 字段；`main` 无 `wal-lock.ts`，容量满时 `shift()` 丢弃。

---

## 9. 最终汇报问答

**当前三仓实际基线是什么？**  
`ai-optimization` `main` = `16b01d99d33b386102bb9b2b248558eb5517e245`。  
`openbot-vp` `main` = `13763b2d85c6ca72d3bf5b10acb1825457776ff6`（相对上次 `f3558f2` 仅 Vite 7.3.5→7.3.7）。  
`knowledge-sdk` `main` = `b953c9922cc1096e0e88455dab6746c01a9d27f9`。  
PR #4–#8 仍 OPEN，HEAD 与上次记录相同。PR #8 CI 已变为 success。

**D-01 至 D-07 哪些已正式批准，哪些仍待 Owner 确认？**  
**没有任何一项达到正式 `APPROVED`。** 七项原则均已被本阶段指令要求固化，但仍待书面签批。责任人、数值、UNVERIFIED 字段处理和跨仓验收分界仍为 `PENDING_OWNER`。实施仍全部（或对 D-05 部分）`IMPLEMENTATION_BLOCKED`。

**哪些阻塞项已经解除，哪些仍阻塞？**  
没有解除。第 4、6 节清单全部仍阻塞进入 Implementation Plan 与编码。

**哪些事实由源码和 CI 直接证明？**  
第 1、7、8 节及配套文档中标记为 GitHub 已验证事实或源码验证事实的条目。包括 SHA/PR/CI 结论、失败日志摘录、以及身份 / API / WAL / 版本相关源码行。

**哪些结论仍然依赖 Mock 或假设？**  
控制面责任归属（无人名可引用）；Allowlist 缓存 TTL；限流与 64 KiB 是否为最终值；UNVERIFIED 版本字段的真实采集对象；OpenBot CI `missing-object` 等失败的根因推测；跨仓真实 IdP 行为（本轮未接入真实 IdP，也无跨仓联调）。任何尚未实现的 Adapter 行为都还不是已验证事实。

**是否具备编写 Adapter Implementation Plan 的条件？** 否。  
**是否具备开始 Adapter 编码的条件？** 否。  
**是否具备生产准入条件？** 否。

---

## 10. 本阶段完成核对与禁止事项确认

- [x] 三仓 HEAD 和 PR #4–#8 状态已重新核验，并记录 OpenBot SHA 漂移及其范围。
- [x] D-01 至 D-07 均有明确状态；正式批准人仍为架构负责人，尚未签批。
- [x] Service Identity / Allowlist 责任矩阵已列出且将未指定项标为 `PENDING_OWNER`，未编造人名。
- [x] Version Snapshot 字段来源表已建立，不能证明的标 `UNVERIFIED`。
- [x] API 容量和限流有明确批准状态：候选值 **未批准**。
- [x] WAL 行为及平台限制已写成验收标准，并区分 PR #4 与 OpenBot 缓冲。
- [x] 跨仓测试矩阵已覆盖指令中的 12 项，并区分真实源码 / 真实 IdP / Mock。
- [x] OpenBot CI 失败项已记录；不存在未经说明的绿灯结论。
- [x] 未修改生产代码，未触发生产变更，未合并 PR，未写入仓库，未开新 PR，未将建议标为已批准。

本阶段到此停止。不申请实施授权，不开始 Implementation Plan，不推送仓库。

**最终结论：`BLOCKED_PENDING_OWNER_DECISIONS`**
