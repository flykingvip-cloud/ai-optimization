# G-01 至 G-06 证据关闭计划

> 工作包 B。本文件是**计划**，不是已完成测试，不是缺口已关闭。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> 本阶段不实施新代码、不执行未授权测试、不进行跨仓运行。  
> 计划与设计承诺不得视为已完成测试。任何缺口在独立审查接受之前保持开放。

基线 SHA：

- `ai-optimization` `main`：`16b01d99d33b386102bb9b2b248558eb5517e245`（`GITHUB_VERIFIED`）
- `openbot-vp` `main`：`73013587e3a5ccd96a0d0c284f7223199d39ed75`（Merge PR #377，2026-11-28 23:17:18 CST，`GITHUB_VERIFIED`）。身份 / TaskOutcome / 遥测采集 / Evolution 绑定路径 blob 与 `b10ad59` / `b4e106de` / `13763b2d` / `f3558f2` 相同（`SOURCE_VERIFIED`，见主报告）
- `knowledge-sdk` `main`：`b953c9922cc1096e0e88455dab6746c01a9d27f9`（边界，`GITHUB_VERIFIED`）
- 权威决策记录：`0fe6247fa4247e8c6053e5b7df888ee061c63886`
- 未合并 PR #4 HEAD：`8324aa2441145bb1c685df5c8e65694277398f84`（仅 G-04 对照，不是 main）

---

## G-01 Service Identity 签发、绑定、轮换、撤销及 allowlist

### 1. 当前源码路径与 SHA

- `packages/shared-contracts/src/auth.ts`（`16b01d9`，blob `80af43e37e73a5d1e0f361baa60d217cb0422a01`）
- `packages/shared-contracts/src/oidc-jwks.ts`（blob `b16577818786d22a5d1f6d9c97333eb9e3b08d10`）
- `services/http-api/src/server.ts`（blob `7e15cc84bce5d676a99637577f863c77d9900cc8`）
- `services/telemetry-ingestion/src/index.ts`（blob `fead8b25e9463b8a9ddde29ce103364bedc56967`）
- OpenBot：`src/task-outcome/types.ts`、`src/task-outcome/chat-entry.ts`、`src/task-outcome/runtime-from-runner.ts`、`src/routing/session-key.ts`（`73013587`，blob 与 `f3558f2` 起相同）

### 2. 当前实现事实（`SOURCE_VERIFIED`，非设计文档）

- 仅有 JWT / OIDC 验签接口，无生产签发、无 allowlist 控制面、无轮换 / 撤销 API、无生产 issuer 环境装配。
- 入库不校验 Agent 绑定。空 `allowedJwksHosts` 不允许远程 IdP。
- OpenBot 内部存在 `anonymous` / `runner` 回退与 `normalizeAgentId` → `"main"`。个人 TrustedScope 无 `tenantId`。
- 测试夹具 `https://auth.openbot.love` 不是活 IdP。

### 3. 缺失行为及安全影响

- 无法证明官方出站身份由唯一指定签发方发出。
- 未绑定 Agent 的服务凭证可能被用于冒充默认 `"main"` 或内部回退身份。
- 无法紧急撤销后拒绝新事件；依赖不可用时无 503 fail-closed 分支，存在被误判为成功或降级放行的风险（当前未配置验签器会 401，但不覆盖运行中 IdP 故障）。
- D-02 / D-03 原则已批，控制面未落地，故 D-03 责任指定仍阻塞实施。

### 4. 可执行测试场景（计划，未执行）

- 正例：唯一测试签发器签发的服务身份 + 名单内 agentId + 匹配 tenantId → 202 入库，主体正确。
- 负例：缺 Bearer、错误签名、过期、nbf、错误 iss/aud、服务主体 `actAsUser`、名单外 agentId、已撤销身份、用 `"anonymous"` / `"runner"` / 规范化 `"main"` 作为正式出站身份、个人 TrustedScope 虚构 tenantId。
- 故障注入：JWKS 超时 / 签发系统不可达 / allowlist 权威源不可达 → 不得 202，不得降级匿名；出站不得同步失败主链。撤销后缓存未主动失效的窗口测试（时限以签批值为准）。

### 5. 预期结果与通过标准

- 无效或撤销身份不入库；认证失败 fail closed。
- 绑定查询使用当时权威名单，而不是过期缓存冒充有效。
- 已接收事件不因后续撤销被删除。
- 测试夹具 Issuer 不得被当成生产通过证据。

### 6. 责任仓与证据产出

- 控制面与入库证据：`ai-optimization`
- 出站不注入内部回退身份、不把私钥写入事件：`openbot-vp`
- 签发系统对接证据：由 Owner 指定的签发责任方提供配置与审计（责任人仍 `OWNER_DECISION_PENDING`）

### 7. 尚需 Owner 决策的前置条件

R-08 至 R-14（签发主体、密钥与撤销责任、allowlist 四类责任人、TTL / 传播时限、503 细则）。未指定前不得开始业务编码。

**缺口状态：开放。**

---

## G-02 Prompt、Model、Tool、Agent、Experiment 真实运行时版本来源

### 1. 当前源码路径与 SHA

均在 `openbot-vp@73013587`，下列 blob 自 `f3558f2` 至当前 `main` **未变**（`SOURCE_VERIFIED`）：

| 路径 | blob（前 12 位） |
| --- | --- |
| `src/task-outcome/types.ts` | `b73bdc4daddf` |
| `src/executor-evidence/model-call-evidence.ts` | `671c81e728b1` |
| `src/conversations/projection.ts` | `b9707cd6e181` |
| `src/routing/session-key.ts` | `5a24c63c3a4f` |
| `src/gateway/agent-growth/evolution-task-outcomes.ts` | `62abdb3bedcf` |
| `src/gateway/evolution-control/task-outcome-binding.ts` | `4ff295ea17fa` |
| `packages/evolution-core/src/completion-ledger.ts` | `07737ef5d0fd` |

对端契约字段：`ai-optimization` `packages/shared-contracts/src/index.ts` 33–45 行（`16b01d9`）。

### 2. 当前实现事实（本轮复核 / 沿用相同 blob）

| 字段 | 事实 | 状态 |
| --- | --- | --- |
| Model Provider / ID | `ModelCallEvidence.provider` / `model`（`model-call-evidence.ts` 29–44 行） | 部分已证明（SUPPORTED），须取自该次证据对象 |
| Tool Name | `AttemptResult.toolObservations[].toolName`（`types.ts` 51 行） | 部分已证明（SUPPORTED）；无观察则省略，不得补当前工具清单 |
| Policy / contract versions | `TaskOutcomeRecord.taskContractVersion` 等记录字段（`types.ts` 158–161 行）；`AcceptanceEvidence.validatorVersion` / `taskContractVersion` / `executionVersion`（75–80 行） | 部分已证明，**仅当取自该次记录实际字段**。不得用今天的源码常量回填。注意 `judgementPolicyVersion` 在写入路径（如 `src/task-outcome/transitions.ts` 48 行）被赋值为源码常量 `JUDGEMENT_POLICY_VERSION = "1.0.0"`；历史记录上的已写入值是快照，今天的常量不是补缺依据 |
| Agent Version | `DEFAULT_AGENT_ID = "main"` 是 Agent **id** 回退，不是 Version（`session-key.ts` 19、89–106 行） | **UNVERIFIED** |
| 运行时 Prompt Version | `PROJECTION_PROMPT_VERSION = "rule-v2"` 是会话投影规则版本（`projection.ts` 48、147 行），不是已证明的模型调用 Prompt Version；`ModelCallEvidence` 无 `promptVersion` | 运行时 Prompt Version：**UNVERIFIED**。禁止回填 `rule-v2` |
| Model Version | `ModelCallEvidence` 无独立 `modelVersion` | **UNVERIFIED** |
| Tool Version | 观察中无版本字段 | **UNVERIFIED** |
| Experiment ID | 普通 `TaskOutcomeRecord` 无此字段。`EvolutionTaskOutcomeRecord` 有可选 `experimentId`；注释写明调用方传入 ID 无权威，须经 `bindWorkingDnaTaskOutcomeRecord` 绑定并剥离伪造或残缺 ID（`evolution-task-outcomes.ts` 17–28、52–55 行） | 普通 run：**UNVERIFIED**。仅绑定之后的值部分已证明。Adapter 不得绕过绑定 |
| Trace ID | 契约预留 `traceContext.traceId` / `spanId` / `parentSpanId`。本轮在 `73013587` 上对 `src/`、`packages/`、`apps/`、`services/` 以及排除压缩资源后的仓库做了 `traceparent` / `tracestate` 检索：**无匹配**（`SOURCE_VERIFIED`）。唯一曾命中的是 `extensions/diffs/assets/viewer-runtime.js` 压缩语法高亮资源，与 W3C 传播无关。检索方法：`git grep` 于提交对象，不依赖「路径 diff 为空」作唯一依据 | 运行时传播 **UNVERIFIED / 未实现** |

不得用当前 latest、今天的源码常量或投影常量代替缺失的历史运行时版本。UNVERIFIED 字段保持 UNVERIFIED。

### 3. 缺失行为及安全影响

- 无官方出站过滤时，可能把内部 id 回退、投影常量或调用方自报 `experimentId` 写成「真实版本快照」。
- 无 `traceparent` 实现时，若直接把任意 `traceId` 当传播证据或幂等键，会违反 D-04。
- 用当前配置回填缺失字段会伪造历史。

### 4. 可执行测试场景（计划）

- 正例：一次含 `ModelCallEvidence` 与 `toolObservations` 的真实运行；出站字段与该次对象逐项对照。Evolution 路径仅使用绑定后的 `experimentId`。
- 负例：去掉某次证据后企图填写 latest / `rule-v2` / 当前默认模型 / 自报 experimentId / 把 `DEFAULT_AGENT_ID` 当作 Agent Version。
- 故障注入：证据对象部分缺失；投影流水线与模型调用同时存在时，确认投影常量未泄漏到运行时事件。

### 5. 预期结果与通过标准

- 纳入字段与该次证据一致；排除或不可证字段省略或标 UNVERIFIED，且不得被后续实现改写为「已验证」。
- 无绑定则无权威 `experimentId`。
- Trace ID 不得作为幂等键。

### 6. 责任仓与证据产出

- 运行时证据对象与出站构造：`openbot-vp`
- 入库拒绝非法回填 / 非法把 Trace ID 当幂等键：`ai-optimization`
- 纳入 / 排除清单：Owner（R-18）

### 7. 尚需 Owner 决策的前置条件

R-18（D-05 字段纳入 / 排除清单）。D-04 / D-05 原则已批，不等于清单或实现已批准。

**缺口状态：开放。**

---

## G-03 API 身份校验、请求体上限、限流、未知字段及服务端红化

### 1. 当前源码路径与 SHA

见 `API_LIMITS_CANDIDATE_COMPARISON.md` 第 1 节（`16b01d9` 路径与 blob SHA）。

### 2. 当前实现事实

- POST 先认证再入库；GET `/v1/telemetry/events` 已实现且先认证，但未写入 OpenAPI；多条 OpenAPI 路径未实现。
- `readJsonBody` 无字节上限；无线程限流、无 413/429/Retry-After。
- ingest 信任 `redaction.applied`，不调用 `ContractValidator`，未知信封字段可被整对象落库。
- 无生产 OIDC 环境装配；无官方 OpenBot 客户端。
- PR #4 不修复本缺口。

### 3. 缺失行为及安全影响

- 无体上限与限流：共享入口可被超大体或重试风暴打满。
- 信任客户端红化：攻击者或缺陷客户端可把原文标成已红化后入库。
- 未知字段落库：PII 与契约漂移。
- 未文档化 GET 若被当作正式读接口，存在过量读取与契约混乱（当前虽认证，仍缺角色门槛与分页）。
- 静默截断或 SDK 静默丢字段不能代替服务端策略。

### 4. 可执行测试场景（计划）

- 正例：不超过批准体上限、经服务端红化、已知字段完整的合法 POST → 202。
- 负例：超大体；未声明信封字段；仅 `redaction.applied=true` 但含敏感原文；以 Trace ID 为幂等键；Tenant 不匹配；未认证 GET/POST。
- 故障注入：限流触顶；截断半截 JSON；绕过 SDK 直接 POST；突发重放与 429 Retry-After。

### 5. 预期结果与通过标准

见 API 比较文档第 3 节。数值以签批值为准；未批准前不得用 64 KiB 宣称生产契约已生效。

### 6. 责任仓与证据产出

- HTTP / 入库硬化与证据：`ai-optimization`
- 出站遵守体上限、不截断、正确处理 429：`openbot-vp`（在官方缓冲实现之后）

### 7. 尚需 Owner 决策的前置条件

R-01 至 R-07（体上限、双维限流、Retry-After、幂等保留期、冲突行为、未知字段与服务端红化策略）。

**缺口状态：开放。**

---

## G-04 WAL 故障恢复、重复投递、幂等去重、容量与清理边界

### 1. 当前源码路径与 SHA

必须区分两条线：

| 线 | SHA | 路径 | 说明 |
| --- | --- | --- | --- |
| `main` 弱 WAL | `16b01d9` | `packages/telemetry-sdk/src/index.ts`（blob `02928668…`） | **不在 OpenBot 仓**；不满足崩溃恢复要求 |
| 未合并 PR #4 | `8324aa2` | 同上 + `packages/telemetry-sdk/src/wal-lock.ts` + `tests/integration/telemetry-wal-crash-recovery.test.ts` + `docs/architecture/handover/TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md` | 更强，但仍有残余限制；**不是** main，也不是 OpenBot 出站 WAL |
| OpenBot 官方出站 WAL | `73013587` | **不存在实现** | D-07 要求的对象尚未出现 |

### 2. 当前实现事实

详见 `PR4_WAL_DISPOSITION_COMPARISON.md`。要点：

- `main`：无锁、无 leftover tmp 调和、无目录 fsync；满员 `shift()` 可静默丢弃；吞异常。
- PR #4：协作式 Linux 抽象 socket 活锁（非 flock）；非 Linux fail-closed；leftover tmp 与目录 fsync；at-least-once；有 SIGKILL 测试；**无真实断电试验**。
- 入库幂等是 `UNIQUE (tenant_id, idempotency_key)` + `INSERT OR IGNORE`，无冲突指纹、无 TTL。
- 不得用 PR #4 测试代替 OpenBot 出站验收。

### 3. 缺失行为及安全影响

- 若误用 `main` 弱 WAL：未确认事件可能静默丢失，证据链断裂。
- 若把 PR #4 当断电安全或 exactly-once：夸大耐久与去重保证，导致运维误判。
- 若 OpenBot 没有自有默认关闭的异步 WAL：对端故障可能同步影响主链，或出站在无缓冲时丢事件。
- 幂等冲突被当成重复成功：不同事件可能被静默合并。

### 4. 可执行测试场景（计划）

- 正例：默认关闭时无出站试探；打开测试开关后，主链返回后缓冲再投递；同一 Tenant+Key 重放不双写。
- 负例：以 Trace ID 为键；跨租户同键串桶；partial tmp 被晋升；未确认集合被无审计淘汰。
- 故障注入：SIGKILL 于确认前；对端 5xx / 超时；磁盘满或锁失败（fail-closed 于缓冲路径，且不失败主链）。**进程崩溃不得写成断电证明。**

### 5. 预期结果与通过标准

第 4 节「无论 A/B/C 都必须单独满足的下限」。通过标准以 OpenBot 官方缓冲 + 入库去重的联合证据为准。

### 6. 责任仓与证据产出

- 官方出站 WAL 与主链隔离证据：`openbot-vp`
- 入库去重 / 冲突 / TTL 证据：`ai-optimization`
- PR #4 若仅作对照：保持开放，不作为依赖；若 Owner 选 B，另案合并授权后再在 SDK 仓取证，仍不能替代 OpenBot 证据

### 7. 尚需 Owner 决策的前置条件

R-15（A/B/C）；R-05 / R-06（保留期与冲突）。D-07 原则已批，不含并 PR #4。

**缺口状态：开放。**

---

## G-05 OpenBot 身份注入、异步隔离、AI Optimization 故障不影响 Agent 主执行链

### 1. 当前源码路径与 SHA

- 身份回退路径：同 G-01 的 OpenBot 文件（`73013587`，blob 未变）
- 官方 Telemetry Adapter / 出站缓冲：当前 `main` **无实现**（相对 `b10ad59` 仅依赖升级，`SOURCE_VERIFIED`）
- 对端 HTTP：`ai-optimization` `services/http-api/src/server.ts`（`16b01d9`）

### 2. 当前实现事实

- 内部账本可注入 `anonymous` / `runner`，但 D-02 禁止它们作为正式身份。官方出站过滤器不存在，故「不会把内部回退送出去」**尚未证明**。
- 无默认关闭的异步非阻塞官方 WAL，故「对端故障不阻塞主链」在官方路径上 **尚未证明**。既有章程与 D-07 是原则，不是已实现证据。
- AI Optimization 不可用时的 OpenBot 行为：因官方出站未落地，本轮只能记录「无该路径」，不能把「代码里还没调用对端」写成已经通过故障隔离验收。

### 3. 缺失行为及安全影响

- 若出站实现直接复用 `scopeFromChatEntry` / `defaultScope` 而不过滤，个人数据或匿名 / runner 可能进入企业遥测，违反 D-01 / D-02。
- 若出站同步等待对端，AI Optimization 故障或限流会拖垮 Agent 主执行链。
- 若默认开启出站，未完成证据的实现可能对生产试探。

### 4. 可执行测试场景（计划）

- 正例：企业已验证范围 + 测试开关打开 + 对端正常或延迟；主链在预算内完成，事件稍后入库。
- 负例：个人范围、anonymous / runner、空 agentId；默认配置（开关关闭）不得出站。
- 故障注入：对端 5xx、超时、断连、证书错误、完全不可达、429；主链成功/失败判定不依赖对端。

### 5. 预期结果与通过标准

- 主执行链不等待遥测网络；Readiness / Control Plane 不被同步阻塞。
- 第一期个人数据不出站；正式身份 fail closed。
- 默认关闭。

### 6. 责任仓与证据产出

- 主责：`openbot-vp`
- 对端故障码与限流行为配合：`ai-optimization`（提供非生产桩或真实非生产服务，不得用生产流量）

### 7. 尚需 Owner 决策的前置条件

R-15（WAL 落点）；R-08–R-14（身份）；R-16（最小验收集包含第 7、8、10 项）。开始实现须另有 Implementation Plan 批准与编码授权。

**缺口状态：开放。**

---

## G-06 跨仓契约测试及 OpenBot CI 故障根因

### 1. 当前源码路径与 SHA

- 跨仓契约测试：**尚未建立**官方出站 ↔ 入库的跨仓 CI 作业（`SOURCE_VERIFIED` / `GITHUB_VERIFIED`：本轮只见单仓测试与文档 PR）。
- OpenBot 当前 `main`：`73013587e3a5ccd96a0d0c284f7223199d39ed75`。
- 上一 `main`：`b10ad59bf6205edaa1566847cfa1685e1283c8af`。
- 短 SHA `25b6613e6` 本轮仍不可解析（GitHub HTTP 422），不得编造。

### 2. 当前实现 / CI 事实（`GITHUB_VERIFIED`）

当前 `main` `73013587`（推送 2026-11-28 23:17:18 CST）在本窗口（23:30–23:42 CST；含 23:41:30 CST 刷新）的 workflow：

| Workflow | Run | 状态 | 完成时间（CST） |
| --- | --- | --- | --- |
| Workflow Sanity | [46159070274](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159070274) | **success**（已完成） | 23:17:39 |
| Install Smoke | [46159069950](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069950) | **success**（已完成） | 23:29:58 |
| CI Gate | [46159069980](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069980) | **failure**（已完成） | 23:24:11 |
| CI | [46159069913](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069913) | **failure**（已完成）。23:30–23:35 仍为 in_progress，23:41:30 刷新时已完成 | 23:38:13 |
| Docker Release | [46159069924](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069924) | **cancelled**（已完成）。23:30–23:35 仍为 pending | 23:38:57 |

CI Gate 失败作业为 `delivery guard`，失败步骤为 **Release ledger audit**（`pnpm delivery:ledger:audit` / `scripts/delivery/ledger-audit.ts`）。日志摘要：`ledger: 163 releases, 157 errors, 24 warnings`；错误标签以 `[missing-object]` 为主（157 次），另有警告 `[overlay-debt]` 15、`[timeline-gap]` 8、`[missing-tag]` 1；以 **exit code 30** 结束（[job 141022083271](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069980/job/141022083271)）。`RELEASE_RECORD current-identity anti-drift` 被 skipped。`check (types, lint, format)` 作业 success。

上一 SHA `b10ad59` 的 CI Gate [46154967209](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46154967209) 同样在 `delivery guard` / `Release ledger audit` 以 exit 30 失败（22:39:31 CST）。将该次失败日志与本次失败日志去掉时间戳后比较，**187 条错误/警告/摘要正文完全相同**（`GITHUB_VERIFIED`）。这证明**症状与退出码一致**，并且本轮不必再借用更早 SHA、exit 1 的旧日志来顶替。

`b10ad59` 上随后完成的 Workflow CI [46154967146](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46154967146) 为 **failure**（22:48:30 CST）。其 Docker Release [46154967239](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46154967239) 在本窗口仍显示 **in_progress**（最后更新 22:59:31 CST）。上述完成态是相对于上一包「当时仍 in_progress」的刷新，不得回溯改写上一包窗口结束时的表述。

Workflow CI 失败 job（名称级，`GITHUB_VERIFIED`，**不作为统一根因**，本轮未对每个 job 下钻到用例）：`secrets`；`check`；`android (test, ./gradlew --no-daemon :app:testDebugUnitTest)`；`checks (node, protocol, pnpm protocol:check)`；`checks (node, test, … pnpm test)`；`checks-windows (node, test, 1–6/6, pnpm test)` 全部六个分片。其余 job 有 success 或 skipped。Docker Release 被 cancelled，取消原因未单独取证。这些失败与 CI Gate 的 ledger `[missing-object]` / exit 30 **不得**被合并成一个未经证明的根因。

Install Smoke / Workflow Sanity success **不等于**整仓 CI 绿，也不得解释为 CI Gate、Workflow CI 或跨仓验收通过。

### 3. 缺失行为、安全影响与根因限制

- 跨仓契约测试未建立，无法证明官方事件在两端一致。
- OpenBot CI Gate 持续失败，阻塞任何「平台已绿」或生产声明。
- **根因：`ROOT_CAUSE_UNKNOWN`。** 本轮可以核实失败步骤、计数、标签与两份 Gate 日志正文相同，但现有 GitHub 日志与源码阅读**不足以**判定 `[missing-object]` 是因为 Actions checkout 对象图不完整、ledger 引用了仓库中不存在的历史对象、脚本误判，还是其他原因。不得把「日志相同」升级为根因。不得用更早 SHA 的失败当作当前 SHA 的根因替代（即便模式相似，仍须各自取证；本轮已对当前 SHA 直接取证）。
- 本工作流**未授权**实施 CI 修复，也不得为了变绿而削弱测试或改 OpenBot。

本项触发阶段停止条件中的「无法取得足够证据证明某项结论」：**仅停止对根因的断言**，改为记录证据不足；其余计划仍可交付。

### 4. 可执行测试场景（计划，须另授权）

- 正例：在对象图完整、ledger 口径获解释之后，审计以约定退出码通过；同时建立跨仓契约作业（合法事件 202、非法事件不入库）。
- 负例：契约被打破时跨仓作业失败；局部绿 workflow 不得单独作为门禁。
- 故障注入：有意缺少对象或改写 ledger 的受控实验，用于**证明**脚本行为。这需要单独授权，且不是本阶段任务。

### 5. 预期结果与通过标准

- CI Gate 根因有可独立复核的证据链，修复（若获授权）不削弱测试。
- 跨仓契约作业存在且与十四项矩阵对应；单仓绿不等于跨仓通过。
- 在根因未知期间，不得宣布 OpenBot CI 已恢复。

### 6. 责任仓与证据产出

- CI Gate / ledger 审计：`openbot-vp`（另案排障，不在本阶段实施）
- 跨仓契约作业：`openbot-vp` + `ai-optimization`（编排位置待 Owner / 工程约定）
- 本阶段证据产出仅限于只读日志与状态记录

### 7. 尚需 Owner 决策的前置条件

- R-16（最小验收集）决定跨仓契约作业覆盖哪些项。
- 是否以及何时授权独立工作流排障 OpenBot CI：**本阶段不得实施**。CI 变绿不是 Adapter 开工前提，但是任何生产声明的前提。

**缺口状态：开放。根因保持 `ROOT_CAUSE_UNKNOWN`。**
