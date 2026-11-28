# 跨仓最小验收矩阵建议

> 工作包 A4。十四项测试矩阵的最小可执行集**建议**，供 Owner 确认。  
> 正式状态：`OWNER_DECISION_PENDING`。本建议 **不是** 已批准矩阵，14 项 **均未执行**。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> 基线：`ai-optimization@16b01d99d33b386102bb9b2b248558eb5517e245`，`openbot-vp@73013587e3a5ccd96a0d0c284f7223199d39ed75`，`knowledge-sdk@b953c9922cc1096e0e88455dab6746c01a9d27f9`。  
> 单仓 CI 通过不等于跨仓验收通过。不得把 Mock 测试描述为生产集成验收。生产准入关闭。

本阶段只准备计划。新的实现、测试执行或跨仓运行须等待单独授权。官方出站路径、Service Identity 控制面与多项残余数字 / 责任指定尚未落地，因此本矩阵目前**不具备启动 L2 的完整前置条件**。

测试分层：

- L1 Mock / 契约：不能称为跨仓集成通过。
- L2 真实 OpenBot 出站路径 + 真实 AI Optimization 入库（非生产）+ 测试身份：跨仓集成的最低可信层。
- L3 非生产真实 IdP：仅在签发责任与测试租户获批后进行。仍不是生产验收。
- 生产验收：关闭，直至 Owner 另行开放。

---

## 1. 建议的最小可执行集（`RECOMMENDATION`，待确认）

建议将十四项分为三档。Owner 可增删，但下列「不可用纯 Mock 替代」的项若被移出最小集，应在决定中显式记录。

| 档 | 项 | 建议角色 | 说明 |
| --- | --- | --- | --- |
| **最小 L2 核心集（建议必须纳入首次跨仓验收）** | 1、2、4、7、8、10、12 | 构成「能证明官方身份、隔离、异步与权威边界」的最小可信集 | 第 10、12 项不得用纯 Mock 替代（沿用先前矩阵约束，仍待 Owner 确认） |
| **控制面与契约配套（建议与核心集同一波，但被 R-08–R-16 / R-01–R-07 阻塞）** | 3、5、6、9、14 | 无 allowlist / 撤销 / 版本清单 / WAL 处置 / API 数字，则无法给出可执行的通过标准 | 可在 Owner 完成对应残余决定并授权实现后纳入同一 L2 波次 |
| **有条件纳入** | 11、13 | 第 11 项仅当官方出站路径会触及知识检索或可能携带知识片段时纳入；第 13 项仅当 Phase 1 官方事件包含 Evolution 绑定后的 `experimentId` 时纳入 | 第 11、13 项一旦纳入，不得用纯 Mock 替代。若不纳入，必须在最小集决定中写明「本波排除」及排除理由 |

建议：**不要**用「先跑完 14 项 L1」宣称跨仓通过。L1 只可用于实现期回归，不能关闭 G-06 的跨仓契约验收缺口。

是否必须真实 IdP：建议最小 L2 核心集允许使用**非生产测试 JWT / 测试签发器**（不是生产 IdP，也不是把 `https://auth.openbot.love` 夹具当成活 IdP）。L3 真实 IdP 在 R-08 指定签发系统并授权测试租户之前 **不应**启动。该分层本身待 Owner 确认。

---

## 2. 十四项执行矩阵（更新基线后的建议稿）

「真实 IdP / 真实 OpenBot runtime / 真实 Knowledge SDK」列为建议值，待 R-16 确认。证据位置均为计划，不是已采集证据。

| # | 场景 | 责任仓 | 前置条件 | 建议：真实 IdP | 建议：真实 OpenBot runtime | 建议：真实 Knowledge SDK 实例 | 证据形式（计划） | 通过标准（建议） | 已执行 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 有效 Service Identity | 出站：`openbot-vp`；入库：`ai-optimization`；编排仓待定 | D-02/D-03 原则；R-08 测试签发源；官方出站开关可在非生产打开 | L2 可用测试签发器；L3 才用非生产真实 IdP | L2 起需要真实出站路径 | 否（本项不测知识） | 入库记录、审计、HTTP 响应；出站日志不得含私钥 | 202 接受（或幂等 202）；入库租户与主体正确；不得降级匿名 | **否** |
| 2 | 无效或过期 Identity | 同上 | 验签实现已按 fail-closed 落地 | L1/L2 可用伪造或过期夹具，不必真实 IdP | L2 以出站+入库为准；入库单测不可单独关闭本项 | 否 | HTTP 响应与入库查询（零新增） | 401 或按签批码拒绝；**不入库**；不得降级 anonymous / runner | **否** |
| 3 | Agent allowlist 命中与拒绝 | 同上，外加控制面所在仓（拟定 `ai-optimization`，待签批） | R-12 责任人已指定；控制面已实现 | 不必一开始就真实 IdP，但绑定数据必须来自被测权威源 | L2 需要真实出站 agentId；禁止把 `normalizeAgentId` 回退 `"main"` 当成命中 | 否 | allowlist 变更审计 + 入库结果 | 名单内可接受；名单外 / 已禁用：403（或签批失败码），不入库 | **否** |
| 4 | Tenant 越权拒绝 | `ai-optimization` 入库 + `openbot-vp` 出站负例 | 已验证认证上下文 | 测试 JWT 即可证明隔离骨架 | L2 必须使用真实 `TrustedScope` 构造路径 | 否 | 两侧审计与数据库租户查询 | 403 `tenant_mismatch` 或出站侧直接拒绝；不串桶；不虚构 Personal Tenant | **否** |
| 5 | W3C Trace Context 传递 | `openbot-vp` 出站构造；`ai-optimization` 校验 | D-04 原则；出站实现；generated 标记细则可在实现时按获批字段落地 | 不需要 | L2 需要真实出站构造。当前源码无 `traceparent`（见 G-02） | 否 | 事件字段与标记；负例响应 | 合法：`traceContext.traceId` 等于其 trace-id；非法/缺失：本地生成 + generated 标记，不转发非法值；Trace ID 不能当幂等键 | **否** |
| 6 | Version Snapshot 来源真实性 | `openbot-vp` 必须用真实证据对象；契约检查可在 `ai-optimization` | D-05 原则；R-18 纳入/排除清单确认 | 不需要 | **必须**真实 OpenBot 证据对象，不能只用手工 JSON 冒充采集 | 否 | 运行证据对象与出站事件对照 | 事件字段与该次证据一致；缺失不填 latest / 不填 `rule-v2`；排除字段不出站；不可证字段标 UNVERIFIED | **否** |
| 7 | Telemetry 异步投递 | `openbot-vp` | D-07；官方缓冲已实现且默认关闭可被测试配置打开 | 不需要 | **必须**真实运行时主链，而不是只测 HTTP 客户端 | 否 | 主链耗时、出站队列、对端收到事件的时间序 | 主执行链在超时预算内完成任务成功/失败判定；投递在后台进行 | **否** |
| 8 | AI Optimization 不可用时 OpenBot 执行不受影响 | `openbot-vp` | D-07；故障隔离实现 | 不需要 | **必须**真实主链 | 否 | 主链结果、故障注入日志 | 对端 5xx、超时、断连、证书错误、完全不可达时，Agent 执行、Readiness、Control Plane 不受同步阻塞 | **否** |
| 9 | WAL 重试与幂等去重 | 出站 `openbot-vp` + 入库 `ai-optimization` | D-06/D-07；R-15 WAL 处置；R-05/R-06 幂等规则；缓冲与 UNIQUE 契约 | 不需要 | 必须真实缓冲文件与进程杀死；**不得**用 PR #4 测试代替 | 否 | WAL 文件、入库行数、响应码 | 重启后至少一次重放；接收端不双写；跨租户不串桶；Trace ID 作键被拒；不得宣称 exactly-once 或断电安全 | **否** |
| 10 | Personal / Enterprise 隔离 | `openbot-vp` 过滤 + `ai-optimization` 负例入库 | D-01 | 不需要真实 IdP 即可测过滤 | **必须**真实 chat-entry / runner 范围进入出站路径 | 若测引用/知识片段，见第 11 项 | 出站事件集合与入库查询 | 个人第一期不出站；不得虚构 tenantId；企业桶不出现个人内容或间接关联 | **否** |
| 11 | Knowledge SDK ACL 最终授权 | `knowledge-sdk` 自身 ACL + `openbot-vp` 调用链（若触及检索） | Knowledge Core 职责不变；Adapter 不得成为 ACL 旁路 | 若知识 ACL 依赖组织身份，L3 才引入相应测试身份 | 若测试「Agent 运行触及知识检索」，需要真实调用链 | **L2 需要真实 knowledge-sdk 源码或已发布包（`b953c99` 边界），不能伪造 ACL 通过**。Wave2 `9940818b…` 与 knowledge-sdk [PR #1](https://github.com/flykingvip-cloud/knowledge-sdk/pull/1) 仍不在本阶段范围 | SDK 决策理由 + 出站 payload 不含未授权原文 | 未授权知识不得经遥测管道读写；检索命中须经 `permissions/engine.py` 最终判定（如 `tenant_mismatch` 第 81 行、`document_acl_denied` 第 131 行、`space_boundary_denied`、`personal_only` 第 127 行） | **否** |
| 12 | TaskOutcome 唯一 runtime outcome authority | `openbot-vp` 写入路径 + `ai-optimization` 消费路径 | 既有章程；Adapter 只读副本 | 不需要 | **必须**真实 TaskOutcome 写入路径 | 否 | TaskOutcome 存储与对端审计 | OpenBot 仍是唯一结果权威；纠正路径仍走 OpenBot；对端无回写生产结果的 API 被调用 | **否** |
| 13 | Evolution Control 唯一 rollout/canary/rollback authority | `openbot-vp`（`packages/evolution-core`、`src/gateway/agent-growth/evolution-task-outcomes.ts`、`src/gateway/evolution-control/task-outcome-binding.ts`） | 既有章程；Adapter 不得绕过绑定 | 通常不需要 | **必须**真实 Evolution Control 状态机（非生产） | 否 | Evolution 状态机记录与出站事件 | 只有绑定后的值可出站；调用方自报 `experimentId` 不可采信；发布/回滚仍只经 Evolution Control | **否** |
| 14 | 事件撤销、身份撤销和已接收事件保留 | `ai-optimization` 控制面 + 入库；出站负例在 `openbot-vp` | D-03；R-11/R-12 撤销责任；撤销机制落地 | 测试身份即可；L3 可选 | L2 需要真实出站再拒绝 | 否 | 入库快照（撤销前后）、拒绝审计 | 新事件立即拒绝；已接收事件仍在、不自动删除；身份撤销与 `artifact.revoked` 不互相替代 | **否** |

---

## 3. Knowledge SDK 边界（本轮复核，不扩展 Wave2）

`knowledge-sdk@b953c9922cc1096e0e88455dab6746c01a9d27f9` 仍为边界范围（`GITHUB_VERIFIED` / `SOURCE_VERIFIED`）：

- `origin/main` 提交未变。仓库 `pushed_at` 2026-11-28 23:19:50 CST 对应新开的 [PR #1](https://github.com/flykingvip-cloud/knowledge-sdk/pull/1)（Wave-V21-8 Draft / DO NOT MERGE，HEAD `c05527f9…`），**不在**本阶段范围，也不得当作 main 漂移。
- Wave2 SHA `9940818b962ccb186c0dfb0158de6bd9bd49057b` 仍不在本阶段范围。
- 最终授权位于 `src/knowledge_sdk/permissions/engine.py`：租户边界不可被规则或 owner/admin 授权覆盖（`tenant_mismatch`，第 81 行）；另有 `space_boundary_denied`、`document_acl_denied`（第 131 行）；`personal_only` ACL 不能被宽规则打开（第 127 行）。本轮已按 `origin/main` 复核行号。

不得用 Workbench demo 声称产品侧遥测已隔离。不得把 Knowledge SDK PR 或 Wave2 分支当作本阶段验收依赖。

---

## 4. 明确不能当作通过条件的证据

1. `ai-optimization` 单仓 CI success（含 PR #4–#11 的 docs/`verify`，包括 PR #11 [verify 46157316635](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46157316635) success，完成 2026-11-28 22:58:19 CST）。
2. `knowledge-sdk` 单仓测试通过或 PR #1 存在。
3. `openbot-vp` 任一局部 workflow success（本轮当前 `main` 上 Workflow Sanity [46159070274](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159070274) success、Install Smoke [46159069950](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069950) success）。Install Smoke / Workflow Sanity / CI Canary success ≠ 整仓 CI 绿。
4. 当前 OpenBot CI Gate **失败**（见 G-06）；Workflow CI 在 23:41:30 CST 刷新时已完成并标为 **failure**（[46159069913](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069913)，23:38:13 CST）；Docker Release **cancelled**（[46159069924](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069924)，23:38:57 CST）。Install Smoke / Workflow Sanity 局部成功更不得解释为平台已绿。
5. PR #4 WAL 集成测试通过（测的是未合并 SDK，不是 OpenBot 出站缓冲）。
6. 仅 Mock 的契约测试全绿。
7. 设计评审、决策登记、收口文档、本建议矩阵或 Implementation Plan 草案本身。

**当前结论：** 最小集建议已写出；须 Owner 确认（`OWNER_DECISION_PENDING`）。14 项均未执行；不得进入实施编码或生产。
