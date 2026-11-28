# EVIDENCE_GAP_REGISTER.md

> 技术证据缺口登记册（正式原则签署后更新，缺口仍未关闭）。  
> 原登记窗口：2026-11-28 22:39–22:41 CST（Asia/Shanghai）。  
> 本次更新：2026-11-28 22:51 CST，依据 `OWNER_DECISION_RECORD.md`（Owner 于 22:50 CST 批准控件原文）。  
> 指令 3 允许仅针对 **Owner 已批准** 的原则规划后续补证。本轮**只更新登记**，**不**运行新的实现或测试，**不**因原则获批而宣布任何阻塞性缺口已关闭。设计文档中的承诺不是证据。

已批准原则以控件原文为限，见签署记录。请求稿、PR #7/#8/#9/#10 与「建议 APPROVE / 固化」中的细节**不得**当作已签署的补证范围。

先前发现仍位于 `/workspace/owner-signoff/docs/architecture/handover/` 与 [PR #10](https://github.com/flykingvip-cloud/ai-optimization/pull/10) HEAD `0b3f8727f65934da2821a14515d90209d74a8fce`。相关实现 SHA 仍以冻结确认当时的核验为准，本轮未重新取证。

状态取值：

- `open`：缺口仍在，尚无足以关闭该项的实施或测试证据。  
- `blocked_on_residual_owner_designation`：相应原则已批，但关闭该缺口还依赖尚未指定的责任人、数字或其他 Owner 决定。  
- `unblocked_for_later_closure`：已批准原则足以支持日后规划并补齐该部分证据；**不是**已关闭。  
- `partial_source_verified`：源码或 CI 中已有可引用的事实，但还不是可关闭该缺口的实现/测试证据。  
- `blocked_on_owner_decision`：相应原则或必要残余决定尚未批准（本轮原则项已不再单独使用该标记，改为残余指定）。

没有一项被标记为已关闭。

---

## G-01  Service Identity 签发、轮换、吊销及 Agent allowlist 运维责任

- **依赖决策：** D-03 原则已 `APPROVED`（「Tenant、Service Identity、Agent 三方绑定；allowlist 与撤销责任须明确。」）；亦依赖已批准的 D-02 fail-closed 原则。  
- **当前状态：** `unblocked_for_later_closure`（三方绑定与「责任须明确」的原则已可据以规划后续补证）+ `blocked_on_residual_owner_designation`（签发主体、密钥持有/轮换/撤销责任人及部门仍未指定）+ `partial_source_verified`（控制面未落地）。**未关闭。**  
- **所需证据：** 与原登记相同：可指出的唯一签发主体及系统；绑定实现与测试；allowlist 各动作的责任人记录与可执行流程；轮换与紧急撤销的可复核记录；TTL/传播时限的实现及测试；依赖不可用时的 fail-closed 行为；撤销后新事件拒绝、已接收事件保留。  
- **既有发现位置：** 仍见原登记所引 `SERVICE_IDENTITY_OPERATIONAL_CLOSURE.md` 及源码位置。  
- **日后可接受的证据形态：** 不变。在责任人被正式指定之前，运维责任部分不得标为已关闭。不得编造人名或部门。本轮不实施、不测试。

---

## G-02  Prompt、Model、Tool、Agent、Experiment 版本的真实来源

- **依赖决策：** D-05 原则已 `APPROVED`（「只使用真实运行时版本快照，不可证字段标为 UNVERIFIED。」）；采集范围仍受已批准的 D-01、D-03 原则约束。建议的 Phase 1 纳入/排除清单**未经本次签署**。  
- **当前状态：** `unblocked_for_later_closure`（可按「真实快照 + 不可证标 UNVERIFIED」规划后续取证）+ `partial_source_verified`（部分字段已有 runtime 对象，部分仍为 `UNVERIFIED`）。**未关闭。**  
- **所需证据：** 每个拟纳入字段仍须给出真实来源、采集位置、是否执行时快照、是否可伪造、缺失行为。不得用 latest/default/`rule-v2` 回填。若要将建议排除清单升级为契约，须另获确认；在此之前，只可将不可证字段标为 `UNVERIFIED`，不得把建议排除当作已批准范围。  
- **既有发现位置：** `VERSION_SNAPSHOT_SOURCE_EVIDENCE.md`（仍为先前审查，不是已关闭证据）。  
- **日后可接受的证据形态：** 不变。对照测试与负例尚未执行。本轮不实施、不测试。

---

## G-03  API 请求体上限、限流维度、未知字段处理和身份校验

- **依赖决策：** D-06 原则已 `APPROVED`（「明确正式 API、安全限制与字段策略；64 KiB 等数字另确认。」）；身份校验同时依赖已批准的 D-02 / D-03 原则。  
- **当前状态：** `unblocked_for_later_closure`（正式 API、安全限制与字段策略原则已可据以规划）+ `blocked_on_residual_owner_designation`（64 KiB、限流数值、保留期仍另确认）+ `partial_source_verified`（当前实现缺少上限、限流与服务端红化）。**未关闭。**  
- **所需证据：** 与原登记相同。数字项在 Owner 另确认之前，不得把候选值写成已批准限制，也不得用候选值宣称生产契约已生效。  
- **既有发现位置：** `TELEMETRY_API_LIMITS_DECISION.md` 及原登记所引源码。  
- **日后可接受的证据形态：** 不变。本轮不实施、不测试。

---

## G-04  WAL 故障恢复、重复投递、幂等去重和清理边界

- **依赖决策：** D-07 原则已 `APPROVED`（「OpenBot 自有、默认关闭、异步非阻塞的本地 WAL；不含并 PR #4。」）；去重契约仍依赖 D-06。A/B/C 处置未选定，合并 PR #4 **未授权**。  
- **当前状态：** `unblocked_for_later_closure`（可按 OpenBot 自有、默关、异步非阻塞原则规划日后补证）+ `blocked_on_residual_owner_designation`（A/B/C 未选定）+ `partial_source_verified`（OpenBot 出站 WAL 仍不存在；`main` 弱 WAL 会丢弃；PR #4 未合并且非断电证明）。**未关闭。**  
- **所需证据：** 与原登记相同。PR #4 单仓测试不能替代 OpenBot 出站验收，也不得解释为已获合并授权。进程崩溃测试不得表述为断电安全证明。  
- **既有发现位置：** `WAL_IMPLEMENTATION_DISPOSITION.md` 及原登记所引源码与 PR #4。  
- **日后可接受的证据形态：** 不变。本轮不实施、不测试、不合并 PR #4。

---

## G-05  OpenBot 身份注入及异步遥测隔离

- **依赖决策：** D-01、D-02、D-03、D-07 原则已 `APPROVED`。完整身份控制面仍受 G-01 残余责任人指定约束。  
- **当前状态：** `unblocked_for_later_closure`（企业范围、禁止匿名/runner、fail closed、异步非阻塞等原则已可据以规划）+ `blocked_on_residual_owner_designation`（关闭完整身份注入证据仍需 D-03 残余责任人指定）+ `partial_source_verified`（官方出站路径与隔离实现仍不存在）。**未关闭。**  
- **所需证据：** 与原登记相同。  
- **既有发现位置：** 原登记所引签署包、跨仓矩阵与 OpenBot 范围/身份源码。  
- **日后可接受的证据形态：** 不变。本轮不实施、不测试。

---

## G-06  跨仓库契约测试与 OpenBot CI 故障根因证据

### G-06a 跨仓库契约 / 验收测试

- **依赖决策：** 十四项可按已批准原则规划，但最小可执行集、是否必须真实 IdP / 真实 OpenBot runtime / Knowledge SDK 实例仍为 `PENDING_OWNER`。  
- **当前状态：** `unblocked_for_later_closure`（原则已批，日后可按已批准原文规划用例）+ `blocked_on_residual_owner_designation`（最小可执行集尚未确认）+ `open`（均未执行）。**未关闭。**  
- **所需证据 / 既有发现 / 日后形态：** 与原登记相同。单仓 CI 通过不等于跨仓验收通过。本轮未执行其中任何一项。

### G-06b OpenBot CI 故障根因

- **依赖决策：** 不替代 D-01 至 D-07 签署，也不因本次签署而关闭。  
- **当前状态：** `partial_source_verified`；根因保持 **`ROOT_CAUSE_UNKNOWN`**。**未关闭。**  
- **本轮未刷新 CI。** 仍沿用冻结确认中的事实：当前当时 HEAD `b10ad59bf6205edaa1566847cfa1685e1283c8af` 上 CI Gate [46154967209](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46154967209) failure（`delivery guard` / `Release ledger audit`，`[missing-object]`，退出码 30，2026-11-28 22:39:31 CST）；Workflow CI 等在该窗口结束时尚未全部完成。本轮不实施修复，也不根据原则获批推断根因。

---

## 汇总

| 缺口 | 已批准原则是否足以开始后期规划 | 是否仍受残余 Owner 指定阻塞 | 本轮是否关闭 |
| --- | --- | --- | --- |
| G-01 Service Identity / allowlist 运维 | 是（D-03 / D-02 原则） | 是（责任人/签发主体未指定） | **否** |
| G-02 版本字段真实来源 | 是（D-05 原则） | 建议纳入/排除清单未签署；不阻止按 UNVERIFIED 原则规划 | **否** |
| G-03 API 限制与身份校验 | 是（D-06 等原则） | 是（64 KiB、限流、保留期另确认） | **否** |
| G-04 WAL 恢复与去重边界 | 是（D-07 原则；不含并 PR #4） | 是（A/B/C 未选定） | **否** |
| G-05 身份注入与异步隔离 | 是（D-01 / D-02 / D-03 / D-07 原则） | 部分是（完整身份控制面依赖 G-01 残余指定） | **否** |
| G-06a 跨仓契约测试 | 是（可按已批原则规划） | 是（最小可执行集未确认）；且均未执行 | **否** |
| G-06b OpenBot CI 根因 | 不适用 | 根因 `ROOT_CAUSE_UNKNOWN` | **否** |

**结论：** 七条原则已批准，故部分缺口现可在日后针对已批准原文规划补证；但没有任何阻塞性技术证据在本轮被关闭。补证实施与测试须另获授权后再进行。
