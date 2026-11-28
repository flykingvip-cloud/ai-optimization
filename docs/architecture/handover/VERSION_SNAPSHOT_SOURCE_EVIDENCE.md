# VERSION_SNAPSHOT_SOURCE_EVIDENCE.md

> Version Snapshot 逐字段来源证据（T3）。  
> 核验窗口：2026-11-28 21:43–21:50 CST（Asia/Shanghai）。  
> OpenBot 当前 `main`：`b4e106de7562ce62d2e62057ba16864ec12a2645`。本轮 `git diff --name-only 13763b2d..b4e106de` 仅 5 个 UI 文件。下列身份 / TaskOutcome / 证据 / 投影 / Evolution 绑定文件的 blob 与 `13763b2d85c6ca72d3bf5b10acb1825457776ff6` 及 `f3558f2ccd24a1020dff8a378721786b3071f641` **完全相同**（`SOURCE_VERIFIED`）。字段结论在新 SHA 上重新复核后仍然适用，不是未复核的沿用。  
> AI Optimization 契约：`16b01d99d33b386102bb9b2b248558eb5517e245`。  
> 禁止用当前 latest 或配置默认值冒充执行时版本；禁止把 Trace ID 当作 Experiment ID 或幂等键。无法证明的来源一律 **UNVERIFIED**。

原则建议（`RECOMMENDATION`，非 APPROVED）：只记录该次运行实际使用的版本；缺失时省略、拒绝或显式标记 `UNVERIFIED` / `unavailable`（最终编码待 Owner 签批）；二者都不得填猜测值。

---

## 1. 逐字段来源表

| 字段 | 真实 runtime 对象或接口 | 产生仓库 | 是否执行时快照 | 调用方是否可伪造 | 缺失行为（建议） | 可信度 | Phase 1 建议 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tenant ID | Enterprise `TrustedScope.tenantId`（`src/task-outcome/types.ts` 65–71 行）。必须是已验证范围上的真实租户，而不是请求体自报值。入库另以已验证 `auth.tenantId` 对齐（`telemetry-ingestion` 18–27 行） | OpenBot 产生范围；AI Optimization 校验声明 | 是（该次任务/运行的 scope） | 调用方自报不可作为隔离依据。未验证的 tenant 不得用于分桶 | 企业范围缺失真实 tenantId：拒绝出站/入库（fail closed）。禁止虚构 Personal Tenant | **部分已证明**（对象存在）；官方出站过滤未实施 | **纳入**，且仅限 Enterprise 已验证值（取决于 D-01 签署） |
| Service Identity | 应对应为已验证 JWT 的 `sub` + `principalType=service`（`auth.ts` 102–121 行）。OpenBot 侧尚无官方 Adapter 出站身份对象 | 签发系统未指定（`OWNER_DECISION_PENDING`）；校验在 AI Optimization | 应是出站当时持有的凭证身份，不是事后填写 | 无有效签名则可伪造，故必须验签且 fail closed | 缺失或验签失败：拒绝（401/403），不得降级 anonymous/runner | 校验接口已证明；签发与绑定 **UNVERIFIED / 未落地** | **纳入为必填认证主体**，但签发/绑定未闭环前不得实施 |
| Agent ID | 运行使用的 agent id。存在 `DEFAULT_AGENT_ID = "main"` 与 `normalizeAgentId` 回退（`src/routing/session-key.ts` 19、89–106 行） | OpenBot | 应取该次运行实际 agent id，而不是规范化后的默认值 | 若使用空/非法 id 回退到 `"main"`，等于把未绑定身份装成默认 Agent | 无合法 agent id：拒绝出站，禁止回退为 `"main"` 后发送 | Agent **id** 机制已证明；与 allowlist 的绑定未落地 | **有条件纳入**：只允许 allowlist 中的原始合法 id |
| Agent Version | 未找到与一次 run 绑定的 `agentVersion` 快照对象。`DEFAULT_AGENT_ID` 不是版本 | — | 否（无对象） | 若写入 latest/默认字符串，属于伪造 | 省略或标 `UNVERIFIED` / 从 Phase 1 排除 | **UNVERIFIED** | **Phase 1 排除或标不可用**。后续依赖：在 Agent 运行时记录与该次 run 绑定的版本对象 |
| Prompt Version | 会话投影有 `generatedBy.promptVersion` 与常量 `PROJECTION_PROMPT_VERSION = "rule-v2"`（`src/conversations/projection.ts` 23–28、48、147 行）。`ModelCallEvidence` 无 `promptVersion` | OpenBot 投影流水线（非 Agent 模型调用证据） | 投影字段是投影流水线快照，不是已证明的模型调用 Prompt 快照 | 用 `rule-v2` 回填模型调用或 TaskOutcome 事件属于伪造 | 运行时 Prompt 缺失：省略 / `UNVERIFIED`；禁止填 `rule-v2` | 运行时 Prompt Version：**UNVERIFIED**。投影规则版本：仅在投影类事件且标明来源时部分可证 | **Agent 运行时事件：Phase 1 排除或不可用。** 不得把投影常量回填到官方运行时事件 |
| Model Provider / Model ID | `ModelCallEvidence.provider`、`ModelCallEvidence.model`，并绑定 `agentId`、`scope`、`taskId`、`runId`、`attemptId`、`callId`（`src/executor-evidence/model-call-evidence.ts` 29–44 行） | OpenBot | 是（该次 call / attempt） | 不得用当前默认模型配置替代缺失的证据对象 | 该次调用证据缺失则省略，不得引用当前默认模型 | **部分已证明（SUPPORTED）** | **纳入**对应 `runtime.model.called`（或等价）事件，且必须取自该次 `ModelCallEvidence` |
| Model Version | `ModelCallEvidence` **没有**独立 `modelVersion` 字段（同文件 29–44 行及后续可见字段为状态 / token，无 version） | — | 否 | 把 `model` 字符串解析成 version 或填供应商 latest 属于伪造 | 省略或 `UNVERIFIED` | **UNVERIFIED** | **Phase 1 排除或标不可用**。后续依赖：在模型调用证据中记录供应商返回的真实 version（若有） |
| Tool Name | `AttemptResult.toolObservations[].toolName`（`src/task-outcome/types.ts` 51 行） | OpenBot | 是（该次 attempt 观察） | 不得补当前工具清单 | 无观察则省略 | **部分已证明（SUPPORTED）** | **纳入**该次 attempt 相关工具事件，且仅限观察中出现的名字 |
| Tool Version | `toolObservations` 只有 `toolName`、`ok`、`summary`，无 `toolVersion` | — | 否 | 用其他模块的 `policyVersion` 代替工具版本属于伪造 | 省略或 `UNVERIFIED` | **UNVERIFIED** | **Phase 1 排除或标不可用**。后续依赖：工具观察或工具注册表在执行时记录版本 |
| Policy Version | `TaskOutcomeRecord` 有已写入的 `schemaVersion`、`taskContractVersion`、`judgementPolicyVersion`（`types.ts` 10–11、158–161 行）；`AcceptanceEvidence` 另有 `validatorVersion` / `taskContractVersion` / `executionVersion`（73–80 行）。另有入站常量 `INBOUND_TOOL_POLICY_VERSION = "inbound-tool-policy-v1"` 及其他局部 `policyVersion`，那是不同对象 | OpenBot | 仅当取**该条记录上已经写入的字段**时，才是该次记录快照。源码常量的「今天的值」不是历史快照 | 用今天的 `"1.0.0"` 回填旧记录属于伪造 | 历史记录缺字段则省略，禁止用当前源码常量回填 | **部分已证明**，须区分策略种类 | **有条件纳入**：仅限该 `TaskOutcomeRecord` 上真实存在的 judgement/contract 版本，并分字段名。`INBOUND_TOOL_POLICY_VERSION` 无该次使用证据则 **UNVERIFIED**，不得仅因常量存在就写入 |
| Experiment ID | 普通 `TaskOutcomeRecord` 无此字段。`EvolutionTaskOutcomeRecord` 有可选 `experimentId`（`src/gateway/agent-growth/evolution-task-outcomes.ts` 17–28、52–53 行），注释写明调用方传入 ID 无权威，绑定经 `bindWorkingDnaTaskOutcomeRecord` 读取 Evolution Control 持久状态并剥离伪造或残缺 ID。Evolution 完成账本亦有 `experimentId`（`packages/evolution-core/src/completion-ledger.ts`） | OpenBot Evolution Control | 仅绑定之后的值是权威快照 | 调用方自报 ID **不可采信**；Adapter 不得绕过绑定 | 无绑定则省略，禁止填当前实验或自报值 | 普通 run：**UNVERIFIED**。经 Evolution Control 绑定的记录：部分已证明 | **普通运行 Phase 1 排除。** 仅当出站对象已是绑定后的 Evolution 记录时允许写入绑定值 |
| Trace ID / Span ID | 对端契约预留 `traceContext.traceId` / `spanId` / `parentSpanId`（`packages/shared-contracts/src/index.ts` 33–37 行）。OpenBot 当前源码检索 `traceparent`：**无匹配**。无已证明的运行时 W3C 采集位置 | 出站侧应在 OpenBot 构造；入库在 AI Optimization 校验 | 若按 D-04：合法入站上下文为传播快照；否则为本地生成并标记 | 非法 `traceparent` 不得转发；生成值必须打 generated 标记，以免被当成上游追踪 | 缺失/无效：本地生成 + 标记；不得用其充当幂等键或 Experiment ID | 契约字段已预留；运行时传播 **UNVERIFIED / 未实现** | **纳入为追踪字段**（取决于 D-04），但必须带 generated 语义；**不得**纳入为幂等或实验身份 |

---

## 2. 与对端契约的关系

AI Optimization `traceContext` 将 `agentVersion`、`promptVersion`、`toolPolicyVersion`、`experimentId` 标为可选，且没有独立的 `modelVersion` / `toolVersion`。把可选字段变成有条件必填，或新增字段，属于契约变更，须在原则签批后的实施计划中单列。来源仍为 UNVERIFIED 时不得先写死映射。

---

## 3. Phase 1 纳入 / 排除建议（非批准）

**建议纳入（有条件，且须取自该次证据对象）：** Tenant ID（仅 Enterprise 已验证值）、Service Identity（已验证服务主体）、Agent ID（仅 allowlist 合法 id）、Model Provider / Model ID、Tool Name、TaskOutcome 记录上已存在的 contract/judgement 策略版本、Trace ID/Span ID（按 D-04 规则，含 generated 标记）。

**建议从 Phase 1 schema/contract 排除或标不可用，并列后续依赖：**

| 字段 | 后续依赖 |
| --- | --- |
| Agent Version | 为每次 run 记录与执行绑定的 agent 版本对象 |
| 运行时 Prompt Version | 在模型调用或 TaskOutcome 证据中记录该次实际 prompt 版本；禁止回填 `rule-v2` |
| Model Version | 在 `ModelCallEvidence` 或等价对象中保存供应商/运行时返回的 version |
| Tool Version | 在 `toolObservations` 或工具注册执行快照中保存 version |
| 普通 run 的 Experiment ID | 不得从调用方或当前实验配置推断；只有 Evolution Control 绑定后的记录才可写 |

---

## 4. 验收条件（建议）

1. 回放或测试中，事件版本字段与该次运行证据对象一致，而不是与「当前配置 latest」一致。
2. 人为去掉某版本来源后，出站事件不出现编造值。
3. 使用 `PROJECTION_PROMPT_VERSION` 或 `JUDGEMENT_POLICY_VERSION` 常量去填充无关事件类型的用例必须失败。
4. 未经 Evolution Control 绑定的调用方 `experimentId` 不得出现在官方出站事件中。
5. UNVERIFIED 字段在 Owner 批准补证或明确排除之前，实施计划不得把它们列为「已映射可编码」。

**当前结论：** 字段映射部分 `UNVERIFIED` + 实施阻塞；正式状态非 `APPROVED`。准入条件「每个纳入字段均有可信来源」**尚未满足**——即便采用排除策略，仍须 Owner 签署 D-05 并确认排除清单。
