# CROSS_REPO_TELEMETRY_ACCEPTANCE_PLAN.md

> 跨仓集成测试矩阵与生产准入门槛（决策收口，不实施）。  
> **不得把单仓 CI 通过等同于跨仓验收通过。不得把 Mock 测试描述为生产集成验收。生产准入关闭。**  
> 本计划是可审议的建议，**不是**已批准的验收方案（总报 O-08 仍为 `PENDING_OWNER`）。  
> 核验窗口：2026-11-28 19:19–19:23 CST。  
> 基线：`ai-optimization@16b01d99d33b386102bb9b2b248558eb5517e245`，`openbot-vp@13763b2d85c6ca72d3bf5b10acb1825457776ff6`，`knowledge-sdk@b953c9922cc1096e0e88455dab6746c01a9d27f9`。PR #4–#8 仍开放未合并。

---

## 1. 证据与范围

| 类别 | 说明 |
| --- | --- |
| GitHub 已验证事实 | 三仓 SHA、PR 状态、各仓 CI。OpenBot `main` CI Gate 在当前 SHA 上为 failure；Workflow CI 核验时仍 in_progress 且已有多个失败 job。AI Optimization `main` CI success、Knowledge SDK `main` tests success，**只证明各自动作在该 SHA 上的单仓结果**。 |
| 源码验证事实 | 职责边界见 `ai-optimization` `docs/architecture/SYSTEM_BOUNDARIES.md` 4–10 行；Knowledge SDK `docs/ui-workbench.md` 声明核心包无产品遥测启动。 |
| 待 Owner 决策 | 哪些用例必须真实 IdP、哪一阶段允许用 Mock 先行；本矩阵的最小可启动集。 |
| 尚未验证的假设 | 生产网络路径、生产 IdP 声明映射、运行时版本字段补证结果。本轮未接入真实 IdP，未写生产遥测，未部署。 |

测试分层建议：

- **L1 Mock / 契约测试：** 可用模拟 IdP、模拟 HTTP、固定夹具。可在单仓或契约仓库运行。**不能**称为跨仓集成通过。
- **L2 真实 OpenBot 源码 + 测试 IdP 或夹具密钥：** 需要 `openbot-vp` 真实出站路径（待实施后）与 `ai-optimization` 真实入库实现，环境非生产。这是跨仓集成的最低可信层。
- **L3 真实 IdP（非生产）：** 仅在签发责任与测试租户获批后进行。仍不是生产验收。
- **生产验收：** 本阶段及在 Owner 关闭全部阻塞之前均为 **关闭**。即使 L2/L3 通过，也不自动打开。

---

## 2. 十二项测试矩阵

| # | 场景 | 目的 / 验收标准 | 是否需要真实 OpenBot 源码 | 是否需要真实 IdP | 是否可用 Mock | 与生产准入的关系 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | OpenBot 身份注入与 Service Identity | 出站请求携带已验证 Service Identity；token 的 `tenantId`/`sub`/`principalType` 与事件一致；无凭证或错误凭证不得成功入库 | **L2 起需要**真实出站路径 | L1 可用测试密钥 / 模拟签发；**L3 才用非生产真实 IdP**。生产 IdP 不在本阶段 | L1 可用 Mock 签发与验签夹具，只测契约 | 未做 L2+L3 不得宣称生产身份已通 |
| 2 | Agent Allowlist 授权与撤销 | 绑定存在则运行时事件可接受；禁用 / 删除 / 迁移后新事件立即 403（或签批的失败码）；已接收事件仍在 | L2 需要真实出站 agentId 与入库校验（控制面落地后） | 可用测试身份；不必一开始就真实 IdP，但绑定数据必须来自被测权威源而非双方各写各的假名单 | L1 可用内存名单测拒绝/允许逻辑，不能代替控制面集成 | 生产启用前必须有非生产 L2 撤销试验 |
| 3 | W3C Trace Context 传播 | 合法 `traceparent` 被传播，`traceContext.traceId` 等于其 trace-id；非法或缺失则本地生成并标记 `generated`，不转发非法值 | L2 需要真实出站构造 | 不需要 | L1 可测解析与生成纯函数 | 生产不得使用未标记的随机非 W3C 值；本项通过不等于生产打开 |
| 4 | Version Snapshot 真实性 | 事件版本与该次运行证据一致；缺失不填 latest；UNVERIFIED 字段按契约省略。若来源仍 UNVERIFIED，本项只能先测「禁止伪造」，不能测「完整映射已实现」 | **L2 必须**用真实 OpenBot 证据对象，不能只用手工 JSON | 不需要 | Mock 只能测负例（禁止回填），不能证明采集真实 | 字段来源未补证前，本项不得标为生产就绪 |
| 5 | OpenBot 异步 WAL | 默认关闭；主链不等待网络；崩溃恢复 at-least-once；未确认事件不被静默淘汰；非 Linux 锁行为符合文档 | **必须真实 OpenBot 缓冲实现后的源码级故障注入**（SIGKILL、磁盘错误）。不得用 AI Optimization PR #4 测试代替 | 不需要 | 传输层可用 Mock HTTP。WAL 文件与进程杀死不可用「纯内存 mock」冒充崩溃恢复 | 无真实故障注入不得宣称生产缓冲可靠；即便通过也不得宣称断电耐久 |
| 6 | AI Optimization Telemetry API | POST 契约：认证、tenant 匹配、红化、幂等、未知字段不落库、体上限整体拒绝 | 出站侧 L2 用真实客户端；入库侧必须用真实 `http-api` / ingestion 实现，而不是只测 OpenAPI 文本 | L1/L2 可用测试 JWT；L3 再用非生产 IdP | Mock 网关只能做客户端单测 | 单仓 `ai-optimization` CI success 不等于本项通过 |
| 7 | 429、超时、5xx、网络中断 | 入库按签批规则返回；出站重试不阻塞主链；429 尊重 Retry-After（若获批） | L2 需要真实出站缓冲 | 不需要 | 可用对端桩制造 429/5xx/断连；不可把桩当作生产网关已配置限流的证据 | 生产限流值未批前，本项只证明行为骨架 |
| 8 | 重复事件与幂等去重 | 同一 Tenant + Idempotency Key 重放不双写；不同 Tenant 同键不串桶；Trace ID 不能当幂等键 | L2 两端都要用真实实现 | 不需要（可用测试令牌） | L1 可测 DB UNIQUE，不能代替跨进程重放 | 是生产前必要项，但单独通过不能打开生产 |
| 9 | Personal / Enterprise 跨 Scope 隔离 | 个人范围第一期不出站；不得虚构 tenantId；个人反馈 / 日志 / 引用 / 附件不进入企业桶 | **必须真实 OpenBot 范围对象**（`TrustedScope` 构建路径） | 不需要真实 IdP 即可测过滤；若测 User 反馈，则按第 1 项分层 | Mock 可测过滤器纯函数，但不能代替真实 chat-entry / runner 范围进入出站路径的集成 | 隔离失败则生产准入保持关闭 |
| 10 | Knowledge SDK 权限边界不被绕过 | Adapter 不得向 Knowledge Core 写入或读取未授权知识，不得让遥测管道成为知识 ACL 旁路；SDK 仍是独立知识职责 | 若测试「Agent 运行触及知识检索」，需要真实 OpenBot 调用链 + **真实 knowledge-sdk 源码或已发布包**，而不是伪造 ACL 通过 | 若知识 ACL 依赖组织身份，L3 才引入相应测试身份；本轮禁止接生产 | 可用本地 demo / 夹具测 SDK 自身 ACL（SDK 仓已有边界说明），**不能**用 Workbench demo 声称产品侧遥测已隔离 | 任何绕过都阻塞生产；本项未测不得打开生产 |
| 11 | TaskOutcome 仍是唯一 Runtime Outcome Authority | 遥测副本与评价消费不得回写 OpenBot 结果权威；纠正路径仍走 OpenBot；不出现第二套 Run Ledger | **必须真实 TaskOutcome 写入路径与 Adapter 只读副本路径对照** | 不需要 | Mock 可测「对端无回写 API 被调用」，但不能代替真实进程级断言 | 违反则永久阻塞生产。单仓文档审查不够 |
| 12 | Evolution Control 的 Canary / Rollback 不被 Adapter 绕过 | 实验绑定、发布与回滚仍只经 Evolution Control；Adapter 不得因遥测或评价结果直接改变生产策略或绕过审批 | **必须真实 Evolution Control 状态机**（至少非生产，使用 OpenBot 源码） | 通常不需要 | Mock 只能测 Adapter 没有调用被禁接口；状态机本身必须用真实实现做 L2 | 违反则阻塞生产。评价仓单测通过不够 |

---

## 3. 明确不能当作通过条件的证据

1. `ai-optimization` 单仓 CI success（含 PR #4–#8 的 docs/`verify`）。
2. `knowledge-sdk` 单仓 tests success。
3. `openbot-vp` 任一 workflow success（Install Smoke、Workflow Sanity 等）或「部分 job 绿」。
4. 当前 OpenBot CI Gate / CI **失败或未结束**，更不得解释为平台已绿。
5. PR #4 WAL 的集成测试通过（测试的是未合并的 AI Optimization SDK，不是 OpenBot 出站缓冲）。
6. 仅 Mock 的契约测试套件全绿。
7. 设计评审、决策登记建议稿、本收口文档本身。

---

## 4. 生产准入门槛（全部关闭，直至 Owner 另行开放）

在以下条件全部满足之前，生产准入保持关闭：

- D-01–D-07 已有正式书面 `APPROVED`（或等效签批），而不仅是本阶段指令中的「固化」方向。
- 身份与 Allowlist 责任人已指定，控制面已实现并经 L2 撤销试验。
- 版本字段来源已补证或已被正式排除，真实性测试通过。
- API 上限与限流已有批准值，并在非生产环境按批准值验证。
- OpenBot 缓冲按本包 WAL 文档完成故障注入（仍不自动等于断电证明）。
- 上表 12 项至少完成 Owner 批准的最小 L2 集，其中 9、10、11、12 不得用纯 Mock 替代。
- 不使用生产 IdP、生产数据库或生产遥测通道做试验，除非有单独的生产变更授权（本阶段明确禁止）。

**当前结论：** 跨仓验收方案已写成可执行矩阵，但方案本身待 Owner 确认（O-08）。状态 = **PENDING_OWNER**。不具备生产准入。不具备开始编码的条件。在身份责任、版本来源与本方案签批闭环前，也不具备编写 Adapter Implementation Plan 的条件。
