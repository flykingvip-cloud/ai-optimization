# OWNER_DECISION_STATUS_MATRIX.md

> D-01 至 D-07 及配套事项的正式状态矩阵。  
> 核验窗口：2026-11-28 21:43–21:50 CST（Asia/Shanghai）。  
> 本轮强制刷新后，D-01–D-07 正式状态 **仍全部为 `PENDING_OWNER`**。PR #4–#10 均无签署评论或审查。状态矩阵实质结论相对 20:12–20:18 CST 包 **无变化**，仅核验窗口与基线（见总报）已更新。  
> **本矩阵不是签署记录。** 没有 Owner 书面批准前，不得把建议栏或历史「固化」方向升级为 `APPROVED`。

决策责任人：架构负责人 Yolanda Lee。  
正式状态定义见 `OWNER_SIGNOFF_PACKET.md` 第 0 节。

---

## 1. Phase 1 必需决策

| 编号 | 决策要点 | 当前建议（非签署） | 正式状态 | 决策日期 | 适用范围 | 阻塞实施？ | 证据标签 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D-01 | Phase 1 仅 Enterprise Tenant；Personal 不得经日志/反馈/引用/附件/文件或间接关联进入企业遥测；不得虚构 Tenant ID | 建议批准 | **PENDING_OWNER** | 无 | Phase 1 官方出站与入库 | 是 | `OWNER_DECISION_PENDING`；依据为 `SOURCE_VERIFIED` + `RECOMMENDATION` |
| D-02 | 禁止 anonymous/runner 作为正式身份；认证失败 fail closed，不得降级或跨租户写 | 建议批准 | **PENDING_OWNER** | 无 | Phase 1 官方身份与认证 | 是 | 同上 |
| D-03 | Tenant + Service Identity + Agent 绑定；allowlist / 签发 / 轮换 / 撤销责任必须明确 | 建议批准原则；机制未落地前不得宣称已解除阻塞 | **PENDING_OWNER** | 无 | Phase 1 身份与授权控制面 | 是 | 同上；控制面未实现为 `SOURCE_VERIFIED` |
| D-04 | W3C Trace Context；缺失/无效则本地生成并标记；Trace ID 不得作幂等键或 Experiment ID | 建议批准 | **PENDING_OWNER** | 无 | Phase 1 追踪与幂等边界 | 是 | 同上；`traceparent` 无匹配为 `SOURCE_VERIFIED` |
| D-05 | 只允许真实运行时版本快照；不可证来源标 UNVERIFIED 或从 Phase 1 排除；禁止伪造 latest/default | 建议批准原则；Phase 1 仅纳入已有可信来源字段 | **PENDING_OWNER** | 无 | Phase 1 Version Snapshot | 是 | 字段级见 `VERSION_SNAPSHOT_SOURCE_EVIDENCE.md` |
| D-06 | 正式 API、未知字段、体上限、限流、429/Retry-After、幂等语义 | 建议批准原则；64 KiB 与限流数字仅为候选 | **PENDING_OWNER** | 无 | Phase 1 正式 Adapter API | 是 | 候选值不得标为已批准 |
| D-07 | OpenBot 自有、默认关闭、异步非阻塞本地 WAL/buffer；at-least-once；PR #4 非 main 能力、合并须单独授权 | 建议批准原则；PR #4 处置待选 A/B/C | **PENDING_OWNER** | 无 | Phase 1 OpenBot 出站缓冲 | 是 | 见 `WAL_IMPLEMENTATION_DISPOSITION.md` |

---

## 2. 配套事项（同样不是已签署）

| 事项 | 正式状态 | 说明 | 标签 |
| --- | --- | --- | --- |
| Service Identity 签发主体及系统 | **PENDING_OWNER** | 未指定，禁止编造人名或部门 | `OWNER_DECISION_PENDING` |
| Agent allowlist 创建/更新/审核/撤销责任人 | **PENDING_OWNER** | 同上 | `OWNER_DECISION_PENDING` |
| 密钥轮换与紧急撤销流程 | **PENDING_OWNER** | 无已验证流程 | `OWNER_DECISION_PENDING` |
| Allowlist 缓存 TTL 与撤销传播时限 | **PENDING_OWNER** | 无已批准数值 | `OWNER_DECISION_PENDING` |
| 401 / 403 / 503 对外细则 | **PENDING_OWNER** | 有实现事实与建议，未签批 | `RECOMMENDATION` |
| 新事件拒绝 vs 已接收事件保留 | 原则建议已写，**PENDING_OWNER** | 与 D-03 一并签署 | `RECOMMENDATION` |
| HTTP Body 上限 | 候选 64 KiB（65536 字节），**PENDING_OWNER** | 确认前不是最终批准值 | `OWNER_DECISION_PENDING` |
| Tenant 维限流 | 候选见 API 文档，**PENDING_OWNER** | 无实现、无批准值 | `OWNER_DECISION_PENDING` |
| Service Identity 维限流 | 候选见 API 文档，**PENDING_OWNER** | 同上 | `OWNER_DECISION_PENDING` |
| 幂等键保留期 | 候选见 API 文档，**PENDING_OWNER** | 现有 UNIQUE 无保留期 | `OWNER_DECISION_PENDING` |
| PR #4 WAL 处置（A/B/C） | **PENDING_OWNER** | 合并须单独授权；本阶段只给选项 | `OWNER_DECISION_PENDING` |
| 跨仓验收矩阵最小可执行集 / 是否必须真实 IdP | **PENDING_OWNER** | 矩阵已起草，**均未执行** | `OWNER_DECISION_PENDING` |
| 既有章程六条（TaskOutcome 权威、不得绕过 Evolution Control、故障不阻塞主链、Knowledge Core 不变、无第二 Run Ledger、生产准入关闭） | 既有已接受约束，**不是** D-01–D-07 签署 | 不得与上表混淆 | `USER_REPORTED` / 章程 |

---

## 3. 汇总

| 统计 | 数量 |
| --- | --- |
| 已正式签署（APPROVED） | **0** |
| 已正式否决（REJECTED） | **0** |
| 经 Owner 宣布不在范围内（NOT_IN_SCOPE） | **0** |
| 仍待签署（PENDING_OWNER）的 Phase 1 必需项 | **7（D-01–D-07 全部）** |

**结论：** 无一 Owner 决策已签署；全部仍待签署。不具备进入已批准 Implementation Plan 阶段的资格。
