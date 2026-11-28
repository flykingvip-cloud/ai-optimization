# OWNER_DECISION_STATUS_MATRIX.md

> Owner 决策状态矩阵（正式签署后更新）。  
> 记录依据：`OWNER_DECISION_RECORD.md`。  
> 决定时间：2026-11-28 22:50 CST（Asia/Shanghai）。  
> 决策人：Yolanda Lee（架构负责人 / Owner）。  
> 依据：本对话决策控件答复 t26s6。  
> **已批准范围仅限控件原文。建议细节与残余指定事项不得标为 `APPROVED`。**

正式状态定义：

- `APPROVED`：有明确 Owner 的明确批准记录，且范围以已批准原文为限。  
- `REJECTED`：有明确 Owner 的明确否决记录。  
- `PENDING_OWNER`：尚无正式决定。  
- `NOT_IN_SCOPE`：经 Owner 明确确认不属于当前阶段。

---

## 1. D-01 至 D-07（原则已签署）

| 编号 | 已批准原文（不得扩展） | 正式状态 | 决策人 | 决定时间 | 明确未纳入本次签署的内容 |
| --- | --- | --- | --- | --- | --- |
| D-01 | Phase 1 仅允许 Enterprise 遥测，Personal 数据不得进入企业遥测。 | `APPROVED` | Yolanda Lee（架构负责人 / Owner） | 2026-11-28 22:50 CST | 请求稿中关于间接路径、过滤位置等扩充句，除非已出现在原文中 |
| D-02 | 禁止 anonymous/runner 作为正式身份；认证失败时 fail closed。 | `APPROVED` | Yolanda Lee（架构负责人 / Owner） | 2026-11-28 22:50 CST | 请求稿中关于内部账本回退、503 对齐等扩充句 |
| D-03 | Tenant、Service Identity、Agent 三方绑定；allowlist 与撤销责任须明确。 | `APPROVED` | Yolanda Lee（架构负责人 / Owner） | 2026-11-28 22:50 CST | 签发主体、密钥持有/轮换/撤销责任人及部门（仍 `PENDING_OWNER`） |
| D-04 | 采用 W3C Trace Context；Trace ID 不得作为幂等键。 | `APPROVED` | Yolanda Lee（架构负责人 / Owner） | 2026-11-28 22:50 CST | 请求稿中关于 generated 标记字段形态等未出现在原文中的实现细则 |
| D-05 | 只使用真实运行时版本快照，不可证字段标为 UNVERIFIED。 | `APPROVED` | Yolanda Lee（架构负责人 / Owner） | 2026-11-28 22:50 CST | 建议的 Phase 1 纳入/排除字段清单（未随本次签署） |
| D-06 | 明确正式 API、安全限制与字段策略；64 KiB 等数字另确认。 | `APPROVED` | Yolanda Lee（架构负责人 / Owner） | 2026-11-28 22:50 CST | 64 KiB、限流数值、保留期（另确认，`PENDING_OWNER`） |
| D-07 | OpenBot 自有、默认关闭、异步非阻塞的本地 WAL；不含并 PR #4。 | `APPROVED` | Yolanda Lee（架构负责人 / Owner） | 2026-11-28 22:50 CST | 合并 PR #4；A/B/C 处置选择（仍 `PENDING_OWNER`） |

---

## 2. 残余事项（仍为 `PENDING_OWNER`）

| 事项 | 正式状态 | 说明 |
| --- | --- | --- |
| Service Identity 签发主体及系统 | `PENDING_OWNER` | D-03 要求责任须明确，但未点名 |
| 密钥持有、轮换、紧急撤销责任人及流程 | `PENDING_OWNER` | 不得编造人名或部门 |
| Agent allowlist 创建 / 更新 / 审核 / 撤销责任人 | `PENDING_OWNER` | 同上 |
| Allowlist 缓存 TTL、刷新策略、撤销传播时限 | `PENDING_OWNER` | 文档候选值不是批准值 |
| 401 / 403 / 503 对外细则 | `PENDING_OWNER` | 未在控件原文中签署 |
| HTTP 请求体上限（含 64 KiB 候选） | `PENDING_OWNER` | D-06 写明数字另确认 |
| Tenant 维速率限制 | `PENDING_OWNER` | 同上 |
| Service Identity 维速率限制与 Retry-After | `PENDING_OWNER` | 同上 |
| 幂等键保留期 | `PENDING_OWNER` | 同上 |
| PR #4 WAL 处置（A / B / C） | `PENDING_OWNER` | 已明确不含并；选项未选定；PR #4 保持 OPEN |
| 跨仓验收最小可执行集 / 是否必须真实 IdP 等 | `PENDING_OWNER` | 未在本次签署 |
| 最终 Implementation Plan 单独批准 | `PENDING_OWNER` | 本次未授予 |

既有章程六条（TaskOutcome 权威、不得绕过 Evolution Control、故障不阻塞主链、Knowledge Core 不变、无第二 Run Ledger、生产准入关闭）仍是先前约束，**不是**本次控件签署的对象，也不得与上表混淆。

---

## 3. 汇总

| 统计 | 数量 |
| --- | --- |
| 已正式签署（`APPROVED`，仅限控件原文） | **7**（D-01 至 D-07） |
| 已正式否决（`REJECTED`） | **0** |
| 经 Owner 宣布不在范围内（`NOT_IN_SCOPE`） | **0** |
| 仍待签署的残余指定或数字事项 | **见第 2 节，全部 `PENDING_OWNER`** |

**结论：** 七条原则已签署，但残余 Owner 指定事项与阻塞性技术证据仍未闭环，最终 Implementation Plan 未获单独批准。准入不推进，保持 `BLOCKED_PENDING_BOTH`。
