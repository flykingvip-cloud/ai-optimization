# OPENBOT_CI_FAILURE_DIAGNOSTIC.md

> OpenBot 当前失败 CI 诊断（T7）。只记录本轮下载到的日志事实。  
> 核验窗口：2026-11-28 20:12–20:18 CST（Asia/Shanghai）。  
> 目标 SHA：`13763b2d85c6ca72d3bf5b10acb1825457776ff6`（Merge PR #370，仅 `ui/package.json` 与 `pnpm-lock.yaml`，Vite 7.3.5→7.3.7）。提交时间 2026-11-28 19:07:48 CST。  
> **不得把部分 job 通过表述为整个 OpenBot CI 通过。不得仅凭 run 总红推断单一根因。日志缺失时使用「证据不足」或 `ROOT_CAUSE_UNKNOWN`。本阶段不得实施修复，也不得为变绿而削弱测试。**

日志已下载到本机审查目录 `/workspace/owner-signoff/evidence/ci-logs/`（只读取证，不是仓库文件）。本轮使用 `gh api --allow-escape-sequences` 成功获取 job 日志；**未出现** 404 / BlobNotFound。

---

## 1. 当前 SHA 上的 workflow 总览（`GITHUB_VERIFIED`）

相对 `f3558f2` 的变更只有 Vite 补丁与锁文件。身份 / TaskOutcome / Evolution / 遥测相关源码 blob 未变。CI 失败因此不能自动归因于「PR #370 改坏了业务代码」，也不得在没有直接证据时归因于 Vite 本身。

| Workflow | Run ID | 事件 | 状态 | 完成时间（CST） | 链接 |
| --- | --- | --- | --- | --- | --- |
| CI Gate | 46138406419 | push | **failure** | 2026-11-28 19:13:42 | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406419 |
| CI（Workflow CI） | 46138406398 | push | **failure**（本轮已结束，不再是 in_progress） | 2026-11-28 19:28:39 | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406398 |
| Install Smoke | 46138406420 | push | success | 19:17:29 | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406420 |
| Workflow Sanity | 46138406431 | push | success | 19:08:08 | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406431 |
| Docker Release | 46138406470 | push | **仍为 in_progress**（核验时 `build-amd64` success，完成 19:30:42 CST；`build-arm64` 仍 running） | 未完成 | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46138406470 |
| CI Canary | 46140926687 | schedule | success | 19:39:53 | 与「平台已绿」无关 |
| Stale | 46141938989 | schedule | failure | 19:52:59 | 非本诊断范围的 stale bot，不展开 |
| Memory Workspace Freeze | — | — | **本 SHA 未触发该 workflow** | — | 不得用其他 SHA 的结果替代 |

Nightly 不在本 SHA：CogniWeave SDK Nightly **46135827242** 跑在 `f3558f2ccd24a1020dff8a378721786b3071f641` 上，failure，完成 2026-11-28 18:35:26 CST。本轮未发现针对 `13763b2d` 的更新 Nightly。

---

## 2. CI Gate 46138406419

| Job | Job ID | 结论 | 失败 step |
| --- | --- | --- | --- |
| check (types, lint, format) | 140958745110 | success | — |
| **delivery guard** | 140958745343 | **failure** | Step 5「Release ledger audit」 |

**已确认事实（日志直接可见）：**

- 命令为 `pnpm delivery:ledger:audit`。
- 输出：`ledger: 163 releases, 157 errors, 24 warnings`。
- 本轮在日志中统计到 **157** 条含 `[missing-object]` 的记录；ERROR 类记录中，除总结行外均带 `[missing-object]`。
- 该 step 以 exit code 1 结束，job 失败。

**分类：** 直接失败点属于 **Release ledger** 审计（`delivery:ledger:audit` 将 missing-object 计为 ERROR 并失败）。

**根因：** 对「为什么 157 个对象缺失」（浅克隆未取到对象、ledger 指向已删除对象、仓库腐蚀、或其他）**不得确定**。日志未给出 fetch-depth / 缺失对象的最终解释。标记为 **`ROOT_CAUSE_UNKNOWN` / 证据不足**。先前关于 shallow clone 的推测仍只是推测。

**最小修复建议（不实施）：** 在专用排障任务中列出 157 个缺失对象的 SHA 或路径，对照完整克隆与 ledger 记录；只有在完整克隆上复现或排除浅克隆之后，才能声明根因。不得为了 Gate 变绿而删除审计或降低 ERROR 级别。

---

## 3. Workflow CI 46138406398（已完成 failure）

上阶段该 run 仍为 in_progress。本轮以其**最终日志**为准，不再借用其他 SHA 的 Windows 日志。

### 3.1 失败 job 一览

| Job | Job ID | 失败 step | 完成时间（CST） |
| --- | --- | --- | --- |
| secrets | 140958745239 | Audit production dependencies | 19:08:21 |
| check | 140958852892 | Check types and lint and oxfmt | 19:11:36 |
| checks (node, protocol, `pnpm protocol:check`) | 140958852940 | Run protocol (node) | 19:09:30 |
| android (test, `:app:testDebugUnitTest`) | 140958852868 | Run Android test | 19:09:43 |
| checks (node, test, Linux `pnpm test`) | 140958852882 | Run test (node) | 19:11:05 |
| checks-windows shard 1/6 | 140958853001 | Run test (node) | 19:28:38 |
| checks-windows shard 2/6 | 140958852997 | Run test (node) | 19:20:37 |
| checks-windows shard 3/6 | 140958852932 | Run test (node) | 19:24:48 |
| checks-windows shard 4/6 | 140958852913 | Run test (node) | 19:20:27 |
| checks-windows shard 5/6 | 140958852938 | Run test (node) | 19:20:57 |
| checks-windows shard 6/6 | 140958853013 | Run test (node) | 19:22:10 |

通过的 job（不得据此宣称整个 CI 通过）包括但不限于：`docs-scope`、`changed-scope`、`build-artifacts`、`skills-python`、`cogniweave-sdk-core-gate`、`android (build, assembleDebug)`、若干 node/bun 非主测试 checks、`cogniweave-sdk-integration-rollback`、`release-check`。`ios` / `macos` / `check-docs` 为 skipped。

### 3.2 secrets — 已确认事实

- 输出：`58 vulnerabilities found`，`Severity: 12 low | 36 moderate | 10 high`，exit code 1。
- 日志中出现的高危 advisory 包括：`GHSA-22jm-h49p-29qw`、`GHSA-46jr-4wx8-v453`、`GHSA-mrhx-c7xc-m3w5`、`GHSA-27r3-jxmh-p828`（出现两次）、`GHSA-xcx6-jx8p-x3h5`。
- **`GHSA-587h-7wmj-h5pm` 仍不在本日志中。**

**分类：** 依赖审计失败（dependency / security audit）。  
**根因（就 job 失败而言）：** 审计命令因发现漏洞且以非零退出而失败。这是直接证据。各 CVE 是否适用于生产路径、是否有可接受风险豁免，本轮不判定（证据不足）。

**最小修复建议（不实施）：** 按顾问升级或经安全评审豁免，并保留审计门禁。不得关闭 audit 来换绿。

### 3.3 check — 已确认事实

`oxfmt`、`oxlint --type-aware`（0 warnings / 0 errors）及其他多项 lint 已通过。失败发生在 `pnpm lint:core:architecture-manifest`（`scripts/check-architecture-manifest.ts`）：

```
Architecture manifest violations:
- runtime-capabilities-public-entry: src/agent-runtime/capabilities/invocation/authorize-stored-result-read.test.ts
  imports ./authorize-stored-result-read.js → .../authorize-stored-result-read.ts
  (denied by src/agent-runtime/capabilities/*/**)
- runtime-capabilities-public-entry: src/agents/pi-tools.stored-result-read-acl.test.ts
  imports ../agent-runtime/capabilities/invocation/authorize-stored-result-read.js → 同一目标
  (denied by src/agent-runtime/capabilities/*/**)
```

随后 ELIFECYCLE exit code 1。

**分类：** 架构清单 / 测试导入边界（代码或测试结构，相对清单规则）。  
**根因：** 上述两个测试文件的导入被清单拒绝——日志直接给出违规规则与路径，可作为该 step 的直接原因。更深的「清单是否过严或测试是否放错层」不作结论。

**最小修复建议（不实施）：** 将测试移到清单允许的入口，或经架构评审调整清单；不得为了通过而删除该 lint。

### 3.4 protocol:check — 已确认事实

命令：`pnpm protocol:gen && pnpm protocol:gen:swift && git diff --exit-code -- dist/protocol.schema.json apps/macos/Sources/OpenBotProtocol/GatewayModels.swift apps/shared/OpenBotKit/Sources/OpenBotProtocol/GatewayModels.swift`。

日志显示重新生成了两个 `GatewayModels.swift`，`git diff --exit-code` 失败。两个已提交文件与生成结果都不一致。第一份文件约 **+94 / −0** 行。新增/补齐内容包括 `sourceRunId` / `sessionKey`，以及 `CollaborationTaskRequestAcceptedArtifactDeliveryParams`、`CollaborationTaskRevokeAcceptedArtifactDeliveryParams`、`CollaborationTaskReadAcceptedArtifactDeliveryParams`，还有 `dependencyResumeId` / `dependencyResumeCapability` 等字段（以生成器输出为准）。本轮未见 `dist/protocol.schema.json` 进入该次 diff。

**分类：** 协议代码生成结果与已提交 Swift 模型不一致（契约/生成物漂移）。  
**根因：** 就该 step 而言，直接原因就是生成物与提交文件不同。为何未同步提交（遗漏提交、生成器变化、或其他）标记为进一步原因 **证据不足**。

**最小修复建议（不实施）：** 在受控变更中重新生成并审阅 diff，使提交文件与 `protocol:gen:swift` 一致；不得跳过 `git diff --exit-code`。

### 3.5 Android 测试 — 已确认事实

`309 tests completed, 6 failed`。失败用例：

| 用例 | 日志中的异常类型 | 源码位置 |
| --- | --- | --- |
| `GatewayConfigResolverTest > resolveGatewayConnectConfigManualOnly` | `java.lang.RuntimeException` | `GatewayConfigResolverTest.kt:27` |
| `GatewayConfigResolverTest > parseGatewayEndpointAcceptsWssUrl` | `java.lang.RuntimeException` | `GatewayConfigResolverTest.kt:11` |
| `KnowledgeBrowserModelsTestKt > initializationError` | `org.junit.runners.model.InvalidTestClassError` | `ReferencePipeline.java:197` |
| `MeHubModelsTest > parseRobotWorkspaceGet_mapsBlocks` | `org.junit.ComparisonFailure` | `MeHubModelsTest.kt:208` |
| `VaultSyncCryptoTest > encryptAeadMatchesBrowserVectorWithFixedNonce` | `java.lang.RuntimeException` | `VaultSyncCryptoTest.kt:45` |
| `VaultSyncCryptoTest > unlockAndOpaquePathMatchBrowserVectors` | `java.lang.RuntimeException` | `VaultSyncCryptoTest.kt:19` |

控制台日志**没有**异常消息正文或比较期望值。HTML 报告位于 runner 上的 `apps/android/app/build/reports/tests/testDebugUnitTest/index.html`，本轮未下载到该制品。Gradle 缓存键显示从 `f3558f2` 部分恢复后再写入 `13763b2d`，但不得据此把失败归因于缓存，除非另有直接证据。

**分类：** 测试失败（类型已见）。  
**根因：** 用例级根因 **证据不足**（缺异常消息与报告）。

**最小修复建议（不实施）：** 下载测试报告或在同等命令下本地复现，先读完整异常再改代码或夹具。

### 3.6 Linux `pnpm test` — 已确认事实

总结行：`Test Files  163 failed | 453 passed | 2 skipped (618)`；`Tests  8 failed | 3557 passed | 10 skipped (3575)`。另有文件级 `FAIL  path [ path ]` 条目 158 条。不得把 163 个失败文件理解成 163 个独立业务缺陷，也不得把它们折叠成单一根因。

**Failed Tests 8（有断言或异常正文）：**

1. `src/node-host/invoke-system-run-cwd.test.ts`：`selectMacNodeHostApprovalCwd > skips a symlink process.cwd and a missing Documents directory`。`AssertionError`：期望 `/tmp/openbot-cwd-fallback-…/home`，实际 `/root/.openclaw/workspace`（测试第 184 行）。
2. `src/office-suite/office-suite.acceptance.test.ts`：`generates a multi-page Chinese PDF…`。`AssertionError`：`created.details?.missingGlyphs` 期望 `[]`，实际为「第一页：中文采购验收说明…张三」等字形数组（测试第 247 行）。
3–4. `src/vault-sync/runtime-reindex-hook.node.test.ts` 两条：`Error: Linked modules must use the same context`。
5. `ui/src/ui/public-home.operator-console.test.ts`：`TypeError: Cannot redefine property: location`（测试第 76 行）。
6–8. `ui/src/ui/controllers/platform-auth.test.ts` 三条：同一 `stubPageLocation` 在第 641 行 `Cannot redefine property: location`。

文件级失败中，至少 25 个在紧邻窗口内出现 `ERR_VM_MODULE_DIFFERENT_CONTEXT` / `Linked modules must use the same context` / vitest `vi.mock` 错误。其余多数文件级失败在 12 行窗口内没有紧邻断言，**不能**在本轮全部归因为同一共享 mock。先前「共享 vitest mock」仍只能作为**部分文件的已见失败模式**，不是整个 job 的已证实单一根因。

**分类：** 混合——部分为测试断言失败（cwd 回退、PDF 缺字），部分为测试运行时/环境（VM context、`window.location` 重定义），部分文件级原因证据不足。  
**不得**把 8 个失败测试或 163 个失败文件说成「全部是环境问题」或「全部是产品回归」。

**最小修复建议（不实施）：** 分别处理：cwd 测试与 runner 工作目录假设；办公套件字体/glyph 夹具；`window.location` stub；再单独收集 VM/mock 失败的公共夹具栈。不得删除或放宽失败用例来换绿。

### 3.7 Windows 六个分片 — 已确认事实（本 run 最终日志）

**全部六个分片均失败。** 不得再用更早 SHA 或未完成 run 的部分结果替代。

| Shard | 最终 Test Files | 最终 Tests | 日志中可见的额外模式（不完全） |
| --- | --- | --- | --- |
| 1/6 | 11 failed / 398 passed / 3 skipped (412) | 39 failed / 3171 passed / 40 skipped (3250) | 失败用例涵盖 git-hooks、shadow-observer、cogniweave-manager 等；本轮模式检索未在该分片命中 SIGKILL / `rg` ENOENT |
| 2/6 | 8 failed / 401 passed / 3 skipped (412) | 22 failed / 3168 passed / 21 skipped (3211) | 见 SIGKILL 断言、超时等 |
| 3/6 | 3 failed / 408 passed / 1 skipped (412) | 4 failed / 3141 passed / 49 skipped (3194) | 失败规模较小，未在检索中命中 SIGKILL / `rg` ENOENT |
| 4/6 | 7 failed / 400 passed / 5 skipped (412) | 85 failed / 2872 passed / 11 skipped (2968) | 失败测试数最多 |
| 5/6 | 10 failed / 400 passed / 1 skipped (411) | 34 failed / 3423 passed / 12 skipped (3469) | — |
| 6/6 | 15 failed / 395 passed / 1 skipped (411) | 42 failed / 3154 passed / 4 skipped (3200) | **直接可见** `spawnSync rg ENOENT`（至少 4 处）以及多处 `expected null to be 'SIGKILL'` |

Shard 6 的 `spawnSync rg ENOENT` 是日志直接证据：该用例在 Windows runner 上调用 `rg` 且系统未提供该可执行文件。这可以解释**部分**失败，不能解释全部六个分片。SIGKILL 断言失败表明测试期望子进程被 SIGKILL，实际 signal 为 `null`；是测试假设与 Windows 进程模型不匹配，还是产品缺陷，本轮 **不升级为唯一根因**。

**分类：** 测试失败，混有平台/工具缺失迹象。  
**整体根因：** **`ROOT_CAUSE_UNKNOWN`**（多模式并存）。环境因素是部分证据，不是全部 shard 的已证统一原因。先前「Windows environmental」推测不得升格为已证实。

**最小修复建议（不实施）：** 为依赖 `rg` 的测试提供 Windows 可用替代或明确跳过条件（须保持覆盖意图）；单独复核 SIGKILL 测试在 Windows 上的语义。不得笼统 skip 整个 Windows 矩阵。

---

## 4. Nightly 46135827242（`f3558f2`，非当前 main）

Job `longrun-benchmark`，step「Run CogniWeave SDK long-run benchmark diff gate」失败。命令：`pnpm --dir packages/cogniweave-sdk run benchmark:longrun:diff:gate`。

**已确认事实（日志 JSON）：** 总体 `"status": "FAIL"`，exit code 1。未通过项不仅是吞吐：

| check | baseline | current | allowed | passed |
| --- | --- | --- | --- | --- |
| `distillation_throughput` | 16335.58039042947 | 8419.3713806016 | 9801.34823425768 | false（下降超过允许阈值 0.4） |
| `distillation_latency_p95` | 0.097458999999958 | 0.2150090000000091 | 0.1705532499999265 | false（升幅超过允许阈值） |
| `reason_latency_p95` | 0.414208 | 0.597317 | 1.03552 | true |
| `graph_query_latency_p95` | 0.000666 | 0.001462 | 0.06 | true |

制品：`cogniweave-sdk-benchmark-longrun-46135827242`（Artifact ID 15260000687）。

**分类：** 基准 diff 门禁失败（性能指标）。  
**根因：** 就门禁本身，直接原因是上述两项超出阈值。性能下降是 runner 噪声、实现回归还是基准过时，**`ROOT_CAUSE_UNKNOWN`**。该 run 不在 `13763b2d` 上，不得直接写成当前 main 的 Nightly 结果；由于当前 main 相对 `f3558f2` 仅 Vite 锁文件变化，也不得在无新 Nightly 的情况下宣称问题已消失。

**最小修复建议（不实施）：** 在当前 main 上重跑同一 gate，对比制品后再决定是修实现、更新经评审的基准，还是调查 runner 变异。不得为过关而放宽阈值除非有独立性能评审。

---

## 5. 对实施准入的含义

这些失败**不阻止**本阶段完成文档与签署包，但：

- 不得宣称 OpenBot 平台 CI 已绿。
- 不得打开生产准入。
- 不得把「Install Smoke / Workflow Sanity / 部分 job 通过」写成整体通过。
- Docker Release 在核验结束时仍 in_progress，不得预判其结论。
- 本阶段不对 OpenBot 实施任何修复。

**本阶段结束时的 CI 结论：** Gate 红、Workflow CI 红、Nightly（上一 SHA）红、Docker Release 未完成。整体 OpenBot CI **未通过**。
