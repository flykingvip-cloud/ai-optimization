# TELEMETRY_VERSION_SNAPSHOT_CONTRACT.md

> Version Snapshot 字段来源契约（决策收口，不实施）。  
> 原则「只记录该次运行的真实版本，缺失时不伪造 latest」是本阶段指令要求固化的方向，**不是**正式 `APPROVED`，也**不是**字段映射已批准。  
> 无法从当前源码证明的来源一律标 **UNVERIFIED**，不得推断或补造版本值。  
> 核验窗口：2026-11-28 19:19–19:23 CST。OpenBot 源码 SHA：`13763b2d85c6ca72d3bf5b10acb1825457776ff6`。AI Optimization 契约 SHA：`16b01d99d33b386102bb9b2b248558eb5517e245`。

---

## 1. 原则（用户提供记录 / 架构建议，非 APPROVED）

1. 只记录该次运行实际使用的版本，禁止用仓库当前 latest、默认常量或事后配置回填冒充历史运行时版本。
2. 无法获得时：省略该字段，或显式标记 `unavailable`（最终编码由 Owner 签批）；二者都不得填入猜测值。
3. 对端契约已为部分字段预留可选位置：`traceContext.agentVersion`、`promptVersion`、`toolPolicyVersion`、`experimentId`（`packages/shared-contracts/src/index.ts` 33–45 行）。预留字段 ≠ 已有真实采集实现。
4. `TaskOutcomeRecord` 是运行结果权威，但本轮在 `src/task-outcome` 与 `src/executor-evidence` 下检索 `experimentId` / `agentVersion` / `toolVersion` / `promptVersion`，**无匹配**。不得把其他子系统的同名字段自动当成 TaskOutcome 快照。

---

## 2. 字段来源表

| 字段 | 真实来源系统（已证明或 UNVERIFIED） | 运行时采集位置 | 与 TaskOutcome / Run 的关联 | 缺失时处理 | 是否允许进入遥测事件 |
| --- | --- | --- | --- | --- | --- |
| Agent Version | **UNVERIFIED**。存在 `DEFAULT_AGENT_ID = "main"` 与 `normalizeAgentId` 回退（`src/routing/session-key.ts` 19、89–106 行），这是 **Agent id**，不是版本。未找到可复用的、与一次 run 绑定的 `agentVersion` 快照对象。 | 未证明 | 事件中的 `traceContext.agentId` 可对应运行使用的 agent id（须经 allowlist，禁止把非法 id 规范化成 `"main"` 后出站）。版本字段本身无绑定证据 | 省略或 `unavailable`，禁止用 latest 或 `"main"` 冒充版本 | **仅当**后续源码补证或 Owner 指定权威对象之后才允许；当前不得实施猜测映射 |
| Prompt Version | 会话投影里有 `generatedBy.promptVersion` 与常量 `PROJECTION_PROMPT_VERSION = "rule-v2"`（`src/conversations/projection.ts` 23–28、48 行）。这是**会话投影规则版本**，不是已证明的「该次 Agent 模型调用所使用的 Prompt Version」。运行时 Prompt Version：**UNVERIFIED** | 投影字段仅证明投影流水线；模型调用证据类型无 `promptVersion`（见下） | 不得用投影常量回填模型调用或 TaskOutcome 事件 | 运行时 Prompt 缺失则省略 / `unavailable`；禁止填 `rule-v2` 冒充 | 投影类事件若单独定义且来源就是投影对象，可记投影的 `promptVersion`，并必须标明来源是 projection 而非 agent run。Agent 运行时事件：当前 **不允许用未验证来源写入** |
| Model Provider / Model ID | **部分已证明。** `ModelCallEvidence` 含 `provider: string`、`model: string`，并绑定 `agentId`、`scope`、`taskId`、`runId`、`attemptId`、`callId`（`src/executor-evidence/model-call-evidence.ts` 29–44 行） | 模型调用证据对象（该次 call / attempt） | 通过 `taskId` / `runId` / `attemptId` 关联 TaskOutcome 的 run/attempt，而不是用事后配置表 | 若该次调用证据缺失 provider/model，省略或 `unavailable`，不得引用当前默认模型配置 | 允许进入对应 `runtime.model.called`（或等价）事件，前提是取自该次 `ModelCallEvidence` |
| Model Version | **UNVERIFIED。** `ModelCallEvidence` **没有**独立 `modelVersion` 字段（同文件 29–44 行及后续可见字段为状态 / token，无 version）。不得把 `model` 字符串解析结果当作已验证的 modelVersion | 无已证明采集位置 | 无 | 省略或 `unavailable`，禁止用供应商 latest | 来源未证明前 **不允许编造后写入** |
| Tool Name | **部分已证明。** `AttemptResult.toolObservations[]` 有 `toolName`（`src/task-outcome/types.ts` 51 行） | 该次 attempt 的观察列表 | 挂在 `attemptId` / `runId` 下 | 无观察则省略工具名，不得补当前工具清单 | 允许进入该次 attempt 相关工具事件，且仅限观察中出现的名字 |
| Tool Version | **UNVERIFIED。** `toolObservations` 只有 `toolName`、`ok`、`summary`，无 `toolVersion`。其他模块的 `policyVersion` 不能代替工具版本 | 无已证明采集位置 | 无 | 省略或 `unavailable` | 来源未证明前 **不允许写入编造版本** |
| Policy Version | **部分已证明，须区分哪一种策略。** `TaskOutcomeRecord` 有 `schemaVersion`（常量 `TASK_OUTCOME_SCHEMA_VERSION = "1.0.0"`）、`taskContractVersion`、`judgementPolicyVersion`（类型上为 `typeof JUDGEMENT_POLICY_VERSION`，常量 `"1.0.0"`）（`src/task-outcome/types.ts` 10–11、158–161 行）。`AcceptanceEvidence` 另有 `validatorVersion`、`taskContractVersion`、`executionVersion`（73–80 行）。另有入站工具策略常量 `INBOUND_TOOL_POLICY_VERSION = "inbound-tool-policy-v1"`（`src/agents/inbound-tool-policy.ts` 11 行），以及协作 / 认知合并等处的局部 `policyVersion`。这些是不同对象。 | 对 TaskOutcome 相关事件：取**该条记录上已经写入的** `taskContractVersion` / `judgementPolicyVersion`，而不是源码常量的「当前值」 | 直接位于 `TaskOutcomeRecord` | 若某条历史记录缺字段，省略或 `unavailable`，禁止用源码里今天的 `"1.0.0"` 回填旧记录 | 允许进入 `runtime.task_outcome.recorded` 的，仅限该记录上真实存在的策略 / 契约版本，并在字段名中区分 judgement / contract，避免与 tool policy 混名。`INBOUND_TOOL_POLICY_VERSION` 只有在该次运行确实使用该入站策略且证据链可证明时才允许；否则 **UNVERIFIED**，不得因为常量存在就写入 |
| Experiment ID | **UNVERIFIED（相对 TaskOutcome / 普通 Agent run 快照）。** `TaskOutcomeRecord` 本身无此字段。`EvolutionTaskOutcomeRecord` 有可选 `experimentId`（`src/gateway/agent-growth/evolution-task-outcomes.ts` 17–28 行），且注释写明「Caller experiment/application IDs are not authoritative. Binding reads Evolution Control persist state and strips forged or partial IDs。」（52–53 行），绑定经 `bindWorkingDnaTaskOutcomeRecord`。Evolution 完成账本也有 `experimentId`（`packages/evolution-core/src/completion-ledger.ts`）。这证明 Evolution Control 侧有实验绑定，**不证明**每次普通 Agent 运行都有可出站的 experimentId，也不证明调用方传入值可直接采信 | 若且仅若出站的是已经过 Evolution Control 绑定的记录，采集绑定后的值 | 不得把未绑定的调用方字段关联到 TaskOutcome 权威记录 | 无绑定则省略，禁止填当前实验或调用方自报值 | **仅允许**写入经 Evolution Control 绑定后的值。Adapter 不得绕过该绑定。普通运行无线索时不得出站 experimentId |

---

## 3. 与对端契约的关系

AI Optimization `traceContext` 将 `agentVersion`、`promptVersion`、`toolPolicyVersion`、`experimentId` 标为可选，且没有 `modelVersion` / `toolVersion` 独立字段。实施时若新增字段或把可选字段变为有条件必填，属于契约变更，须在原则签批后的实施计划中单列，不得在来源 UNVERIFIED 时先写死。

---

## 4. 验收条件

1. 回放或测试中，事件版本字段与该次运行证据对象一致，而不是与「当前配置 latest」一致。
2. 人为去掉某版本来源后，出站事件不出现编造值；字段被省略或为 `unavailable`。
3. 使用 `PROJECTION_PROMPT_VERSION` 或 `JUDGEMENT_POLICY_VERSION` 常量去填充无关事件类型的用例必须失败。
4. 调用方自报、但未经 Evolution Control 绑定的 `experimentId` 不得出现在官方出站事件中。
5. UNVERIFIED 字段在 Owner 批准补证或明确排除之前，实施计划不得把它们列为「已映射可编码」。

**当前结论：** 原则由本阶段指令要求固化；字段映射部分 `UNVERIFIED` + `IMPLEMENTATION_BLOCKED`；正式状态非 `APPROVED`。
