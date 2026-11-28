# AGENT_HANDOVER_BASELINE_AUDIT.md

- **文档性质**：Phase 0 接管审计与基线冻结报告
- **审计日期**：2026-11-27（Asia/Shanghai，UTC+8）
- **负责人确认**：2026-11-27（Asia/Shanghai）。确认第 1–4 项：接受三仓当前 SHA 为 Phase 0 工程基线（非生产准入）；同意按 P0-1 → P0-2 → P0-3 → P0-4 实施；Knowledge SDK Wave2 暂不纳入；授权本文件与 `PHASE0_EXECUTION_PLAN.md` 经独立功能分支和 PR 入仓。该授权仅覆盖文档变更，不代表授权后续代码修改。第 5 项（OpenBot 失败 Actions 由维护者先恢复可观测性）同步协调，不阻塞本文档入仓。
- **审计方式**：通过已安装的 `cursor-github` MCP 对远端仓库做只读核验（`get_repository` / `get_branch` / `list_commits` / `compare_commits` / `list_pull_requests` / `get_file_contents` / `get_git_tree` / `get_workflow_run` / `list_workflow_run_jobs` / `get_job_logs` / `list_check_runs_for_ref`）。**未**将任何仓库 clone 到本机或用户电脑，**未**修改任何仓库代码，**未**重跑本地测试，**未**连接生产库。本文件入仓不改变上述审计结论。
- **存放位置**：`docs/architecture/handover/AGENT_HANDOVER_BASELINE_AUDIT.md`
- **工作区限制**：GitHub API 无法判断他人本地工作区是否干净（未提交修改、未跟踪文件、stash 等）。下文凡写“工作区状态”，均只覆盖远端默认分支、开放 PR 与可见分支，**不猜测**本地工作区。

---

## 1. 三仓当前基线

### 1.1 AI Optimization（`flykingvip-cloud/ai-optimization`）

| 项 | 核验结果 | 证据 |
|---|---|---|
| 可见性 | public | `get_repository` |
| 默认分支 | `main` | `default_branch=main` |
| 当前 HEAD | `4716abb81a8b15e8b10b80cd04965b69eb7dcc15` | `get_branch(main)` |
| Commit message | `test(m4): close M4 evidence gaps (real OpenBot state machine, Dataset HTTP E2E, WAL crash recovery, hardened OIDC)` | 同上 |
| 作者 / 提交者 | `gmood2008` / `daniel.hhd@gmail.com` | 同上 |
| 提交时间 | 2026-11-27 11:09:52（Asia/Shanghai，源时间戳 `2026-11-27T03:09:52Z`） | 同上 |
| 父提交 | `f45f3d8a842bf8ae8f34cff7c950f06fd0a891de` | 同上 |
| 已确认基线是否仍是主线 | **是，HEAD 与已确认基线完全等价**；默认分支上没有后续提交 | `get_branch` + `list_commits(sha=main)` 第一条即为该 SHA |
| 远端分支 | 仅 `main`（`protected=false`） | `list_branches`（1 条） |
| 开放 / 未合入 PR | **0**（`open_issues_count=0`，`list_pull_requests(state=open)` 返回 `[]`） | GitHub |
| 本地工作区 | **无法从 GitHub 判断** | 限制说明 |

结论：已确认基线 `4716abb81a8b15e8b10b80cd04965b69eb7dcc15` **就是**当前 `main` HEAD，不存在“已被超越”的后续主线提交。

### 1.2 OpenBot（`flykingvip-cloud/openbot-vp`）

| 项 | 核验结果 | 证据 |
|---|---|---|
| 可见性 | private | `get_repository` |
| 默认分支 | `main` | `default_branch=main` |
| 当前 HEAD | `d20d7f7cd45199da0b68d9623336d4e69c999223` | `get_branch(main)` |
| Commit message | `Merge pull request #354 from flykingvip-cloud/docs/align-release-record-seq-165` / `docs(deploy): align RELEASE_RECORD.md with releases.jsonl seq 165` | 同上 |
| 作者 | `flykingvip-cloud` / `flykingvip@gmail.com`；committer 为 GitHub | 同上 |
| 提交时间 | 2026-11-27 20:51:21（Asia/Shanghai，源时间戳 `2026-11-27T12:51:21Z`） | 同上 |
| 历史架构参考基线 `58287aa449fb499f49080c467df76b774b458222` | **是当前 `main` 的祖先**；`compare(58287aa...d20d7f7)`：`status=ahead`，`ahead_by=23`，`behind_by=0` | `compare_commits` |
| 专项审计基线 `25b6613e6` | **在当前仓库无法解析**。`get_commit(ref=25b6613e6)` 返回 HTTP 422：`No commit found for SHA: 25b6613e6`；`compare_commits` 返回 HTTP 404。文档（见第 3 节）称该短 SHA 属于分支 `codex/openbot/workspace-seat-binding`，但该短 SHA 本身在当前对象库中不存在。按任务名搜索到的相关提交为 `7d40c7d676b130406132e8ba3b9724fad545345a`（`Gateway: honor authoritative seat workspace grants`，Task: `workspace-seat-binding`）及其合入 `4d65f405a0d530ddbea9e9bc683363f384db4204`（Merge PR #290）。**不能把这两个 SHA 等同于 `25b6613e6`**。 | `get_commit` / `search_commits` |
| 开放 PR | **8** 个（全部 `base=main`），见 1.2.2 | `list_pull_requests` |
| 本地工作区 | **无法从 GitHub 判断** | 限制说明 |

#### 1.2.1 当前 HEAD 相对 `58287aa` 的后续提交（共 23 个，由近到远）

来源：`list_commits(sha=main, per_page=30)`，在 `58287aa449fb499f49080c467df76b774b458222` 之前的 23 条：

1. `d20d7f7cd45199da0b68d9623336d4e69c999223` — Merge PR #354 — docs(deploy): align RELEASE_RECORD.md with releases.jsonl seq 165
2. `a4731cfddaeb44674293ae24709b7fef22928bcc` — docs(deploy): align RELEASE_RECORD.md with releases.jsonl seq 165
3. `a187ed296487ed1bf48b0df13ab320b745d2798a` — Merge PR #353 — fix/conversation-send-auto-bind-task
4. `3ade24a50f54f6fca1c8e9de3730c57aea7b8887` — Execution: auto-admit and bind traceable parent task on 1v1 cross-employee dispatch
5. `3b7cae3ae034746b4c8b01e7aaa7820e1320b621` — Loom: register Solution A conversation_send auto-bind task
6. `10817c3e4102cb821ac90cc11a59b75a2e198d2f` — Merge PR #352 — fix/systemic-live-test-findings
7. `feaea7f65c75f849c37310e9c3bb2c50ae489cb5` — Fix: wire bot capability/data surfaces, tighten plan-confirm anchor, and add scheduled_task list
8. `f769df43305e6fd373016563d339f4fb358a401a` — Loom: register systemic live-test fixes
9. `b1096495c365fc540f99c3066edc2a2ba30dbc94` — Merge PR #351 — arch/phase-4-control-plane-slim
10. `d886976300d90ff1b4227a336bf53af90cc8e3cd` — Fix: clear remaining src/ tsgo errors in candidate-core test and llm-slug-generator
11. `5a8067ab5000cb1695786c254828a6623e1dc108` — Architecture: slim control plane, retire legacy lifecycles, and add evolution gating (Phase 4)
12. `ccb9894941158005ec6cce7a3b28c36c0ce8db61` — Loom: register Phase 4 control-plane slimming and retirement
13. `df3c35c04e4f370b1aef61147dcf927c41a9e90a` — State: enforce storage-level fencingGeneration guard and beforeEffect side-effect gate (Phase 3)
14. `66a53207707eeeb8701923121be6d5f4636f53f5` — Loom: register Phase 3 state fencing and effect gate
15. `bfb003dbf2f1fde548ffd568c944bcdcbd1af237` — Delivery: unify chat final receipt delivery and outbound dispatch onto agent-runtime/delivery (Phase 1)
16. `46e3c873e1174591503af94fbf6e3767129f516f` — Loom: register Phase 1 Delivery & Recovery unification
17. `db6a5910ebfc9b76213ffe2020a7a73c0c7a1eca` — Execution: consolidate direct complete/completeSimple calls and close governance contract (Slice 2B-2)
18. `e599b33db71511d78d43de7730e76d5b1e76c64a` — Loom: register Slice 2B-2 direct model and governance closure
19. `5f648a90328f6459ebc64ce86a16e5b84be04d81` — Execution: unify candidate runners and eliminate runEmbeddedPiAgent bypasses (Slice 2B-1)
20. `2920d55e010691dd137825174e78c8d92f5a116f` — Governance: register arch-slice-2b1-candidate-and-bypass takeover
21. `97441b6a4fe324fc35f40b789e4d5707c2a084b9` — Execution: unify lifecycle factories and command admission session (Slice 2A)
22. `fe2f9c0456b1b3216fa8fb3b00fe33841d5bf7eb` — Governance: add arch-slice-2a-unified-lifecycle landingStream
23. `676ad5a8b8ad0f52bbb82a53d1fdc3393745a147` — Governance: register exact Slice2A integration takeover

其后即为历史参考基线 `58287aa449fb499f49080c467df76b774b458222`（`fix(locks): preserve competing locks until offline recovery (#347)`，2026-11-25 08:32:51 Asia/Shanghai）。

这些后续提交覆盖生命周期统一、Evolution gating、交付/恢复统一与文档对齐，**不是** AI Optimization Adapter 或生产 Telemetry 外发合入。不得把“OpenBot main 已前进 23 个提交”写成“跨仓联调已完成”。

#### 1.2.2 OpenBot 未合入 PR（8）

| 编号 | 标题 | 链接 | base / head | 与 M4 / OIDC / WAL / 状态机 / Adapter / Telemetry / PostgreSQL 的相关性 |
|---|---|---|---|---|
| #355 | docs(governance): draft Evolution/diagnosis permission matrix (S-10) | https://github.com/flykingvip-cloud/openbot-vp/pull/355 | `main` / `docs/s10-governance-permission-matrix-draft`（`16e76ef0d0aef24dfb0a99379c01f52e0d28fcc7`） | **相关（治理文档）**。PR 正文写明仅为审查草稿，不改变运行时、feature flag 或 `releases.jsonl`。并声称 “GitHub Actions quota is exhausted”。创建于 2026-11-27 21:03:25（Asia/Shanghai）。 |
| #350 | Fix protocol generation drift and explicit local store addressing | https://github.com/flykingvip-cloud/openbot-vp/pull/350 | `main` / `codex/openbot/protocol-tenant-ci-repair` | 协议生成与本地 store 路径；非 AI Optimization 联调。提到多租户路径，但不构成跨仓 Adapter。 |
| #349 | Tests: verify personal task contract through pending delivery | https://github.com/flykingvip-cloud/openbot-vp/pull/349 | `main` / `codex/openbot/personal-single-reverify-20261125` | TaskOutcome 测试；非 AI Optimization Telemetry/Adapter。 |
| #348 | fix(delivery): recheck recovery authority after claiming sends | https://github.com/flykingvip-cloud/openbot-vp/pull/348 | `main` / `codex/openbot/pending-claim-recheck-20261125` | 交付/恢复权限；正文引用基线 `58287aa`。非优化制品消费。 |
| #343 | Chore(deps): bump the swift-deps group… | https://github.com/flykingvip-cloud/openbot-vp/pull/343 | `main` / dependabot Swift | 不相关 |
| #342 | Chore(deps): bump the android-deps group… | https://github.com/flykingvip-cloud/openbot-vp/pull/342 | `main` / dependabot Android | 不相关 |
| #327 | Runtime 集成审查／非生产就绪：冻结当前架构工作供集中审核（draft） | https://github.com/flykingvip-cloud/openbot-vp/pull/327 | `main` / `codex/openbot/runtime-integration-review`（`246709eef10739c7d70a0b5304a9cd39661bb09f`） | 运行时集成审查材料。PR 正文明确 **不建议整包合入、不得据此部署**。与 M4 跨仓联调无直接对应。 |
| #325 | Chore(deps): bump github.com/apple/swift-log… | https://github.com/flykingvip-cloud/openbot-vp/pull/325 | `main` / dependabot Swift | 不相关 |

**没有**开放 PR 实现 AI Optimization Adapter、生产 Telemetry 外发、OIDC/JWKS 跨仓或 PostgreSQL 联调。

### 1.3 Knowledge SDK（`flykingvip-cloud/knowledge-sdk`）

| 项 | 核验结果 | 证据 |
|---|---|---|
| 可见性 | public | `get_repository` |
| 默认分支 | `main` | `default_branch=main` |
| 当前 HEAD | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | `get_branch(main)` |
| Commit message | `fix(ci): give HTTPError fixtures closeable bodies on Python 3.9` | 同上 |
| 作者 | Grok Bot / `grok-bot@users.noreply.github.com` | 同上 |
| 提交时间 | 2026-11-25 10:10:14（Asia/Shanghai，源时间戳 `2026-11-25T02:10:14Z`） | 同上 |
| 联合审计参考 `9940818b962ccb186c0dfb0158de6bd9bd49057b` | **存在，但不在 `main` 上**。该 SHA 是分支 `feat/align-wave2-m2-min-slice` 的 HEAD。`compare(9940818...b953c99)`：`status=behind`，`ahead_by=0`，`behind_by=46`，`merge_base=b953c992…`。含义：当前 `main` 是该参考提交的祖先；参考提交比 `main` **超前 46 个提交，且未合入默认分支**。参考提交说明：`fix(v2): enforce current task scope on new assets and exact replay`，时间 2026-11-25 20:53:28（Asia/Shanghai，源 `2026-11-25T12:53:28Z`）。 | `compare_commits` + `list_branches` |
| 开放 PR | **0** | `list_pull_requests` 返回 `[]` |
| 未合入功能分支 | 至少 16 个 `feat/*` 分支仍存在（含 Wave2、Q2/Q3、policy、postgres 等），均未作为开放 PR 出现 | `list_branches` |
| 仓库 `pushed_at` | `2026-11-26T23:46:53Z`（2026-11-27 07:46:53 Asia/Shanghai），晚于 `main` HEAD 提交时间，与功能分支推送一致，**不代表 main 有更新的提交** | `get_repository` |
| 本地工作区 | **无法从 GitHub 判断** | 限制说明 |

本阶段不要求重构 Knowledge SDK。产品边界见第 4 节。不得建议将其知识核心迁入 OpenBot 或 AI Optimization。

---

## 2. CI 证据

### 2.1 AI Optimization：Run `45932557643`（亦即当前 HEAD 的最新 CI）

因为当前 `main` HEAD 就是 `4716abb81a8b15e8b10b80cd04965b69eb7dcc15`，按 `head_sha` 过滤的工作流运行只有这一条。因此“已核实基线 CI”与“当前 HEAD CI”是同一 run，不是两次独立成功。

| 项 | 实际结果 |
|---|---|
| URL | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/45932557643 |
| Workflow | `CI`（`.github/workflows/ci.yml`，workflow_id `432202147`） |
| Run number / event | 8 / `push`（`head_branch=main`） |
| `head_sha` | `4716abb81a8b15e8b10b80cd04965b69eb7dcc15` |
| 状态 | `status=completed`，`conclusion=success` |
| 时间 | 创建/开始 2026-11-27 11:10:00，更新 11:10:14（Asia/Shanghai；源 Z 时间为 03:10:00–03:10:14） |
| Job | 唯一 job `verify`（id `140288284633`），`conclusion=success`，`ubuntu-latest` |

`list_workflow_run_jobs` 显示的成功步骤：checkout、pnpm setup、setup-node、`pnpm install --frozen-lockfile || pnpm install`、`TypeScript typecheck`、`Contract, Security, Resilience, Persistence & Unit Tests`、`Dependency vulnerability audit (high/critical gate)`、`Secret scanning check (no committed credentials)`。

`get_job_logs(job_id=140288284633)` 中的**实际命令与输出**（不得用前任口头报告替代）：

- checkout 检出 `4716abb81a8b15e8b10b80cd04965b69eb7dcc15`（`fetch-depth: 1`，`submodules: false`）。CI 没有 checkout OpenBot 仓库。
- `pnpm run typecheck` → `tsc --noEmit`，无错误输出，步骤成功。
- `pnpm run test` → `vitest run`（v5.1.2）：

```
✓ tests/integration/phase1-e2e.test.ts (5 tests)
✓ tests/m4-sandbox/m4-full-sandbox-e2e.test.ts (1 test)
✓ tests/integration/secondary-audit-remediation.test.ts (5 tests)
✓ tests/m4-sandbox/m4-oidc-jwks.test.ts (2 tests)
✓ tests/security/security-and-auth.test.ts (4 tests)
✓ tests/integration/persistence-wal-perf.test.ts (3 tests)
✓ tests/contract/contracts.test.ts (4 tests)
✓ tests/integration/experiment-and-judge.test.ts (2 tests)

Test Files  8 passed (8)
     Tests  26 passed (26)
  Duration  799ms
```

日志同时出现 `ExperimentalWarning: SQLite is an experimental feature`。这是 SQLite 测试证据，**不是** PostgreSQL 证据。

- `pnpm audit --audit-level=high` 输出：`No known vulnerabilities found`。
- Secret scanning 的 grep 步骤成功结束（无 “Potential secret detected!”）。仓库级 GitHub `secret_scanning` 配置为 `disabled`（`get_repository.security_and_analysis`），与 CI 内 grep 不是同一机制。

`package.json` 脚本（HEAD）：`typecheck`、`test`、`test:watch`、`check`（`typecheck && test`）。CI 运行的是 `typecheck`、`test`、`audit` 与 grep，**没有**单独运行 `pnpm run check`。`check` 的本地结果未在本轮复跑，不以本 Agent 的名义编造。

同仓 `main` 历史 CI（`list_workflow_runs(branch=main)`，共 8 次）：run 8（本基线）至 run 5、run 2、run 1 为 success；run 4（`8196f2551cae…`）与 run 3（`4c23b87915c9…`）为 failure。Phase 1 复验报告引用的 Run `45925700416`（commit `24363154a4b8…`）确认为 success，但是 **23 个用例 / 6 个文件** 的阶段，已被后续提交超越；当前权威 CI 是 Run `45932557643` 的 26/8。

### 2.2 OpenBot：当前 HEAD CI

按 `head_sha=d20d7f7cd45199da0b68d9623336d4e69c999223` 过滤，仅 3 条 push run，全部 `completed` / `failure`，均创建于 2026-11-27 20:51:24（Asia/Shanghai）：

| Run ID | Workflow | 路径 | 结论 | URL |
|---|---|---|---|---|
| 46002140249 | Workflow Sanity | `.github/workflows/workflow-sanity.yml` | failure | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46002140249 |
| 46002139768 | Install Smoke | `.github/workflows/install-smoke.yml` | failure | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46002139768 |
| 46002139801 | Delivery SoT alignment | `.github/workflows/delivery-sot-alignment.yml` | failure | https://github.com/flykingvip-cloud/openbot-vp/actions/runs/46002139801 |

`list_check_runs_for_ref` 在该 SHA 上共 5 个 check：`actionlint` failure、`no-tabs` failure、`docs-scope` failure、`forward-only` failure、`install-smoke` **skipped**。失败 job 的共同现象：`steps=[]`，`runner_id=0`，`runner_name=""`，起止间隔约 1–2 秒。对 Run `46002140249` 调用 `get_job_logs` 返回 `github_log_size_unknown` / HTTP 404（“log that is not stored”）。因此：**不能把这些 failure 解释为测试断言失败**；也**不能在没有日志原文的情况下，把原因写成已核实的配额耗尽**。PR #355 正文有“GitHub Actions quota is exhausted”的作者陈述，这是旁证，不是本审计从 Actions 日志读到的原文。

当前 HEAD **没有**成功的完整测试工作流证据。不得把 OpenBot 近期 main 合入当作 CI 绿或生产就绪。

### 2.3 Knowledge SDK：当前 HEAD CI

`list_workflow_runs(branch=main)` 最新一条：

- Run `45536468206`，Workflow `tests`（`.github/workflows/tests.yml`），run_number 31，event `push`
- `head_sha=b953c9922cc1096e0e88455dab6746c01a9d27f9`
- `completed` / **`success`**
- 时间：2026-11-25 10:56:28–10:57:48（Asia/Shanghai；源 `2026-11-25T02:56:28Z`–`02:57:48Z`）
- URL：https://github.com/flykingvip-cloud/knowledge-sdk/actions/runs/45536468206

这只证明 Knowledge SDK **当前 main** 的 tests 工作流成功。参考基线 `9940818` 所在功能分支的 CI 本轮未作为验收依据展开。该成功 **不是** AI Optimization 生产准入证据。

---

## 3. 已阅读文档与路径变化

### 3.1 AI Optimization（均在 `4716abb81a8b15e8b10b80cd04965b69eb7dcc15`）

已存在且已阅读：

- `docs/architecture/AI_OPTIMIZATION_PRODUCT_AND_ARCHITECTURE_CHARTER.md`（文档自称 V1.1，并写“基于 OpenBot Commit `25b6613e6`”；该短 SHA 在 OpenBot 当前仓库无法解析，见 1.2）
- `docs/architecture/PHASE1_REVERIFICATION_REPORT.md`
- `docs/architecture/M4_SANDBOX_INTEGRATION_AND_ACCEPTANCE_CHARTER.md`（基线写成 AI Optimization `24363154a4b8…` + OpenBot `25b6613e6`，早于当前 HEAD）
- `docs/architecture/M4_ACCEPTANCE_REPORT.md`（“补证定稿版”，仍引用 OpenBot `25b6613e6`）
- `docs/architecture/M4_01_CONTRACT_COMPATIBILITY_MATRIX.md`（OpenBot 基线写成 `25b6613e6 (codex/openbot/workspace-seat-binding)`，AI Optimization 基线写成 `eb2ac5a4755363…`，早于当前 HEAD）
- 同目录还存在但本轮仅核对清单、未把其结论当作完成证明：`AOR_MIGRATION_ASSESSMENT.md`、`ARTIFACT_TRUST_MODEL.md`、`DOMAIN_MODEL.md`、`SYSTEM_BOUNDARIES.md`、`PHASE1_STAGE_ACCEPTANCE_AUDIT_f339338.md`、`adr/ADR-001-to-006.md`

**不存在**：`docs/architecture/handover/`。总指令建议的 7 份接管文件在仓库中均未建立。

### 3.2 OpenBot 文档检索结果（当前 HEAD `d20d7f7`）

按总指令要求寻找「OpenBot AI Optimization 专项审计」：

- 总纲声称的归档路径 `docs/architecture/ai-optimization-audit/`：**不存在**（`get_file_contents` HTTP 404）。`docs/architecture/` 当前只有桌面 UI / 多平台 / 单链工具协议文档，没有 AI Optimization 审计副本。
- `docs/audits/` 存在，但均为 2026-11-01 闭环/诊断通知类文档，不是 AI Optimization 专项审计。
- `docs/governance/` 当前只有 `enforced-admission-checklist.md` 与 `shadow-staging-runbook.md`。PR #355 的权限矩阵草稿尚未合入。
- GitHub `search_code`（`repo:flykingvip-cloud/openbot-vp AI Optimization Adapter OR BoundedTelemetryClient OR ai-optimization-audit`）返回 `total_count=0` 且 `incomplete_results=true`。私有仓代码搜索可能未完整建索引，故不能把“搜索 0 条”写成“全仓确认无该字符串”；但已对上述文档目录做了直接列举。

**结论**：在当前 OpenBot `main` 上，专项审计文档**未能找到**。本审计对 OpenBot 侧的判断以当前 HEAD 源码目录核验为准，不以缺失的历史审计文档为准。

### 3.3 Knowledge SDK 文档（当前 `main` `b953c99`）

已阅读：

- `docs/architecture.md`（v1.0.0）：独立知识基础设施；权威在 SDK 的 KB / 文档版本 / ACL / 检索 / Evidence（excerpt + SHA-256 receipt）；权限顺序与租户/组织隔离；SQLite 为核心，向量索引为二次索引；宿主不得把 Host role 直接映射为 KB 管理权。
- `docs/phase1-host-integration.md`：明确网关身份、签名、回放存储是 **host 工作**，不是把知识核心迁入宿主。

同目录还有 `api-contract.md`、`postgres.md`、`vector-integration.md`、`governance-packs.md`、`enterprise-identity-connectors.md`、`mcp-integration.md` 等，用于理解边界，本阶段不要求重构。

---

## 4. 产品边界（源码与文档交叉核对）

三者定位与总指令一致，本轮源码未发现把 Knowledge SDK 职责迁入 AI Optimization 的实现：

- **OpenBot**：生产执行权威。`src/task-outcome/` 仍在；`packages/aor-core/`、`packages/aor-sdk-node/` 仍在（AOR 未被删除）。`packages/evolution-core/src/state-machine.ts` 与 `src/gateway/evolution-control/`（115 个条目，含执行器、账本、canary/rollback-drill 测试）构成 Evolution Control。`src/infra/diagnostic-events.ts` 是进程内诊断事件总线；`extensions/diagnostics-otel/` 是 OpenTelemetry 诊断导出插件，**不是**指向 AI Optimization 的生产 Telemetry 客户端。
- **AI Optimization**：评测 / Dataset / Experiment / 签名制品权威。HTTP API 与服务都在本仓。不得被解释为生产执行器。
- **Knowledge SDK**：独立知识资产、权限、检索、Evidence、Space/KB。IKC/KSG 是后续产品能力，不在本阶段实施范围。

---

## 5. M4-01～M4-07 证据矩阵

分类规则（不得混为一个 Pass）：

- **源码实现**：当前 HEAD 中存在相应实现代码。
- **自动化测试**：仓库中存在针对该主题的测试，且在 CI Run `45932557643` 中被执行。
- **CI 证据**：上述单仓 CI success 覆盖了这些测试。CI 是 AI Optimization **单仓**、`fetch-depth: 1`、无 OpenBot submodule。
- **跨仓联调**：同时使用 OpenBot 仓库真实源码/执行器与 AI Optimization 服务的联合验证。
- **生产环境验证**：真实生产 IdP、生产库、生产执行器或生产流量。当前全部为否。

### M4-01 契约兼容

| 维度 | 判定 | 依据 |
|---|---|---|
| 源码 | 有 | `contracts/json-schema/*`、`contracts/openapi/ai-optimization-v1.yaml`、`tests/contract/contracts.test.ts` |
| 自动化测试 | 有（4 tests，CI 通过） | CI 日志 `tests/contract/contracts.test.ts (4 tests)` |
| CI | 有 | Run `45932557643` |
| 跨仓 | **无** | 兼容性矩阵自己写明 Telemetry 字段“待 OpenBot 侧联调补齐”（缺 W3C `traceparent`/`traceId`、`promptVersion`、`toolPolicyVersion`；`collaboration-satisfaction.ts` 需绑定 `runId`）；Artifact“待 OpenBot 消费适配器接入” |
| 生产 | **无** | 生产准入关闭 |

**文档/契约与 HTTP 实现偏差**（源码核对，不能只信矩阵 “Pass (4/4)”）：

OpenAPI（`contracts/openapi/ai-optimization-v1.yaml`）声明了：`POST /v1/datasets`、`POST /v1/datasets/{datasetId}/versions`、`POST /v1/evaluations/jobs`、`GET /v1/evaluations/{evaluationId}`、`POST /v1/experiments`、`POST /v1/artifacts`、`GET /v1/artifacts/{artifactId}`、`POST /v1/artifacts/{artifactId}/release-requests`、`GET /v1/release-requests/{requestId}` 等。

`services/http-api/src/server.ts` 实际实现的是：`POST/GET /v1/telemetry/events`、`POST` 且 `url.startsWith("/v1/datasets/")`、`POST /v1/evaluations/rules`、`GET .../artifacts/{id}/bundle`、`POST .../artifacts/{id}/revocations`。没有 experiments HTTP、没有创建/查询 Artifact 或 ReleaseRequest 的 HTTP 路由。M4 E2E 通过**进程内** `artSvc.createSignedArtifact` / `expSvc.register` 完成后续步骤。Ajv 校验契约文件通过，**不等于** HTTP 面与 OpenAPI 一致，也不等于 OpenBot Adapter 已消费这些字段。

### M4-02 OIDC / JWKS

| 维度 | 判定 | 依据 |
|---|---|---|
| 源码 | 有（硬化的一部分） | `packages/shared-contracts/src/oidc-jwks.ts`、`packages/shared-contracts/src/auth.ts`、`services/http-api/src/server.ts`（可注入 `oidcClient`） |
| 自动化测试 | 有限（2 tests，CI 通过） | `tests/m4-sandbox/m4-oidc-jwks.test.ts` |
| CI | 有（本地 mock IdP） | Run `45932557643` |
| 跨仓 / 真实 IdP | **无** | 测试使用 `http://127.0.0.1` + `allowInsecureHttpForLocalhost: true` |
| 生产 | **无** | 不得把 localhost 测试写成生产 IdP 通过 |

源码已实现（经阅读 `oidc-jwks.ts`）：Discovery issuer 必须存在且精确匹配；issuer / `jwks_uri` 的 HTTPS（及显式 localhost HTTP 例外）；过滤缺少 `kid`、`use` 且不为 `sig`、`key_ops` 存在但不含 `verify` 的 key；允许 `kty=OKP+crv=Ed25519` 与 `kty=RSA`；`AbortSignal.timeout`；失败负缓存；`inflightRefresh` singleflight。JWT 校验覆盖签名、iss、aud、exp、nbf、`sub`/`tenantId`、服务冒充用户（`actAsUser`）。

源码缺口与测试缺口（对照总指令仍需补强项，以代码为准）：

1. **响应体大小限制不是流式的**：`fetchJsonBounded` 先 `res.text()`，再检查 `Buffer.byteLength`。超大响应会先完整读入内存。
2. **没有 HTTP 重定向目标限制**（使用默认 `fetch`）。
3. **没有 DNS/IP 级 SSRF 防护**，只检查 URL protocol + hostname 是否为 `127.0.0.1`/`localhost`。
4. 第二个测试标题为 “rejects missing discovery issuer, non-HTTPS jwks_uri, oversized JWKS, and enforces negative cache”，**实际体只覆盖**：非 HTTPS issuer（`http://evil.example.com`）、Discovery 缺 issuer + 负缓存。**没有**独立的“HTTPS issuer + 非 HTTPS `jwks_uri`”用例，也**没有** oversized JWKS 用例。
5. 第一个测试标题含 “rejects expired/cross-tenant tokens”，体中有跨租户 `403`，**没有**过期令牌断言（过期逻辑在 `auth.ts`，可能由 `security-and-auth.test.ts` 覆盖，但不在本 OIDC 文件中）。
6. 未见独立的超时、非法 JSON、无效 JWK、算法不匹配、并发刷新、恶意 JWKS 响应测试。
7. 验收报告写 “Pass (2/2)（限本地测试 IdP）” —— 这一限定本身正确，但标题/报告对未写进测试体的场景有过声称风险。

### M4-03 Telemetry WAL

| 维度 | 判定 | 依据 |
|---|---|---|
| 源码 | 有（临时文件 + `fsyncSync` + `renameSync`，有容量淘汰与损坏行忽略） | `packages/telemetry-sdk/src/index.ts` |
| 自动化测试 | 有限（同文件 1 个 E2E 中的 WAL 段 + `persistence-wal-perf.test.ts` 3 tests） | `m4-full-sandbox-e2e.test.ts`、CI 日志 |
| CI | 有（模拟损坏尾行，非 SIGKILL / 非断电） | Run `45932557643` |
| 跨仓 | **无** | Client 在 AI Optimization 测试进程内构造，不是 OpenBot 运行时外发 |
| 生产 | **无** | 不得把模拟崩溃写成断电一致性通过 |

测试实际行为（`m4-full-sandbox-e2e.test.ts`）：Client A 在服务不可用时写入 WAL，然后 `fs.appendFileSync(walPath, '{"corrupt_partial_crash":')` 模拟损坏尾部；Client B 从同一路径恢复并补发；服务端幂等返回 `202 { status: "accepted", duplicate: true }`。

源码观察：

- 有字段白名单 `ALLOWED_PAYLOAD_FIELDS` 与脱敏 `redactText`。
- `persistWalAtomic`：写 `*.tmp.${pid}`，`fsyncSync` 文件，然后 `renameSync`。**未见父目录 fsync**。注释写 “crash-consistent atomic disk WAL”，但按总指令不得未经验证就声称完整断电一致性。
- 恢复时跳过无法 JSON.parse 的行并增加 `walWriteErrorCount`；**不处理遗留临时文件**。
- **无**同一 WAL 路径的并发实例锁。
- 容量上限通过驱逐最旧记录实现，有 `droppedCount`。
- 未见真正的子进程 `SIGKILL`、写入中断、部分批次成功恢复测试。

### M4-04 Dataset HTTP 治理

| 维度 | 判定 | 依据 |
|---|---|---|
| 源码 | 有 | `services/dataset-management/src/index.ts`、`scanner.ts`、HTTP 路由 |
| 自动化测试 | 有（E2E 内：201 / 409 / 400 PII / 403 跨租户；另有 evaluation HTTP 201 与进程内 experiment） | `m4-full-sandbox-e2e.test.ts` |
| CI | 有 | Run `45932557643` |
| 跨仓 | **无** | 数据来自测试构造，不是 OpenBot 授权运行数据 |
| 生产 | **无** | |

源码：tenant 取自鉴权上下文；case `tenantId` 必须匹配；不可变版本；未授权来源拒绝；`pending_review` 拒绝；扫描 `riskLevel===high` 拒绝；`train_candidate` 与 golden/evaluation contentHash 防污染。HTTP 将 `tenant_mismatch` 映射 403、`version_immutable` 映射 409、其余治理错误 400。

残留：HTTP 路径是 `startsWith("/v1/datasets/")`，与 OpenAPI 的 `/versions` 资源设计不一致；`deleteVersion` 存在但本轮 M4 测试未覆盖；扫描绕过路径与 golden 写入保护需在后续复核，不得仅为加测试而改语义。Evaluation 在 E2E 中调用 `POST /v1/evaluations/rules`，与 OpenAPI 的 `/v1/evaluations/jobs` 不一致。Experiment 在 E2E 中走进程内 `ExperimentEngineService`，无 HTTP。

### M4-05 Artifact

| 维度 | 判定 | 依据 |
|---|---|---|
| 源码 | 有 | `services/artifact-registry/src/index.ts`：`canonicalSigningBytes` 排除 `signature` 与可变 `revocationStatus`，其余含 `approvalPolicy`、tenant、scope、epoch、rollback 目标等；`verifyForOpenBot` 校验租户、agent、撤销、过期、epoch 重放、版本范围、人工审批、contentHash、Ed25519 签名 |
| 自动化测试 | 有（`secondary-audit-remediation.test.ts` 5 tests + E2E 中的 bundle/410/verify） | CI 日志 |
| CI | 有 | Run `45932557643` |
| 跨仓 | **无** | `verifyForOpenBot` 在 AI Optimization 测试进程内调用，OpenBot 侧无消费适配器 |
| 生产 | **无** | 未见生产密钥管理、公钥轮换基础设施或生产撤销通道 |

HTTP 层：撤销后 `GET /bundle` 返回 410。创建签名制品无 HTTP，私钥由测试注入。`revokedIds` / DB 更新存在；公钥仅在进程内 `registerTrustedKey`。

### M4-06 OpenBot 状态机

| 维度 | 判定 | 依据 |
|---|---|---|
| 源码（AI Optimization 测试辅助） | 有加载器，但 CI 走冻结表 | `tests/m4-sandbox/m4-full-sandbox-e2e.test.ts` 中 `loadOpenBotTransitionFn()` |
| 源码（OpenBot 真实状态机） | 有，且比冻结表更完整 | `packages/evolution-core/src/state-machine.ts` @ `d20d7f7` |
| 自动化测试 | 有（冻结表路径） | 同一 E2E：`apply_canary → CANARY`、撤销、HTTP 410、`rollback → ROLLED_BACK`、终态不能 promote、回传 `deployment.rollback.completed`、撤销幂等 |
| CI | 有，但 **不能证明 CI 运行了 OpenBot 真实实现** | checkout 仅本仓、`fetch-depth: 1`；本地路径为 `../../../openbot/packages/evolution-core/src/state-machine.ts`（目录名 `openbot` 而非 `openbot-vp`），CI 中该文件不存在，因此走冻结表 |
| 跨仓 | **无** | 未调用 OpenBot Evolution Control 执行器，未恢复真实 `rollbackTargetArtifactId` 到 OpenBot 生产状态存储 |
| 生产 | **无** | |

冻结表与当前 OpenBot HEAD 真实 `transitionEvolutionProposal` **并不等价**：

- 真实表包含 `HELD`、`ACTIVE`、`reject`/`expire`/`revoke`/`hold`/`activate`/`rollback_drill` 等；冻结表只是子集。
- 真实函数失败返回包含 `reason`；冻结函数没有。
- `EVOLUTION_TERMINAL_STATUSES` = `REJECTED | ROLLED_BACK | EXPIRED | REVOKED | PROMOTED`。终端态除 `rollback` 外拒绝。冻结表有 `"ROLLED_BACK:rollback" → ROLLED_BACK`（幂等）；真实 `TRANSITIONS` **没有** `ROLLED_BACK:rollback`，终端检查允许 rollback 通过后会落到 `illegal_transition`。这是冻结实现与当前真实状态机的行为差。E2E 未覆盖该分支。
- Evolution Control 执行器、适配器、canary/rollback-drill 测试在 OpenBot 仓内存在，但适配器是 `capsule` / `organization` / `runtime-governance` / `skill` / `working-dna` / `fail-closed`，**没有** AI Optimization Artifact 消费适配器。

验收报告将 M4-06 写成 **Pass**，同时在正文承认“CI 用等价冻结状态机”。按总指令，这只能记为“沙箱内冻结表测试通过”，**不能**记为真实状态机或 Evolution Control 执行器通过，更不能记为生产联调通过。

### M4-07 联合验收报告

| 维度 | 判定 | 依据 |
|---|---|---|
| 源码/文档 | 报告文件存在 | `docs/architecture/M4_ACCEPTANCE_REPORT.md` |
| 自动化测试 | 不适用（文档交付） | — |
| CI | 文档随 `4716abb` 进入成功 CI，但不验证报告主张的正确性 | — |
| 报告自我结论 | “M4 沙箱阶段：通过；生产环境全量准入：保持关闭” | 报告第三节 |
| 本轮独立复核 | 沙箱单仓测试与 CI **确实存在且成功**；但报告矩阵把 M4-01～07 一律写成 Pass，弱化了冻结状态机、OpenAPI/HTTP 偏差、OIDC 测试标题过声称、WAL 非真实崩溃等问题。引用的 OpenBot SHA `25b6613e6` 当前无法解析。 | 本审计 |

---

## 6. OpenBot：Adapter 与生产 Telemetry（当前 HEAD）

| 问题 | 结论 | 证据 |
|---|---|---|
| 是否已有 AI Optimization Adapter | **未发现** | `src/gateway/evolution-control/adapters/` 仅有 capsule、fail-closed、organization、runtime-governance、skill、working-dna。无 artifact bundle 验签/消费适配器。 |
| 是否已有生产 Telemetry 发送到 AI Optimization | **未发现** | `BoundedTelemetryClient` 只存在于 AI Optimization 仓。OpenBot `diagnostic-events.ts` 为进程内总线；`extensions/diagnostics-otel` 为 OTel 诊断导出，不是对 `/v1/telemetry/events` 的脱敏异步外发。兼容性矩阵也写明字段待补齐。 |
| Evolution Control / evolution-core | **存在且在演进** | 真实状态机 + 大型 `evolution-control` 目录（control-plane、ledger、observation、rollback-drill 等）。这是 OpenBot 自有治理，不是已完成的跨仓 Artifact 闭环。 |
| AOR | **仍在** | `packages/aor-core`、`packages/aor-sdk-node` 等。不得删除。 |
| TaskOutcome | **仍在** | `src/task-outcome/`。不得在 AI Optimization 复制第二套权威账本。 |

---

## 7. 可能的架构偏差与未完成工作

1. **生产准入必须保持关闭。** 前任报告与 Phase 1 复验、M4 验收报告均如此声明；本轮核验同意，且条件未满足。
2. **M4 报告 Pass 与证据层级不对齐**（冻结状态机、单仓 CI、localhost IdP、SQLite、模拟 WAL 损坏）。
3. **OpenAPI 与 HTTP 实现面不一致**；契约测试可能只校验 schema 文件。
4. **OpenBot 历史基线 `25b6613e6` 无法解析**，以该 SHA 为冻结依据的文档追溯链断裂。
5. **Knowledge SDK 联合审计参考提交不在 main**，比 main 超前 46 个未合入提交。理解边界时应同时标注“当前默认分支 HEAD”与“未合入 Wave2 分支”，不要混用。
6. **AI Optimization HTTP 未实现 ReleaseRequest 闭环**；OpenBot 也未消费 Artifact。标准闭环第 5–10 步在跨仓层尚未落地。
7. **SQLite ≠ PostgreSQL。** `packages/shared-contracts/src/db.ts` 使用 `node:sqlite`，迁移仅 `CORE_MIGRATIONS` v1。CI 明确跑在 SQLite。
8. **OIDC/JWKS 与 WAL 的指令所列剩余缺口仍然存在**（见第 5 节）。
9. **OpenBot 当前 HEAD 的 Actions 未提供成功测试证据**（失败 job 无 runner、无日志）。
10. **文档权威分叉风险**：接管文件应进入 `docs/architecture/handover/` 或更新原 M4 报告，避免聊天结论成为第二套权威。

---

## 8. 本轮明确未做 / 未能验证的事项

- 未 clone、未在本地执行 `pnpm run check` 或任何测试；测试数量仅来自 CI 日志。
- 无法观察任何开发者本地工作区是否干净。
- 无法解析 OpenBot `25b6613e6`；未能在当前 OpenBot main 找到专项审计文档。
- OpenBot HEAD 的失败 job 日志无法读取，失败根因未在 Actions 原文中核实。
- GitHub 对私有仓 `search_code` 结果不完整，未做全仓字符串穷尽搜索。
- 未连接、未验证任何生产 IdP、生产 PostgreSQL 或生产环境。
- 未审核 Knowledge SDK `feat/align-wave2-m2-min-slice` 的 46 个超前提交内容（仅确认其相对 main 的位置）。

---

## 9. 审计结论（给负责人）

当前可冻结的工程基线是：

- AI Optimization `main` = `4716abb81a8b15e8b10b80cd04965b69eb7dcc15`，CI Run `45932557643` success，Vitest **8 files / 26 tests** 在该 SHA 上通过。
- OpenBot `main` = `d20d7f7cd45199da0b68d9623336d4e69c999223`，已超越历史参考 `58287aa` 共 23 个提交；无 AI Optimization Adapter / 无生产 Telemetry 外发；HEAD CI 未成功。
- Knowledge SDK `main` = `b953c9922cc1096e0e88455dab6746c01a9d27f9`，tests Run `45536468206` success；联合审计 SHA `9940818` 在未合入分支上。

M4 沙箱在 **AI Optimization 单仓、SQLite、本地 mock IdP、冻结状态机** 条件下有源码、测试和 CI 证据。这不是跨仓联调通过，更不是生产准入通过。后续实施必须按 Phase 1–5 补齐证据，并在负责人确认后再改跨仓接口、安全策略、Schema 或生产行为。
