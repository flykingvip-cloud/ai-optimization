# 未解决风险及明确的停止条件

> 工作包交付第 8 项。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> 本文件记录仍然开放的风险，以及本阶段已触发或仍然适用的停止条件。  
> 阶段完成不代表实施准入通过。

---

## 1. 未解决风险

| ID | 风险 | 证据 | 标签 | 缓解（仅建议，未实施） |
| --- | --- | --- | --- | --- |
| K-01 | 残余指定与数字未批，却被扩大解释为可开工 | D-01–D-07 仅限控件原文；R-01–R-18 均为 `PENDING_OWNER` | `OWNER_DECISION_PENDING` | 保持 `ADAPTER_CODING = NOT_AUTHORIZED`；候选值不得标 APPROVED |
| K-02 | 信任客户端 `redaction.applied`，未红化原文入库 | ingest 只检查布尔标志（`16b01d9`，`SOURCE_VERIFIED`） | `SOURCE_VERIFIED` | 服务端红化；未通过则 400。须 R-07 |
| K-03 | 无请求体上限与限流，入口可被打满 | `readJsonBody` 无上限；无 413/429 | `SOURCE_VERIFIED` | 等待 R-01–R-04；禁止静默截断 |
| K-04 | 未知字段整对象落库；契约测试与 HTTP 路径不一致 | schema `additionalProperties: false` 仅在契约测试中强制 | `SOURCE_VERIFIED` | HTTP 路径启用校验（须批准后实施） |
| K-05 | 相同幂等键不同载荷被当成重复成功 | `INSERT OR IGNORE` 不比较指纹 | `SOURCE_VERIFIED` | 候选 409；须 R-06 |
| K-06 | 未文档化 GET `/v1/telemetry/events` 被误当作正式契约 | HTTP 有、OpenAPI 无；虽先认证，但无分页与角色门槛 | `SOURCE_VERIFIED` | 正式契约仅 POST；过渡期不得绕过身份边界 |
| K-07 | 无生产 Issuer 装配；测试夹具被误认为活 IdP | 无 `process.env` 装配；夹具 `https://auth.openbot.love` | `SOURCE_VERIFIED` | R-08 指定真实签发系统；夹具不得用于生产声明 |
| K-08 | 内部 `anonymous` / `runner` 与 `"main"` 回退泄漏到官方出站 | chat-entry / runtime-from-runner / normalizeAgentId；官方过滤器不存在 | `SOURCE_VERIFIED` | D-02 已批原则；须实现过滤。未实现前不得出站 |
| K-09 | 个人 TrustedScope 无 `tenantId`，若虚构租户则破坏 D-01 | `types.ts` 63–71 行；TelemetryEvent 必填 tenantId | `SOURCE_VERIFIED` | 第一期个人不出站，禁止虚构 tenantId |
| K-10 | 用 latest / `rule-v2` / 今天的常量回填版本字段 | 投影常量与 Agent id 回退不是 Version；若干字段 UNVERIFIED | `SOURCE_VERIFIED` | 坚持 UNVERIFIED；须 R-18 |
| K-11 | 调用方自报 `experimentId` 或 Adapter 绕过 Evolution 绑定 | 绑定注释与 `bindWorkingDnaTaskOutcomeRecord` 已存在，官方出站未落地 | `SOURCE_VERIFIED` | Adapter 不得绕过绑定 |
| K-12 | 把 `main` 弱 WAL 当成已满足崩溃恢复 / D-07 | `16b01d9` 无锁、可 `shift()` 丢事件 | `SOURCE_VERIFIED` | 明确区分 main / PR #4 / 尚未存在的 OpenBot WAL |
| K-13 | 把 PR #4 当作已合并依赖、断电安全或 exactly-once | PR 仍 OPEN；协作式锁非 flock；无断电试验 | `GITHUB_VERIFIED` / `SOURCE_VERIFIED` | R-15 未选定前不合并；宣传限制必须保留 |
| K-14 | 对端故障同步阻塞 Agent 主链 | 官方异步出站未实现，隔离尚未证明 | `SOURCE_VERIFIED` | D-07 要求默认关闭、异步非阻塞；须 G-05 取证 |
| K-15 | OpenBot CI Gate 持续失败，根因未知 | 当前 `73013587` 与上一 `b10ad59` 的 Gate 日志正文相同，exit 30，`[missing-object]`；根因仍不可证 | `GITHUB_VERIFIED`；根因 `ROOT_CAUSE_UNKNOWN` | 另案授权排障；本阶段不修复、不削弱测试；局部 workflow 绿不等于整仓绿 |
| K-16 | 跨仓验收被单仓 CI 或文档 PR verify 替代 | PR #4–#11 verify 多为 success；14 项均未执行 | `GITHUB_VERIFIED` | 坚持矩阵；R-16 待确认 |
| K-17 | OpenBot `main` 继续漂移，身份相关结论被过期套用 | 本轮已从 `b10ad59` 移至 `73013587`（仅依赖升级）。若再漂移且相关 blob 变化，结论必须重做 | `GITHUB_VERIFIED` / `SOURCE_VERIFIED` | 下次开工前重新 diff 指定路径 |
| K-18 | Knowledge SDK 其他分支 / PR 被引入范围 | main 未变；PR #1 与 Wave2 仍范围外 | `GITHUB_VERIFIED` | 保持 `b953c99` 边界 |
| K-19 | 短 SHA `25b6613e6` 被编造为存在的提交 | 本轮仍 HTTP 422 | `GITHUB_VERIFIED` | 继续视为不可解析 |
| K-20 | Agent 或实施者批准生产切换 | 无此授权 | `OWNER_DECISION_PENDING` / 章程约束 | `PRODUCTION_GATE = CLOSED`；三道门禁分离 |

---

## 2. 本阶段停止条件

出现下列任一情况，必须停止该动作并报告（不得猜测补全）：

| 条件 | 本阶段是否触发 | 处理 |
| --- | --- | --- |
| 需要尚未批准的 Owner 决定 | **是（预期内）**：R-01–R-18 均未批 | 只准备材料，不代为决定。未把候选值标为批准 |
| 需要跨仓写入或修改生产环境 | **否（未做）** | 若被要求则停止。本阶段无部署、无生产配置、无生产流量验证 |
| 需要合并 PR #4 | **否（未做）** | PR #4 保持 OPEN。A/B/C 未选择。即使倾向历史建议 C，也不合并 |
| 需要开始业务代码实现或执行未授权测试 | **否（未做）** | 只读源码、既有报告与 CI 日志。未运行单仓或跨仓测试 |
| 无法取得足够证据证明某项结论 | **是（限于 G-06 根因）** | 失败步骤、计数、日志正文同一性已核实；**根因保持 `ROOT_CAUSE_UNKNOWN`**。不编造、不修复 OpenBot CI |

其他遵守项（未触发越权）：

- 未修改、提交或推送任何仓库文件。
- 未创建或更新实现 PR，未更新 PR #5–#11，未修改 PR #10。
- 未修改 OpenBot 或 Knowledge SDK 工作树（包括未恢复无关的已删除 gradle/build 文件）。
- 未将建议、候选数字、设计承诺或单仓 CI 成功认定为批准或跨仓验收通过。
- 未使用 CloudAgent，未使用 GitHub 写 API。

---

## 3. 阶段完成与准入（必须分开）

本阶段可以在「决策材料、证据计划、实施计划草案已在本地备齐」的意义上结束。这 **不是**：

- 实施准入通过；
- Implementation Plan 批准；
- Adapter 编码授权；
- 证据缺口关闭；
- 跨仓验收开始或通过；
- 生产门禁开放。

最终状态在取得新的正式 Owner 决定、完成阻塞性技术证据独立审查、建立跨仓验收责任与证据，并取得最终 Implementation Plan 单独批准之前，始终保持：

`BLOCKED_PENDING_BOTH`  
`ADAPTER_CODING = NOT_AUTHORIZED`  
`PRODUCTION_GATE = CLOSED`
