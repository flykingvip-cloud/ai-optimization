# 残余 Owner 决策表

> 工作包 A 总表。仅准备决策材料，**不代 Owner 作出决定**。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> 权威决策基线：Owner Decision Record SHA `0fe6247fa4247e8c6053e5b7df888ee061c63886`（[PR #11](https://github.com/flykingvip-cloud/ai-optimization/pull/11)，分支 `docs/owner-decision-record`，保持 `OPEN`）。  
> 正式状态只允许：`APPROVED` / `REJECTED` / `PENDING_OWNER` / `NOT_IN_SCOPE`。  
> 候选值、建议稿、设计承诺与单仓 CI 成功 **一律不得**标为 `APPROVED`。

正式状态定义：

- `APPROVED`：有明确 Owner 的明确批准记录，且范围以已批准原文为限。
- `REJECTED`：有明确 Owner 的明确否决记录。
- `PENDING_OWNER`：尚无正式决定。
- `NOT_IN_SCOPE`：经 Owner 明确确认不属于当前阶段。

结论标签（每项结论恰好使用一个）：`GITHUB_VERIFIED` / `SOURCE_VERIFIED` / `USER_REPORTED` / `RECOMMENDATION` / `OWNER_DECISION_PENDING`。

---

## 1. 已批准原则（仅限 2026-11-28 22:50 CST 控件原文）

决策人：Yolanda Lee（架构负责人 / Owner）。依据：本对话决策控件书面答复（记录于 [OWNER_DECISION_RECORD.md](https://github.com/flykingvip-cloud/ai-optimization/blob/0fe6247fa4247e8c6053e5b7df888ee061c63886/docs/architecture/handover/OWNER_DECISION_RECORD.md)，`USER_REPORTED` 签署事实 + 该文件作为本阶段权威基线）。本轮未重新取签署控件，也未扩大原文。

| 编号 | 已批准原文（不得扩展） | 正式状态 | 明确未纳入本次签署、仍为 `PENDING_OWNER` 的内容 |
| --- | --- | --- | --- |
| D-01 | Phase 1 仅允许 Enterprise 遥测，Personal 数据不得进入企业遥测。 | `APPROVED`（仅限原文） | 请求稿中关于间接路径、过滤位置等扩充句 |
| D-02 | 禁止 anonymous/runner 作为正式身份；认证失败时 fail closed。 | `APPROVED`（仅限原文） | 内部账本回退与 503 对外细则等扩充句 |
| D-03 | Tenant、Service Identity、Agent 三方绑定；allowlist 与撤销责任须明确。 | `APPROVED`（仅限原文） | 签发主体、密钥持有 / 轮换 / 撤销责任人及部门；缓存 TTL 与传播时限 |
| D-04 | 采用 W3C Trace Context；Trace ID 不得作为幂等键。 | `APPROVED`（仅限原文） | generated 标记字段形态等未出现在原文中的实现细则 |
| D-05 | 只使用真实运行时版本快照，不可证字段标为 UNVERIFIED。 | `APPROVED`（仅限原文） | 建议的 Phase 1 纳入 / 排除字段清单 |
| D-06 | 明确正式 API、安全限制与字段策略；64 KiB 等数字另确认。 | `APPROVED`（仅限原文） | 64 KiB、限流数值、Retry-After、幂等保留期、冲突行为、未知字段与服务端红化细则 |
| D-07 | OpenBot 自有、默认关闭、异步非阻塞的本地 WAL；不含并 PR #4。 | `APPROVED`（仅限原文） | 合并 PR #4；A/B/C 处置选择 |

既有章程六条（OpenBot 为唯一 TaskOutcome 权威；Adapter 不得绕过 Evolution Control；AI Optimization 故障不得同步阻塞 OpenBot；Knowledge SDK Knowledge Core 不变；无第二 Run Ledger 或双写权威；生产准入关闭）仍是先前约束，**不是**本次控件签署对象，不得与上表混淆。

本次 D-01 至 D-07 批准 **不是** Implementation Plan 批准，**不是** Adapter 编码授权，**不是**合并、部署或打开生产准入的授权。

---

## 2. 残余指定与数字事项（全部 `PENDING_OWNER`）

| ID | 事项 | 所属工作包 | 正式状态 | 材料位置 | 说明 |
| --- | --- | --- | --- | --- | --- |
| R-01 | HTTP 请求体最大字节数（含 64 KiB 候选） | A1 | `PENDING_OWNER` | `API_LIMITS_CANDIDATE_COMPARISON.md` | D-06 写明数字另确认。候选值不得标为 `APPROVED` |
| R-02 | Tenant 维速率限制 | A1 | `PENDING_OWNER` | 同上 | 必须以已验证 `auth.tenantId` 计 |
| R-03 | Service Identity 维速率限制 | A1 | `PENDING_OWNER` | 同上 | 必须以已验证服务主体计；与 Tenant 维同时生效 |
| R-04 | 超限响应及 Retry-After | A1 | `PENDING_OWNER` | 同上 | 建议区分 413（体超限）与 429（限流） |
| R-05 | 幂等键保留期 | A1 | `PENDING_OWNER` | 同上 | 当前实现无 TTL（`SOURCE_VERIFIED`） |
| R-06 | 相同幂等键、不同载荷的冲突行为 | A1 | `PENDING_OWNER` | 同上 | 当前 `INSERT OR IGNORE` 不比较载荷（`SOURCE_VERIFIED`） |
| R-07 | 未知字段处理及服务端红化策略 | A1 | `PENDING_OWNER` | 同上 | 入库路径当前信任 `redaction.applied`，且不调用契约校验器 |
| R-08 | 唯一签发主体及系统 | A2 | `PENDING_OWNER` | `SERVICE_IDENTITY_RESPONSIBILITY_TABLE.md` | 不得编造服务名称。测试夹具 `https://auth.openbot.love` 不是生产 IdP |
| R-09 | 密钥持有责任人 | A2 | `PENDING_OWNER` | 同上 | 不得编造姓名或部门 |
| R-10 | 密钥轮换责任人及周期 | A2 | `PENDING_OWNER` | 同上 | 候选周期不是批准值 |
| R-11 | 紧急撤销责任人与值班路径 | A2 | `PENDING_OWNER` | 同上 | 同上 |
| R-12 | Agent allowlist 创建 / 更新 / 审核 / 撤销责任人 | A2 | `PENDING_OWNER` | 同上 | D-03 要求责任须明确，但未点名 |
| R-13 | 缓存 TTL 与撤销传播时限 | A2 | `PENDING_OWNER` | 同上 | 候选 30 秒 / 60 秒不是批准值，也不是 SLA |
| R-14 | 身份服务不可用时的 fail-closed 对外细则（含 401 / 403 / 503） | A2 | `PENDING_OWNER` | 同上 | 原则已批准「认证失败 fail closed」，对外状态码细则未签批 |
| R-15 | PR #4 WAL 处置（A / B / C） | A3 | `PENDING_OWNER` | `PR4_WAL_DISPOSITION_COMPARISON.md` | D-07 不含并 PR #4。若选 B，合并仍须单独明确授权。本阶段不代为选择 |
| R-16 | 跨仓十四项测试矩阵的最小可执行集，以及是否必须真实 IdP / 真实 OpenBot runtime / 真实 Knowledge SDK 实例 | A4 | `PENDING_OWNER` | `CROSS_REPO_MINIMUM_ACCEPTANCE_MATRIX.md` | 建议最小集不是批准集。14 项均未执行 |
| R-17 | 最终 Implementation Plan 的单独批准 | C | `PENDING_OWNER` | `IMPLEMENTATION_PLAN_DRAFT.md` | 本文件为草案 / 未批准 |
| R-18 | D-05 字段纳入 / 排除清单（运行时版本快照） | 与 G-02 相关 | `PENDING_OWNER` | `EVIDENCE_CLOSURE_PLAN_G01_G06.md` | 原则已批准；清单未随 22:50 CST 控件签署 |

本轮 **0** 项 `REJECTED`，**0** 项 `NOT_IN_SCOPE`。

---

## 3. 本阶段对残余事项的处理方式

- 需要尚未批准的 Owner 决定时：只准备请求材料，**停止代为决定**（本阶段停止条件已触发于「不得替 Owner 决策」，材料已备齐）。标签：`OWNER_DECISION_PENDING`。
- 历史建议方向（例如 PR #4 倾向 C、以 A 作对照）只作为先前 `RECOMMENDATION` 记录，不是本阶段选定的处置。
- 在 R-01 至 R-17 获得正式决定、阻塞性技术证据完成独立审查、跨仓验收责任与证据建立，以及 Implementation Plan 单独批准之前，准入状态保持不变。
