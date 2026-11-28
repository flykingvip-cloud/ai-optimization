# OWNER_DECISION_RECORD.md

> Owner 正式签署记录。  
> 记录时间：2026-11-28 22:51 CST（Asia/Shanghai）。  
> **本文件只记录决策控件（答复 t26s6）中获批的原文。不得把请求稿、建议稿或先前「固化」文本扩大解释为已签署范围。**

---

## 1. 签署事实

| 项 | 内容 |
| --- | --- |
| 决策人 | Yolanda Lee（架构负责人 / Owner） |
| 决定 | `APPROVE`（D-01 至 D-07，仅限下文控件原文） |
| 决定时间 | 2026-11-28 22:50 CST（Asia/Shanghai） |
| 依据 | 本对话中 Owner 对 D-01 至 D-07 决策控件的书面答复（答复 t26s6） |
| 签署范围 | **仅**第 2 节所列七条控件原文 |
| 本记录效力 | 这是正式 Owner 签署。它**不是**最终 Implementation Plan 的单独批准，**不是** Adapter 编码授权，**不是**实施 PR、合并、部署或打开生产准入的授权 |

本记录写入本地审查目录 `/workspace/owner-decision-request/`，未写入任何仓库，未创建或更新 PR。

---

## 2. 已批准的决策文本（逐字，不扩展）

下列「已批准文本」即为 Owner 在控件中批准的提示原文，不多一字。建议细节、设计文档扩充句、PR #7/#8/#9/#10 正文，以及 `OWNER_DECISION_REQUEST.md` 中的完整待签批文本，**均不因本次答复而视为已签署**，除非该措辞已出现在下列原文中。

### D-01

| 项 | 内容 |
| --- | --- |
| 已批准文本 | Phase 1 仅允许 Enterprise 遥测，Personal 数据不得进入企业遥测。 |
| 决策人 | Yolanda Lee（架构负责人 / Owner） |
| 决定 | `APPROVE` |
| 决定时间 | 2026-11-28 22:50 CST（Asia/Shanghai） |
| 依据 | 本对话决策控件答复 t26s6 |
| 正式状态 | `APPROVED`（仅限上述原文） |

### D-02

| 项 | 内容 |
| --- | --- |
| 已批准文本 | 禁止 anonymous/runner 作为正式身份；认证失败时 fail closed。 |
| 决策人 | Yolanda Lee（架构负责人 / Owner） |
| 决定 | `APPROVE` |
| 决定时间 | 2026-11-28 22:50 CST（Asia/Shanghai） |
| 依据 | 本对话决策控件答复 t26s6 |
| 正式状态 | `APPROVED`（仅限上述原文） |

### D-03

| 项 | 内容 |
| --- | --- |
| 已批准文本 | Tenant、Service Identity、Agent 三方绑定；allowlist 与撤销责任须明确。 |
| 决策人 | Yolanda Lee（架构负责人 / Owner） |
| 决定 | `APPROVE` |
| 决定时间 | 2026-11-28 22:50 CST（Asia/Shanghai） |
| 依据 | 本对话决策控件答复 t26s6 |
| 正式状态 | `APPROVED`（仅限上述原文） |

说明：本条要求 allowlist 与撤销责任必须明确，但**未**指定签发主体、密钥持有人、轮换人、撤销人或部门。这些身份与流程仍为 `OWNER_DECISION_PENDING`。禁止编造人名或部门。

### D-04

| 项 | 内容 |
| --- | --- |
| 已批准文本 | 采用 W3C Trace Context；Trace ID 不得作为幂等键。 |
| 决策人 | Yolanda Lee（架构负责人 / Owner） |
| 决定 | `APPROVE` |
| 决定时间 | 2026-11-28 22:50 CST（Asia/Shanghai） |
| 依据 | 本对话决策控件答复 t26s6 |
| 正式状态 | `APPROVED`（仅限上述原文） |

### D-05

| 项 | 内容 |
| --- | --- |
| 已批准文本 | 只使用真实运行时版本快照，不可证字段标为 UNVERIFIED。 |
| 决策人 | Yolanda Lee（架构负责人 / Owner） |
| 决定 | `APPROVE` |
| 决定时间 | 2026-11-28 22:50 CST（Asia/Shanghai） |
| 依据 | 本对话决策控件答复 t26s6 |
| 正式状态 | `APPROVED`（仅限上述原文） |

说明：本条批准「真实运行时快照」与「不可证字段标 UNVERIFIED」原则。请求稿或证据文件中的 Phase 1 纳入/排除清单、具体字段映射建议，**不在本次签署范围内**。

### D-06

| 项 | 内容 |
| --- | --- |
| 已批准文本 | 明确正式 API、安全限制与字段策略；64 KiB 等数字另确认。 |
| 决策人 | Yolanda Lee（架构负责人 / Owner） |
| 决定 | `APPROVE` |
| 决定时间 | 2026-11-28 22:50 CST（Asia/Shanghai） |
| 依据 | 本对话决策控件答复 t26s6 |
| 正式状态 | `APPROVED`（仅限上述原文） |

说明：本条**不批准** 64 KiB 请求体上限、速率限制数值或幂等保留期。这些数字仍为「另确认」，正式状态为 `OWNER_DECISION_PENDING`。

### D-07

| 项 | 内容 |
| --- | --- |
| 已批准文本 | OpenBot 自有、默认关闭、异步非阻塞的本地 WAL；不含并 PR #4。 |
| 决策人 | Yolanda Lee（架构负责人 / Owner） |
| 决定 | `APPROVE` |
| 决定时间 | 2026-11-28 22:50 CST（Asia/Shanghai） |
| 依据 | 本对话决策控件答复 t26s6 |
| 正式状态 | `APPROVED`（仅限上述原文） |

说明：本条明确**不授权合并 PR #4**。PR #4 应保持 `OPEN`。处置选项 A/B/C **尚未选定**，仍为 `OWNER_DECISION_PENDING`。即使日后选择涉及合并的选项，仍须另行单独授权。

---

## 3. 范围限制（必须与签署一并阅读）

1. **不得扩大解释。** 不得把 `OWNER_DECISION_REQUEST.md`、[PR #7](https://github.com/flykingvip-cloud/ai-optimization/pull/7)、[PR #8](https://github.com/flykingvip-cloud/ai-optimization/pull/8)、[PR #9](https://github.com/flykingvip-cloud/ai-optimization/pull/9)、[PR #10](https://github.com/flykingvip-cloud/ai-optimization/pull/10)，或先前「建议 APPROVE / 固化」文本中的细节，视为已随本次控件答复一并签署，除非该措辞已出现在第 2 节原文中。  
2. **D-06 不含数字批准。** 64 KiB、限流数值、保留期仍待另确认（`OWNER_DECISION_PENDING`）。  
3. **D-03 不含责任人点名。** 签发主体、密钥持有、轮换、撤销责任人及部门仍未指定（`OWNER_DECISION_PENDING`）。不得编造。  
4. **D-07 不含 PR #4 合并授权。** A/B/C 未选定；PR #4 保持开放。  
5. **不是编码或实施授权。** 不得据此开始 Adapter / WAL / 身份 / API 业务编码，不得创建实现 PR，不得部署。  
6. **不是生产准入开放。** `PRODUCTION_GATE` 保持关闭。  
7. **不是最终 Implementation Plan 的单独批准。** 现有实施计划仍为草案 / 未批准。

---

## 4. 仍待 Owner 指定或确认的事项

下列事项在本次签署后仍为 `OWNER_DECISION_PENDING`。禁止用建议稿中的候选值或空泛团队名称填入。

| 事项 | 与已签署原则的关系 | 正式状态 |
| --- | --- | --- |
| Service Identity 签发主体及系统 | D-03 要求责任须明确，但未指定主体 | `OWNER_DECISION_PENDING` |
| 密钥持有、轮换、紧急撤销责任人及流程 | 同上 | `OWNER_DECISION_PENDING` |
| Agent allowlist 创建 / 更新 / 审核 / 撤销责任人 | 同上 | `OWNER_DECISION_PENDING` |
| Allowlist 缓存 TTL、刷新策略、撤销传播时限 | 未在控件原文中出现 | `OWNER_DECISION_PENDING` |
| 401 / 403 / 503 对外细则的签批值 | 未在控件原文中出现 | `OWNER_DECISION_PENDING` |
| HTTP 请求体上限（含 64 KiB 候选） | D-06 写明数字另确认 | `OWNER_DECISION_PENDING` |
| Tenant 维与 Service Identity 维速率限制及 Retry-After | 同上 | `OWNER_DECISION_PENDING` |
| 幂等键保留期 | 同上 | `OWNER_DECISION_PENDING` |
| PR #4 WAL 处置（A / B / C） | D-07 不含并 PR #4，但未选定 A/B/C | `OWNER_DECISION_PENDING` |
| 跨仓库验收最小可执行集，以及是否必须真实 IdP / 真实 OpenBot runtime / Knowledge SDK 实例 | 未在控件原文中出现 | `OWNER_DECISION_PENDING` |
| 最终 Implementation Plan 的单独批准 | 本次明确未授予 | `OWNER_DECISION_PENDING` |

---

## 5. 对准入的影响

七条原则决策现为 `APPROVED`（仅限第 2 节原文）。按 t26u，阶段推进还须同时满足：阻塞性技术证据已经独立审查并接受；跨仓库验收责任与测试证据已经建立；最终 Implementation Plan 获得单独明确的 Owner 批准。后三项**尚未满足**。

因此准入状态保持：

`BLOCKED_PENDING_BOTH`  
`ADAPTER_CODING = NOT_AUTHORIZED`  
`PRODUCTION_GATE = CLOSED`

不得将状态推进为 `READY_FOR_IMPLEMENTATION_PLAN`。
