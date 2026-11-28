# 残余 Owner 决策与证据关闭准备：独立审查报告

> 阶段：「Owner Residual Decisions & Evidence Closure Preparation」。  
> 性质：只读审查 + 决策材料 / 测试计划 / 证据缺口映射。本包全部为**本地文件**，未写入任何 git remote，未创建或更新 PR，未开始实现，未执行未授权测试。  
> 语言：简体中文。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> 审查人角色：只读复核与材料准备；**不代 Owner 签署或选择**。

---

## 1. 执行状态（强制，未改变）

`BLOCKED_PENDING_BOTH`  
`ADAPTER_CODING = NOT_AUTHORIZED`  
`PRODUCTION_GATE = CLOSED`

阶段完成不代表实施准入通过。D-01 至 D-07 原则批准不是对本包 Implementation Plan 草案的批准。不得将状态推进为 `READY_FOR_IMPLEMENTATION_PLAN`。

权威决策基线：Owner Decision Record `0fe6247fa4247e8c6053e5b7df888ee061c63886`（[PR #11](https://github.com/flykingvip-cloud/ai-optimization/pull/11)，`OPEN`，未合并）。已批准范围仅限 2026-11-28 22:50 CST 控件原文。

---

## 2. 本轮核验摘要

### 2.1 仓库 SHA

| 仓库 | 上一包所知 | 本轮 `origin/main` / 默认分支 | 是否漂移 | 标签 |
| --- | --- | --- | --- | --- |
| `flykingvip-cloud/ai-optimization` | `16b01d99d33b386102bb9b2b248558eb5517e245`（Merge PR #3，2026-11-28 14:44:27 CST） | 相同 | **否**。仓库 `pushed_at` 22:57:24 CST 来自文档分支推送（PR #11），不是 main 新提交 | `GITHUB_VERIFIED` |
| `flykingvip-cloud/knowledge-sdk` | `b953c9922cc1096e0e88455dab6746c01a9d27f9`（2026-11-25 10:10:14 CST） | 相同 | **否**（main 提交未变）。`pushed_at` 23:19:50 CST 对应新开的范围外 [PR #1](https://github.com/flykingvip-cloud/knowledge-sdk/pull/1)。Wave2 `9940818b…` 仍范围外 | `GITHUB_VERIFIED` |
| `flykingvip-cloud/openbot-vp` | `b10ad59bf6205edaa1566847cfa1685e1283c8af`（Merge PR #376，22:30:03 CST） | `73013587e3a5ccd96a0d0c284f7223199d39ed75`（Merge [PR #377](https://github.com/flykingvip-cloud/openbot-vp/pull/377)，**23:17:18 CST**） | **是**。超前 2 个提交。变更文件**仅** `package.json`、`pnpm-lock.yaml`（将 `body-parser` 提升至 2.4.0 / 1.20.9） | `GITHUB_VERIFIED` |

短 SHA `25b6613e6` 本轮仍不可解析（HTTP 422），未编造。

### 2.2 OpenBot 身份 / TaskOutcome / 遥测 / Evolution 路径 blob

本轮对下列路径在 `f3558f2`、`13763b2d`、`b4e106de`、`b10ad59`、`73013587` 上比较 blob，**全部相同**（`SOURCE_VERIFIED`）：

- `src/task-outcome/types.ts`（`b73bdc4daddf`）
- `src/task-outcome/chat-entry.ts`（`05d642475d23`）
- `src/task-outcome/runtime-from-runner.ts`（`af95fce4069a`）
- `src/executor-evidence/model-call-evidence.ts`（`671c81e728b1`）
- `src/conversations/projection.ts`（`b9707cd6e181`）
- `src/routing/session-key.ts`（`5a24c63c3a4f`）
- `src/gateway/agent-growth/evolution-task-outcomes.ts`（`62abdb3bedcf`）
- `src/gateway/evolution-control/task-outcome-binding.ts`（`4ff295ea17fa`）
- `packages/evolution-core/src/completion-ledger.ts`（`07737ef5d0fd`）

因此，先前在这些路径上的身份回退、版本来源与 Evolution 绑定结论**可以沿用**，且本轮已按当前 SHA 复核关键行号与 `traceparent` 检索（见 G-02），不是只依赖「diff 为空」。

`git diff --name-only b10ad59..73013587` 仅依赖清单，**未包含**上述路径，也未引入官方 Telemetry Adapter 或出站 WAL。

### 2.3 PR #4–#11（全部保持 OPEN，本轮未改）

| PR | HEAD | 状态 | mergeable | CI verify | 备注 |
| --- | --- | --- | --- | --- | --- |
| [#4](https://github.com/flykingvip-cloud/ai-optimization/pull/4) | `8324aa2441145bb1c685df5c8e65694277398f84` | OPEN | MERGEABLE / CLEAN | [46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496) success（17:23:44 CST，已完成） | 工程 PR，未合并。base 为 `c5779f2` |
| [#5](https://github.com/flykingvip-cloud/ai-optimization/pull/5) | `74e75fbd0fcf26a648a4c80b24d7de9eb81bfbf6` | OPEN | MERGEABLE / CLEAN | success（已完成） | 文档 |
| [#6](https://github.com/flykingvip-cloud/ai-optimization/pull/6) | `1ec34cca26deeb24d6fd54abcf3f2375e4b9ba7b` | OPEN | MERGEABLE / CLEAN | success（已完成） | 文档 |
| [#7](https://github.com/flykingvip-cloud/ai-optimization/pull/7) | `3753da21be151bad8047cd73253f74c4681f4765` | OPEN | MERGEABLE / CLEAN | success（已完成） | 文档 |
| [#8](https://github.com/flykingvip-cloud/ai-optimization/pull/8) | `62c10a412efeefc8df3e3e9c78f4f72bd6599965` | OPEN | MERGEABLE / CLEAN | success（已完成） | 文档 |
| [#9](https://github.com/flykingvip-cloud/ai-optimization/pull/9) | `6df9fddac5b08dad34ff1a4fb6d10c790b382be6` | OPEN | MERGEABLE / CLEAN | success（已完成） | 文档 |
| [#10](https://github.com/flykingvip-cloud/ai-optimization/pull/10) | `0b3f8727f65934da2821a14515d90209d74a8fce` | OPEN | MERGEABLE / CLEAN | [46152545739](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46152545739) success（已完成，22:02:07 CST） | 签署前快照，**本轮未修改** |
| [#11](https://github.com/flykingvip-cloud/ai-optimization/pull/11) | `0fe6247fa4247e8c6053e5b7df888ee061c63886` | OPEN | MERGEABLE / CLEAN | [46157316635](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46157316635) **success**（已完成，22:58:19 CST） | 上一窗口排队中的 verify 现已完成。单仓 success ≠ 合并授权，也 ≠ 跨仓验收 |

以上 CI 结论标签为 `GITHUB_VERIFIED`。docs verify 成功不得当作实施或准入推进。

### 2.4 OpenBot CI（区分已完成与仍在运行）

当前 `main` `73013587`（本窗口 23:30–23:42 CST；23:41:30 CST 做了一次状态刷新）：

- **已完成 failure：** CI Gate [46159069980](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069980)（23:24:11 CST）。`delivery guard` / Release ledger audit，163 releases / 157 errors / 24 warnings，`[missing-object]`，exit 30。
- **已完成 failure：** Workflow CI [46159069913](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069913)（23:38:13 CST）。窗口前段（23:30–23:35）仍显示 in_progress，刷新后已完成。失败 job 包括（名称级事实，`GITHUB_VERIFIED`，**不作为统一根因**）：`secrets`；`check`；`android (test, ./gradlew --no-daemon :app:testDebugUnitTest)`；`checks (node, protocol, pnpm protocol:check)`；`checks (node, test, … pnpm test)`；以及 `checks-windows (node, test, 1–6/6, pnpm test)` 全部六个分片。若干其他 job 为 success 或 skipped。不得用部分 job 成功宣称 Workflow CI 通过。各失败 job 的用例级根因本轮未再下钻，保持证据不足，不得拼成单一根因。
- **已完成 cancelled：** Docker Release [46159069924](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069924)（23:38:57 CST）。窗口前段为 pending。取消原因未在本轮单独取证，不得臆测。
- **已完成 success：** Workflow Sanity [46159070274](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159070274)；Install Smoke [46159069950](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46159069950)。局部绿 ≠ 整仓绿。

与 `b10ad59` Gate [46154967209](https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46154967209) 失败日志去掉时间戳后正文**完全相同**（`GITHUB_VERIFIED`）。根因仍为 `ROOT_CAUSE_UNKNOWN`（见 G-06）。本工作流未实施 CI 修复。

`b10ad59` 的 Workflow CI 现已完成并标为 failure（22:48:30 CST）；其 Docker Release 在本窗口仍显示 in_progress。这是刷新事实，不是对上一包窗口结束表述的改写。

---

## 3. 交付物索引（覆盖要求的八项）

本地目录：`/workspace/residual-decisions/docs/architecture/handover/`（普通文件，未初始化 git 仓库）。

| # | 要求内容 | 文件 |
| --- | --- | --- |
| 1 | 残余 Owner 决策表 | [RESIDUAL_OWNER_DECISION_TABLE.md](./RESIDUAL_OWNER_DECISION_TABLE.md) |
| 2 | API 数字 / 策略候选比较 | [API_LIMITS_CANDIDATE_COMPARISON.md](./API_LIMITS_CANDIDATE_COMPARISON.md) |
| 3 | Service Identity 运维责任表 | [SERVICE_IDENTITY_RESPONSIBILITY_TABLE.md](./SERVICE_IDENTITY_RESPONSIBILITY_TABLE.md) |
| 4 | PR #4 A/B/C 比较 | [PR4_WAL_DISPOSITION_COMPARISON.md](./PR4_WAL_DISPOSITION_COMPARISON.md) |
| 5 | 跨仓最小验收矩阵建议 | [CROSS_REPO_MINIMUM_ACCEPTANCE_MATRIX.md](./CROSS_REPO_MINIMUM_ACCEPTANCE_MATRIX.md) |
| 6 | G-01 至 G-06 证据关闭计划 | [EVIDENCE_CLOSURE_PLAN_G01_G06.md](./EVIDENCE_CLOSURE_PLAN_G01_G06.md) |
| 7 | Implementation Plan 草案 | [IMPLEMENTATION_PLAN_DRAFT.md](./IMPLEMENTATION_PLAN_DRAFT.md)（标明草案 / 未批准） |
| 8 | 未解决风险及停止条件 | [UNRESOLVED_RISKS_AND_STOP_CONDITIONS.md](./UNRESOLVED_RISKS_AND_STOP_CONDITIONS.md) |

每项结论均标注且只标注：`GITHUB_VERIFIED` / `SOURCE_VERIFIED` / `USER_REPORTED` / `RECOMMENDATION` / `OWNER_DECISION_PENDING`。正式决策状态只使用 `APPROVED` / `REJECTED` / `PENDING_OWNER` / `NOT_IN_SCOPE`。

---

## 4. 工作包结论摘要

### 4.1 已批准原则与残余事项

D-01 至 D-07 为 `APPROVED`，**严格限于控件原文**（签署事实来自权威记录，`USER_REPORTED` 于 22:50 CST 由 Yolanda Lee 作出）。残余指定、数字、A/B/C、最小验收集与本实施计划均为 `PENDING_OWNER`。本阶段不代为决定。

### 4.2 A1 API 数字

当前 `16b01d9`：无体上限、无限流、无 Retry-After、无幂等 TTL、相同键不同载荷不当作冲突、ingest 信任 `redaction.applied`、契约校验未接入 HTTP 路径、存在未文档化但已认证的 GET、OpenAPI 与 HTTP 漂移、无生产 OIDC 环境装配。64 KiB 与限流数字保持候选，**不是 APPROVED**。详见 API 比较文档。

### 4.3 A2 Service Identity 责任

责任表全部空白，待 Owner 填写。未编造姓名、部门、服务名或 SLA。测试夹具 Issuer 不是生产 IdP。D-03 原则已批，责任指定与控制面未闭环。

### 4.4 A3 PR #4 处置

A/B/C 成本、风险与五项影响已列出。历史建议方向（C 为主、A 作对照）仅作为先前 `RECOMMENDATION` 记录，本阶段未选择。`main` 弱 WAL 弱于未合并的 PR #4，不得描述为已满足崩溃恢复。D-07 不含并 PR #4。

### 4.5 A4 跨仓最小集

建议最小 L2 核心集为第 1、2、4、7、8、10、12 项；第 11、13 项有条件纳入；第 3、5、6、9、14 项受残余决定阻塞。该建议须 Owner 确认。14 项均未执行。

### 4.6 工作包 B

G-01–G-06 均已建立含七要素的证据包。**无一缺口被标为已关闭。** G-06 根因停止断言，保持 `ROOT_CAUSE_UNKNOWN`。

### 4.7 工作包 C

已更新完整 Implementation Plan 草案，含原则边界、残余状态、证据关闭标准、矩阵责任、顺序 / 依赖 / 回滚、隔离与安全控制、禁止事项与三道门禁。文件明确为草案 / 未批准。

---

## 5. 本阶段未做事项（合规确认）

- 零仓库修改、零 commit、零 push。
- 零 PR 创建 / 更新 / 合并。PR #11 保持 OPEN，PR #10 未改，PR #4 保持 OPEN。
- 零 Adapter / WAL / Service Identity / API / OpenBot 业务编码。
- 未修改 OpenBot 或 Knowledge SDK 工作树，也未恢复无关的已删除文件。
- 未部署、未改生产配置、未做生产流量验证。
- 未运行现有单仓测试或新的跨仓测试；仅只读检查源码、既有文档与 GitHub / Actions 日志。
- 未使用 CloudAgent，未使用 GitHub 写接口。
- 本地输出目录未初始化为 git 仓库，以降低误推风险。

---

## 6. 最终结论

七条原则已在控件原文范围内批准，但残余 Owner 指定、阻塞性技术证据与跨仓验收责任仍未闭环，最终 Implementation Plan 未获单独批准。OpenBot 主干虽仅发生依赖升级，CI Gate 仍失败且根因未知。

准入不推进，保持：

`BLOCKED_PENDING_BOTH`  
`ADAPTER_CODING = NOT_AUTHORIZED`  
`PRODUCTION_GATE = CLOSED`
