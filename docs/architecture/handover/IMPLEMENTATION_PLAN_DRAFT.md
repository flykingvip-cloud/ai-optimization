# Implementation Plan 草案

> **草案 / 未批准。**  
> 本文件必须单独提交 Owner 审批。2026-11-28 22:50 CST 的 D-01 至 D-07 原则批准 **不是** 对本实施计划的批准。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> 在获得单独明确的 Owner 批准，并另有「开始实施」授权之前，本草案**全部无效**：不得开实现 PR、不得编码、不得合并、不得部署、不得跑未授权测试。

三道门禁必须分开，不得互相替代：

1. **Engineering Complete**（工程完成）：约定范围内的实现与单仓测试完成，仍不等于跨仓验收，更不等于生产准入。
2. **Integration Accepted**（集成验收）：按 Owner 确认的最小跨仓矩阵取得证据；单仓 CI 成功不算通过。
3. **Production Accepted**（生产验收）：仅在 Owner 另行开放生产门禁后，由 Owner 决定。Agent **无权**批准生产切换。

当前正式状态保持：

`BLOCKED_PENDING_BOTH`  
`ADAPTER_CODING = NOT_AUTHORIZED`  
`PRODUCTION_GATE = CLOSED`

阶段完成不代表实施准入通过。不得将状态推进为 `READY_FOR_IMPLEMENTATION_PLAN` 或任何已放行状态。

---

## 1. 已批准原则及其精确边界

决策人：Yolanda Lee（架构负责人 / Owner）。决定时间：2026-11-28 22:50 CST（Asia/Shanghai）。权威记录：`0fe6247fa4247e8c6053e5b7df888ee061c63886`。

| 编号 | 已批准原文（实施时不得扩大） | 精确边界 |
| --- | --- | --- |
| D-01 | Phase 1 仅允许 Enterprise 遥测，Personal 数据不得进入企业遥测。 | 仅此句。过滤位置、间接路径等扩充句未签署，须在实现设计中单独确认或保持更严（个人数据不出站、不虚构 tenantId） |
| D-02 | 禁止 anonymous/runner 作为正式身份；认证失败时 fail closed。 | 内部账本回退可以继续存在于 OpenBot 非出站路径，但官方出站与入库不得使用它们，也不得在认证失败时降级匿名 |
| D-03 | Tenant、Service Identity、Agent 三方绑定；allowlist 与撤销责任须明确。 | 未指定签发主体、部门或责任人。控制面与责任表未闭环前不得编码 |
| D-04 | 采用 W3C Trace Context；Trace ID 不得作为幂等键。 | generated 标记字段形态未签署；不得把未实现的 `traceparent` 写成已具备 |
| D-05 | 只使用真实运行时版本快照，不可证字段标为 UNVERIFIED。 | 纳入 / 排除清单未签署。不得用 latest、`rule-v2` 或今天的源码常量回填 |
| D-06 | 明确正式 API、安全限制与字段策略；64 KiB 等数字另确认。 | 64 KiB、限流、保留期、冲突、红化细则均未批 |
| D-07 | OpenBot 自有、默认关闭、异步非阻塞的本地 WAL；不含并 PR #4。 | 不授权合并 PR #4；A/B/C 未选定。`main` 弱 WAL 不是官方出站 WAL |

既有章程（不是本次控件签署对象，但仍约束实施）：OpenBot 为唯一 TaskOutcome 权威；Adapter 不得绕过 Evolution Control；AI Optimization 故障不得同步阻塞 OpenBot；Knowledge SDK Knowledge Core 不变；无第二 Run Ledger 或双写权威；生产准入关闭。

---

## 2. 残余 Owner 决策状态

全部见 `RESIDUAL_OWNER_DECISION_TABLE.md`。摘要：R-01–R-18 均为 `PENDING_OWNER`。本草案若在这些事项获得正式决定之前被「原则已批」误用为开工许可，属于越权。

建议的实施顺序把身份责任、API 数字、WAL 处置和最小验收集作为**开工前门禁**，而不是边做边问。

---

## 3. 技术证据缺口与关闭标准

G-01–G-06 的关闭计划见 `EVIDENCE_CLOSURE_PLAN_G01_G06.md`。关闭标准的共性：

- 必须有当前 SHA 的源码或 GitHub 运行证据，而不是设计承诺。
- 必须包含正例、负例与故障注入。
- 单仓 CI、PR #4 测试、Install Smoke / Workflow Sanity 局部绿、文档 PR verify 均不能关闭缺口。
- G-06 根因在证据不足时保持 `ROOT_CAUSE_UNKNOWN`；不得为变绿削弱测试。CI 排障须另案授权。

在阻塞性技术证据完成独立审查并接受之前，不得进入 Integration Accepted，更不得进入 Production Accepted。

---

## 4. 跨仓测试矩阵与责任分配

见 `CROSS_REPO_MINIMUM_ACCEPTANCE_MATRIX.md`。建议最小 L2 核心集为第 1、2、4、7、8、10、12 项；第 10、11、12、13 项一旦纳入不得用纯 Mock 替代。该最小集本身待 Owner 确认（R-16）。

责任摘要：

- `openbot-vp`：官方出站、身份过滤、异步 WAL、主链隔离、TaskOutcome / Evolution 权威路径、CI 另案排障。
- `ai-optimization`：入库硬化、幂等、限流、服务端红化、allowlist 控制面（若 Owner 将控制面放在此仓）、契约校验。
- `knowledge-sdk`：仅当第 11 项纳入时，以 `main@b953c99` 边界提供 ACL 最终授权证据；不得修改 Knowledge Core，不得引入 Wave2 或 knowledge-sdk PR #1。

编排作业的具体仓库位置待定，不得在未批准时创建跨仓写入或 CI 改动。

---

## 5. 建议实施顺序、依赖与回滚（仅在计划获批且另有开工授权后）

顺序可在获批后调整，但不得跳过身份、隔离与默认关闭。

| 序号 | 工作流 | 主要仓库 | 依赖的已批准决策 | 明确不做什么 | 回滚 |
| --- | --- | --- | --- | --- | --- |
| 0 | 将正式决定录入决策记录（仅文档，仍须单独 PR 授权） | `ai-optimization` | 已存在的 D-01–D-07 记录 + 新的残余决定 | 不把本草案当签署；不修改 PR #10；不擅自合并 PR #11 | 文档 PR 保持可关闭 / 可回退，不进入业务代码 |
| 1 | 身份签发对接、三方绑定、撤销、依赖不可用 fail-closed | `ai-optimization`（控制面）+ `openbot-vp`（出站不注入非法身份） | D-02、D-03 及 R-08–R-14 | 不接生产 IdP，除非另有生产变更授权；不编造责任人 | 关闭出站开关；撤回未授权绑定；已接收事件不删除 |
| 2 | API 硬化：正式 POST 契约、未知字段、体上限、限流、服务端红化、幂等 TTL 与冲突 | `ai-optimization` | D-06 及 R-01–R-07 | 不信任客户端 `redaction.applied`；不截断 payload；不把 GET 当作正式成功路径 | 保持拒绝新不合规请求；不回放未红化载荷 |
| 3 | OpenBot 本地异步缓冲 | `openbot-vp` | D-07 及 R-15 | 不依赖未授权合并的 PR #4；不宣称断电安全或 exactly-once；不阻塞主链；默认关闭 | 配置回退为关闭；清理测试 WAL 文件；主链行为应与打开前一致 |
| 4 | OpenBot Telemetry Adapter 出站 | `openbot-vp` | D-01、D-04、D-05 及 R-18 | 不虚构 Tenant ID；不用 latest / `rule-v2` 回填；不绕过 Evolution Control；不把内部 anonymous/runner 作出站身份 | 关闭开关即停止出站；OpenBot 主功能不依赖该路径 |
| 5 | 跨仓 L2 验收 | 三仓 | 全部相关签署 + 确认后的最小集 | 单仓 CI ≠ 跨仓通过；不用纯 Mock 替代禁止项；不使用生产流量 | 验收失败则保持 `NOT_AUTHORIZED` 与 `PRODUCTION_GATE = CLOSED` |
| 6 | OpenBot CI 失败另案排障 | `openbot-vp` | 单独授权 | 不削弱测试换绿；不作为 Adapter 开工前提；但是任何生产声明的前提 | 按该另案的回滚执行 |

依赖关系：1 与 2 可在获批后并行准备，但 4 不得先于 1 的绑定规则和 3 的默认关闭缓冲。5 不得先于 4 的可测试出站路径。6 可并行，但不得借 Adapter 任务修改 OpenBot CI。

---

## 6. 故障隔离和安全控制

- 官方出站默认关闭；无配置不得试探生产或非生产以外的未授权端点。
- 主执行链、Readiness、Control Plane 不得同步等待 AI Optimization。
- 认证 / 授权失败 fail closed：不入库、不降级匿名。
- 仅企业已验证 `tenantId` 可出站 / 入库；个人范围不得虚构租户。
- 服务端执行红化与 allowlist；不信任客户端声明。
- 幂等键不得使用 Trace ID；去重作用域为已验证租户 + 键。
- Adapter 只读 TaskOutcome / Evolution 绑定结果，不回写权威账本，不成为 Knowledge ACL 旁路。
- 密钥与私钥不得进入遥测事件或审计原文。
- 限流、超限、依赖不可用须可审计，审计不含未红化载荷。

---

## 7. 明确的禁止事项及准入门槛

未经单独明确授权，不得：

1. 修改、提交或推送任何仓库文件（本草案获批后，仍须另开获权的实现或文档 PR）。
2. 创建或更新实现 PR；不得把文档 PR #5–#11 改成实现 PR。
3. 合并 PR #4 或 PR #5–#11。PR #11 保持 OPEN，PR #10 不作修改，PR #4 保持 OPEN，除非 Owner 另行明确决定并授权。
4. 开始 Adapter、WAL、Service Identity、API 或 OpenBot 业务代码开发。
5. 修改 OpenBot 或 Knowledge SDK（包括为了让 CI 变绿）。
6. 执行部署、生产配置修改或生产流量验证。
7. 将建议、候选数字、设计文档承诺或单仓 CI 成功认定为 Owner 批准或跨仓验收通过。

准入门槛（全部满足之前保持 `BLOCKED_PENDING_BOTH`）：

1. 残余 Owner 决定（至少 R-01–R-17，以及实施该波次所需的 R-18）已正式签署，且范围不被扩大解释。
2. 阻塞性技术证据（G-01–G-06 中该波次阻塞项）已经独立审查并接受。
3. 跨仓验收责任与测试证据已经按确认后的最小集建立（执行本身还须另授权）。
4. 本 Implementation Plan 的最终文本获得单独明确的 Owner 批准。
5. 另有明确的开工 / 编码授权。
6. `PRODUCTION_GATE` 仍关闭，直到 Owner 单独开放；Agent 无权批准生产切换。

**当前结论：** 本文件为草案 / 未批准。实施准入不推进。
