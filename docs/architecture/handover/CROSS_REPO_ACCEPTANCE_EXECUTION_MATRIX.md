# CROSS_REPO_ACCEPTANCE_EXECUTION_MATRIX.md

> 跨仓库验收执行矩阵（T6）。  
> 核验窗口：2026-11-28 21:43–21:50 CST（Asia/Shanghai）。  
> 基线：`ai-optimization@16b01d99d33b386102bb9b2b248558eb5517e245`，`openbot-vp@b4e106de7562ce62d2e62057ba16864ec12a2645`，`knowledge-sdk@b953c9922cc1096e0e88455dab6746c01a9d27f9`。PR #4–#10 均开放未合并。  
> **单仓 CI 通过不等于跨仓验收通过。不得把 Mock 测试描述为生产集成验收。生产准入关闭。**  
> 本矩阵是可执行草案，**不是**已批准方案，**全部用例均尚未执行**。

前置条件总体状态：官方出站路径未实现；Service Identity 签发与 allowlist 控制面未落地；D-01–D-07 未签署；OpenBot 当前 `main` `b4e106de` 的 CI Gate 已 failure；Workflow CI 在本轮核验结束时仍 in_progress，但已有多项失败 job，不得称为通过。因此本矩阵目前**不具备启动 L2 的完整前置条件**。最小可启动集仍待 Owner 确认（`OWNER_DECISION_PENDING`）。

测试分层：

- L1 Mock / 契约：不能称为跨仓集成通过。
- L2 真实 OpenBot 出站路径 + 真实 AI Optimization 入库（非生产）+ 测试身份：跨仓集成的最低可信层。
- L3 非生产真实 IdP：仅在签发责任与测试租户获批后进行。仍不是生产验收。
- 生产验收：关闭，直至 Owner 另行开放。

---

## 1. 十四项执行矩阵

| # | 场景 | 测试所在仓库 | 前置条件 | 测试数据（建议，不得编造生产 Tenant） | 预期结果 | 证据位置（计划） | 真实 IdP | 真实 OpenBot runtime | Knowledge SDK 实例 | 是否已执行 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 有效 Service Identity | 出站：`openbot-vp`；入库：`ai-optimization`；编排可在独立验收仓或任一侧 CI 的跨仓 job（待定） | D-02/D-03 签署；签发测试身份的权威源；官方出站开关可在非生产打开 | 非生产测试租户的有效服务凭证；事件 `tenantId`/`sub` 与 token 一致；合法 agentId | 202 接受（或幂等 202）；入库记录租户与主体正确 | 入库记录、审计、HTTP 响应；出站日志不得含私钥 | L1 可用测试 JWT；L3 才用非生产真实 IdP | L2 起需要真实出站路径 | 否（本项不测知识） | **否** |
| 2 | 无效或过期 Identity | 同上 | 同上的验签实现 | 缺 Bearer、格式错误、错误签名、过期、nbf 未到、错误 iss/aud | 401 或按签批码拒绝；**不入库**；不得降级 anonymous | HTTP 响应与入库查询（零新增） | L1 可用伪造/过期夹具；不必真实 IdP | L2 需要真实出站失败路径也可在入库单测先行，但官方验收以出站+入库为准 | 否 | **否** |
| 3 | Agent allowlist 命中与拒绝 | 同上，外加控制面所在仓（拟定 `ai-optimization`，待签批） | 控制面已实现；责任人与权威源已指定 | 同一 Identity：名单内 agentId 与名单外 / 已禁用 agentId | 命中：可接受运行时事件；拒绝：403（或签批失败码），不入库 | allowlist 变更审计 + 入库结果 | 不必一开始就真实 IdP，但绑定数据必须来自被测权威源 | L2 需要真实出站 agentId | 否 | **否** |
| 4 | Tenant 越权拒绝 | `ai-optimization` 入库 + `openbot-vp` 出站负例 | 已验证认证上下文 | token.tenantId=A，事件或目标租户=B；或用个人范围对象尝试写入企业桶 | 403 `tenant_mismatch` 或出站侧直接拒绝；不串桶；不虚构 Personal Tenant | 两侧审计与数据库租户查询 | 测试 JWT 即可证明隔离骨架 | 必须使用真实 `TrustedScope` 构造路径做 L2 | 否 | **否** |
| 5 | W3C Trace Context 传递 | `openbot-vp` 出站构造；`ai-optimization` 校验 | D-04 签署；出站实现 | 合法 `traceparent`；非法/缺失 `traceparent` | 合法：`traceContext.traceId` 等于其 trace-id；非法/缺失：本地生成 + generated 标记，不转发非法值；Trace ID 不能当幂等键 | 事件字段与标记；负例响应 | 不需要 | L2 需要真实出站构造 | 否 | **否** |
| 6 | Version Snapshot 来源真实性 | `openbot-vp` 必须用真实证据对象；契约检查可在 `ai-optimization` | D-05 签署；纳入/排除清单确认 | 含 `ModelCallEvidence` / `toolObservations` / `TaskOutcomeRecord` 的真实运行夹具；人为去掉某版本来源；企图用 latest/`rule-v2` 回填的负例 | 事件字段与该次证据一致；缺失不填 latest；排除字段不出站；负例失败 | 运行证据对象与出站事件对照 | 不需要 | **必须**真实 OpenBot 证据对象，不能只用手工 JSON 冒充采集 | 否 | **否** |
| 7 | Telemetry 异步投递 | `openbot-vp` | D-07 签署；缓冲已实现且默认关闭可被测试配置打开 | 阻塞或延迟的入库桩 | 主执行链在超时预算内完成任务成功/失败判定；投递在后台进行 | 主链耗时、出站队列、对端收到事件的时间序 | 不需要 | **必须**真实运行时主链，而不是只测 HTTP 客户端 | 否 | **否** |
| 8 | AI Optimization 不可用时 OpenBot 执行不受影响 | `openbot-vp` | D-07；故障隔离实现 | 对端 5xx、超时、断连、证书错误、完全不可达 | Agent 执行、Readiness、Control Plane 不受同步阻塞；缓冲按规则重试或记录失败 | 主链结果、故障注入日志 | 不需要 | **必须**真实主链 | 否 | **否** |
| 9 | WAL 重试与幂等去重 | 出站 `openbot-vp` + 入库 `ai-optimization` | D-06/D-07；缓冲与 UNIQUE 契约 | SIGKILL 于确认前；同一 Tenant+Key 重放；不同 Tenant 同键；以 Trace ID 为键的负例 | 重启后至少一次重放；接收端不双写；跨租户不串桶；Trace ID 作键被拒 | WAL 文件、入库行数、响应码 | 不需要 | 必须真实缓冲文件与进程杀死；不得用 PR #4 测试代替 | 否 | **否** |
| 10 | Personal / Enterprise 隔离 | `openbot-vp` 过滤 + `ai-optimization` 负例入库 | D-01 签署 | 个人 `TrustedScope`（无 tenantId）；企业范围；尝试把个人反馈/日志/引用/附件写入企业事件 | 个人第一期不出站；不得虚构 tenantId；企业桶不出现个人内容或间接关联 | 出站事件集合与入库查询 | 不需要真实 IdP 即可测过滤 | **必须**真实 chat-entry / runner 范围进入出站路径 | 若测引用/知识片段，见第 11 项 | **否** |
| 11 | Knowledge SDK ACL 最终授权 | `knowledge-sdk` 自身 ACL + `openbot-vp` 调用链（若触及检索） | Knowledge Core 职责不变；Adapter 不得成为 ACL 旁路 | 跨租户、跨 space、`personal_only` ACL、`tenant_mismatch` 夹具（SDK 本地/测试库，非生产数据） | 未授权知识不得经遥测管道读写；检索命中须经 `permissions/engine.py` 最终判定（如 `tenant_mismatch`、`document_acl_denied`、`space_boundary_denied`） | SDK 决策理由 + 出站 payload 不含未授权原文 | 若知识 ACL 依赖组织身份，L3 才引入相应测试身份 | 若测试「Agent 运行触及知识检索」，需要真实调用链 | **L2 需要真实 knowledge-sdk 源码或已发布包**，不能伪造 ACL 通过 | **否** |
| 12 | TaskOutcome 唯一 runtime outcome authority | `openbot-vp` 写入路径 + `ai-optimization` 消费路径 | 既有章程；Adapter 只读副本 | 一次真实 TaskOutcome 写入；遥测副本；企图从评价仓回写或建立第二 ledger 的负例 | OpenBot 仍是唯一结果权威；纠正路径仍走 OpenBot；对端无回写生产结果的 API 被调用 | TaskOutcome 存储与对端审计 | 不需要 | **必须**真实 TaskOutcome 写入路径 | 否 | **否** |
| 13 | Evolution Control 唯一 rollout/canary/rollback authority | `openbot-vp`（`packages/evolution-core`、`src/gateway/server-methods/evolution-control.ts`） | 既有章程；Adapter 不得绕过绑定 | 绑定前后的 `experimentId`；企图用调用方自报 ID 或遥测/评价结果直接改变生产策略 | 只有绑定后的值可出站；发布/回滚仍只经 Evolution Control；Adapter 无旁路调用 | Evolution 状态机记录与出站事件 | 通常不需要 | **必须**真实 Evolution Control 状态机（非生产） | 否 | **否** |
| 14 | 事件撤销、身份撤销和已接收事件保留 | `ai-optimization` 控制面 + 入库；出站负例在 `openbot-vp` | D-03 签署；撤销机制落地 | 先接受合法事件；再撤销 Identity 或 allowlist；再发送新事件；业务对象 `artifact.revoked`（若在范围内）与身份撤销分开构造 | 新事件立即拒绝；已接收事件仍在、不自动删除；两类撤销不互相替代 | 入库快照（撤销前后）、拒绝审计 | 测试身份即可；L3 可选 | L2 需要真实出站再拒绝 | 否 | **否** |

---

## 2. Knowledge SDK 边界（本轮复核，不扩展 Wave2）

`knowledge-sdk@b953c99` 仍为边界范围（`GITHUB_VERIFIED` / `SOURCE_VERIFIED`）：

- 核心包 `docs/ui-workbench.md` 第 3–5 行：核心包 `dependencies = []`，无产品侧 telemetry 或模型启动。
- 最终授权位于 `src/knowledge_sdk/permissions/engine.py`：租户边界不可被规则或 owner/admin 授权覆盖（`tenant_mismatch`，第 79–81 行）；另有 `space_boundary_denied`、`document_acl_denied`；`personal_only` ACL 不能被宽规则打开（第 121–131 行）。
- Space / ACL 模型见 `src/knowledge_sdk/contracts/models.py`（`space_type`、`DocumentACL`、`citations` / `evidence_hits`）。
- Wave2 SHA `9940818b…` 仍不在本阶段范围。

不得用 Workbench demo 声称产品侧遥测已隔离。

---

## 3. 明确不能当作通过条件的证据

1. `ai-optimization` 单仓 CI success（含 PR #4–#10 的 docs/`verify`，包括 PR #9 CI 46140138029 与 PR #10 CI 46145083123 success）。
2. `knowledge-sdk` 单仓测试通过。
3. `openbot-vp` 任一局部 workflow success（Install Smoke、Workflow Sanity、CI Canary 等）或「部分 job 绿」。
4. 当前 OpenBot CI Gate **失败**，Workflow CI **尚未结束且已有失败 job**，更不得解释为平台已绿。
5. PR #4 WAL 集成测试通过（测的是未合并 SDK，不是 OpenBot 出站缓冲）。
6. 仅 Mock 的契约测试全绿。
7. 设计评审、决策登记、收口文档或本矩阵本身。

---

## 4. 生产准入与启动资格

在 D-01–D-07 书面签署、身份撤销机制落地、版本字段纳入/排除确认、API 数字批准、WAL 处置确认，以及 Owner 批准的最小 L2 集（其中第 10、11、12、13 项不得用纯 Mock 替代）完成之前：

- 跨仓验收 **未开始、未通过**。
- 生产准入 **关闭**。
- 本矩阵具备「写清了如何执行」的草稿完备性，但**尚不具备全部可执行前置条件**。

**当前结论：** 方案待 Owner 确认；14 项均未执行；不得进入实施编码或生产。
