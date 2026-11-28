# OPENBOT_CI_FAILURE_DIAGNOSTIC.md

> OpenBot 当前失败 CI 诊断（T7，强制刷新）。只记录本轮下载到的日志事实。  
> 核验窗口：2026-11-28 21:43–21:50 CST（Asia/Shanghai）。  
> **当前 `origin/main` SHA：`b4e106de7562ce62d2e62057ba16864ec12a2645`**（Merge PR #373，`fix(i18n): preserve newer locale selections during startup`，提交时间 2026-11-28 21:33:19 CST）。  
> 相对上一核验窗口所针对的 `13763b2d85c6ca72d3bf5b10acb1825457776ff6`，`git diff --name-only` 仅 5 个 UI 文件：`ui/src/i18n/lib/translate.ts`、`ui/src/i18n/test/translate.test.ts`、`ui/src/ui/brand-assets.ts`、`ui/src/ui/brand-assets.browser.test.ts`、`ui/src/ui/ports/port-shells.browser.test.ts`。  
> **不得**把 `13763b2d` 上未完成或已完成的 Windows 日志当作本 SHA 的替代证据。不得把部分 job 通过表述为整个 OpenBot CI 通过。不得仅凭 run 总红推断单一根因。日志缺失时使用「证据不足」或 `ROOT_CAUSE_UNKNOWN`。本阶段不得实施修复，也不得为变绿而削弱测试。

本轮当前 SHA 失败 job 日志下载到 `/workspace/owner-signoff/evidence/ci-logs-b4e106de/`（使用 `gh api --allow-escape-sequences`，**未出现** 404 / BlobNotFound）。上一 SHA 日志仍保留在 `/workspace/owner-signoff/evidence/ci-logs/`，仅作历史对照。

---

## 1. 当前 SHA `b4e106de` 上的 workflow 总览（`GITHUB_VERIFIED`）

| Workflow | Run ID | 事件 | 本轮核验时状态 | 完成或更新时间（CST） | 链接 |
| --- | --- | --- | --- | --- | --- |
| CI Gate | 46150194285 | push | **failure**（已完成） | 2026-11-28 21:38:46 | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46150194285 |
| CI（Workflow CI） | 46150194321 | push | **仍为 in_progress** | 最后观测约 21:45 CST；run 的 GitHub `updatedAt` 仍为 21:41:52 CST | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46150194321 |
| Workflow Sanity | 46150194353 | push | success | 21:35:17 | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46150194353 |
| Install Smoke | 46150194427 | push | **仍为 in_progress** | 观测于 21:45 CST | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46150194427 |
| Docker Release | 46150194294 | push | **仍为 pending**（尚无 job） | 自 21:33:22 CST 起 pending | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46150194294 |

不得把 Workflow Sanity 通过写成整体 CI 通过。不得预判 in_progress / pending 的结论。

Nightly：本轮 **没有** 针对 `b4e106de` 或中间 SHA `590c8ae` / `3199873` 的新 CogniWeave SDK Nightly。最近一次仍是 **46135827242**，跑在 `f3558f2ccd24a1020dff8a378721786b3071f641` 上，failure，完成 2026-11-28 18:35:26 CST。不得宣称当前 main 的 Nightly 已重跑或已恢复。

---

## 2. CI Gate 46150194285（当前 main，已完成 failure）

| Job | Job ID | 结论 | 失败 step | 完成时间（CST） |
| --- | --- | --- | --- | --- |
| **delivery guard** | 140994934269 | **failure** | Step 5「Release ledger audit」 | 21:34:50 |
| check (types, lint, format) | 140994934505 | success | — | 21:38:45 |

**已确认事实（本 run 日志直接可见）：**

- 命令为 `pnpm delivery:ledger:audit`。
- 输出：`ledger: 163 releases, 157 errors, 24 warnings`。
- 日志中 **157** 条含 `[missing-object]`；除最终 `##[error]Process completed` 外，ERROR 记录均带 `[missing-object]`。
- 该 step 以 **exit code 30** 结束（上一 SHA 的 Gate 46138406419 日志为 exit code 1）。计数与 `[missing-object]` 模式相同，但退出码不同，故 **不得** 声称两份日志字节相同。缺失对象的根因仍不得仅凭退出码差异来断定。

**分类：** Release ledger 审计失败。  
**根因：** 「为什么 157 个对象缺失」仍为 **`ROOT_CAUSE_UNKNOWN` / 证据不足**。浅克隆等推测不得升格。

**最小修复建议（不实施）：** 在专用排障中列出缺失对象并对照完整克隆；不得删除或降级该审计门禁。

---

## 3. Workflow CI 46150194321（当前 main，核验结束时仍 in_progress）

上一次审查的 46138406398 属于 **旧 SHA `13763b2d`**，已于 19:28:39 CST 以 failure 结束。本轮不以它代替当前 run 的未完成部分。

### 3.1 截至约 21:45 CST 已确认失败的 job（均有本 SHA 日志）

| Job | Job ID | 失败 step | 完成时间（CST） |
| --- | --- | --- | --- |
| secrets | 140994934463 | Audit production dependencies | 21:35:58 |
| check | 140996265527 | Check types and lint and oxfmt | 21:43:44 |
| checks (node, protocol, `pnpm protocol:check`) | 140996265586 | Run protocol (node) | 21:40:34 |
| android (test, `:app:testDebugUnitTest`) | 140996265551 | Run Android test | 21:40:44 |
| checks (node, test, Linux `pnpm test`) | 140996265643 | Run test (node) | 21:43:01 |

当时仍在运行、**不得提前宣布结果** 的 job 包括：Windows 分片 1–6、`checks (node, extensions)`、`release-check`。已成功的局部 job（如 `docs-scope`、`changed-scope`、`build-artifacts`、`skills-python`、`cogniweave-sdk-core-gate`、Android assemble、部分非主测试、`cogniweave-sdk-integration-rollback`）**不等于** 整个 CI 通过。`ios` / `macos` / `check-docs` 为 skipped。

因父 run 尚未结束，本文件 **不给出** 当前 SHA 的 Windows 最终计数。上一 SHA 上 Windows 6/6 失败的历史事实见第 5 节，不得外推为本 SHA 的已证结果。

### 3.2 secrets — 已确认事实（本 SHA 日志）

- `58 vulnerabilities found`，`Severity: 12 low | 36 moderate | 10 high`，exit code 1。
- 高危 advisory 包括：`GHSA-22jm-h49p-29qw`、`GHSA-46jr-4wx8-v453`、`GHSA-mrhx-c7xc-m3w5`、`GHSA-27r3-jxmh-p828`、`GHSA-xcx6-jx8p-x3h5`。
- **`GHSA-587h-7wmj-h5pm` 仍不在本日志中。**

与上一 SHA 的 secrets 失败计数和 GHSA 集合一致（`GITHUB_VERIFIED` 对照），但本结论以当前日志为准。  
**分类：** 依赖审计失败。就 job 失败而言，直接原因是审计以非零退出。各 CVE 是否适用于生产路径，本轮不判定。

### 3.3 check — 已确认事实（本 SHA 日志）

失败仍发生在 `pnpm lint:core:architecture-manifest`。违规与上一 SHA 相同的两处测试导入：

```
Architecture manifest violations:
- runtime-capabilities-public-entry: src/agent-runtime/capabilities/invocation/authorize-stored-result-read.test.ts
  imports ./authorize-stored-result-read.js → .../authorize-stored-result-read.ts
- runtime-capabilities-public-entry: src/agents/pi-tools.stored-result-read-acl.test.ts
  imports ../agent-runtime/capabilities/invocation/authorize-stored-result-read.js → 同一目标
```

随后 ELIFECYCLE exit code 1。  
**分类：** 架构清单 / 测试导入边界。该 step 的直接原因由日志给出。清单是否过严不作结论。UI 向的 PR #371–#373 **未修改** 这两个测试文件（`SOURCE_VERIFIED` / diff 名单）。

### 3.4 protocol:check — 已确认事实（本 SHA 日志）

命令仍为 `pnpm protocol:gen && pnpm protocol:gen:swift && git diff --exit-code -- dist/protocol.schema.json apps/macos/Sources/OpenBotProtocol/GatewayModels.swift apps/shared/OpenBotKit/Sources/OpenBotProtocol/GatewayModels.swift`。

重新生成两个 `GatewayModels.swift` 后 `git diff --exit-code` 失败。第一份文件约 **+94 / −0** 行。新增内容仍包括 `sourceRunId` / `sessionKey`，以及 `CollaborationTaskRequestAcceptedArtifactDeliveryParams`、`CollaborationTaskRevokeAcceptedArtifactDeliveryParams`、`CollaborationTaskReadAcceptedArtifactDeliveryParams`，还有 `dependencyResumeId` / `dependencyResumeCapability`。本轮未见 `dist/protocol.schema.json` 进入该次 diff。

**分类：** 协议生成物与已提交 Swift 模型不一致。直接原因已见；为何未同步提交仍为进一步原因证据不足。当前 main 的 UI 提交未包含这些 Swift 文件。

### 3.5 Android 测试 — 已确认事实（本 SHA 日志）

`309 tests completed, 6 failed`。失败用例与异常类型与上一 SHA 控制台输出相同：

| 用例 | 日志中的异常类型 | 源码位置 |
| --- | --- | --- |
| `GatewayConfigResolverTest > resolveGatewayConnectConfigManualOnly` | `java.lang.RuntimeException` | `GatewayConfigResolverTest.kt:27` |
| `GatewayConfigResolverTest > parseGatewayEndpointAcceptsWssUrl` | `java.lang.RuntimeException` | `GatewayConfigResolverTest.kt:11` |
| `KnowledgeBrowserModelsTestKt > initializationError` | `org.junit.runners.model.InvalidTestClassError` | `ReferencePipeline.java:197` |
| `MeHubModelsTest > parseRobotWorkspaceGet_mapsBlocks` | `org.junit.ComparisonFailure` | `MeHubModelsTest.kt:208` |
| `VaultSyncCryptoTest > encryptAeadMatchesBrowserVectorWithFixedNonce` | `java.lang.RuntimeException` | `VaultSyncCryptoTest.kt:45` |
| `VaultSyncCryptoTest > unlockAndOpaquePathMatchBrowserVectors` | `java.lang.RuntimeException` | `VaultSyncCryptoTest.kt:19` |

控制台仍 **没有** 异常消息正文。HTML 报告仍在 runner 上，本轮未下载制品。  
**用例级根因：证据不足。** 不得因「与上一 SHA 名单相同」就省略这一限制。

### 3.6 Linux `pnpm test` — 已确认事实（本 SHA 日志）

总结行仍为：`Test Files  163 failed | 453 passed | 2 skipped (618)`；`Tests  8 failed | 3557 passed | 10 skipped (3575)`。

**Failed Tests 8**（正文与上一 SHA 同类，仅临时目录后缀不同）：

1. `invoke-system-run-cwd.test.ts`：期望 `/tmp/openbot-cwd-fallback-LzZx67/home`，实际 `/root/.openclaw/workspace`（第 184 行）。
2. `office-suite.acceptance.test.ts`：`missingGlyphs` 期望 `[]`，实际为中文缺字数组（第 247 行）。
3–4. `runtime-reindex-hook.node.test.ts` 两条：`Linked modules must use the same context`。
5. `public-home.operator-console.test.ts`：`Cannot redefine property: location`（第 76 行）。
6–8. `platform-auth.test.ts` 三条：`stubPageLocation` 第 641 行同一错误。

不得把 163 个失败文件折成单一根因；也不得把「共享 vitest mock」升格为整个 job 的已证根因。当前 main 的 UI 变更未包含上述失败测试文件（`SOURCE_VERIFIED`）。

### 3.7 Windows 分片（当前 run：尚未完成）

截至约 21:45 CST，六个 `checks-windows` 分片全部为 **in_progress**。本轮 **没有** 当前 SHA 的 Windows 最终日志，因此：

- 不填写本 SHA 的 Test Files / Tests 计数；
- 不将上一 SHA 的 `spawnSync rg ENOENT` / SIGKILL 断言结果写成当前事实；
- 父 run 结论在核验结束时 **未知**（已有多个 job 失败，即使后续 Windows 全部通过，该 run 也已不能称为成功，但最终失败集合仍可能扩大）。

---

## 4. 上一 SHA `13763b2d` 的历史记录（已刷新结论项）

这些 run 不再代表当前 `main`，但属于已核验历史，避免丢失：

| Run | 结论 | 备注 |
| --- | --- | --- |
| CI Gate 46138406419 | failure，19:13:42 CST | delivery guard：`163 releases, 157 errors, 24 warnings`，157 条 `[missing-object]`，当时 exit code 1 |
| CI 46138406398 | failure，19:28:39 CST | secrets / check / protocol / Android 6 失败 / Linux 163 文件与 8 测试失败 / **Windows 六个分片全部失败**（该 SHA 的最终日志） |
| Install Smoke 46138406420 | success | 局部通过 |
| Workflow Sanity 46138406431 | success | 局部通过 |
| **Docker Release 46138406470** | 上一窗口仍为 in_progress；本轮确认已于 **2026-11-28 20:55:19 CST** 以 **`cancelled`** 结束 | `build-amd64` success（19:30:42 CST）；`build-arm64` cancelled（20:55:19 CST）；`create-manifest` skipped。不是成功发布，也不得称为仍在进行 |

Nightly 46135827242（`f3558f2`）事实未变：`distillation_throughput`（baseline 16335.58，current 8419.37，allowed 9801.35）与 `distillation_latency_p95`（current 0.215009，allowed 0.170553）均未过阈值，exit 1。性能根因仍为 `ROOT_CAUSE_UNKNOWN`。无更新的 Nightly 可证明问题已消失或仍然存在于 `b4e106de`。

---

## 5. 对实施准入的含义

当前 `main` 上 CI Gate **已红**；Workflow CI **尚未结束但已有多项失败**，因此不得宣称平台 CI 已绿，也不得把「仍在跑」写成「可能转绿从而打开生产」。Docker Release（当前 SHA）仍 pending。这些失败不阻止文档刷新，但继续阻塞任何生产准入或「平台已绿」声明。本阶段不对 OpenBot 实施修复。

**本轮 CI 结论：** 当前 main 的 Gate 失败已核实；Workflow CI 部分失败已核实且 run 未结束；Nightly 无新 run；上一 SHA 的 Docker Release 最终为 cancelled。整体 OpenBot CI **未通过**。
