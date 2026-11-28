# P0-1 合并后 main 工程基线记录

- 文档性质：把 PR #2 合并后的 `main` 状态记为新的工程基线。这是合并后的只读核验记录，不是独立安全审查的更新结论，不是真实 IdP 联调通过证明，也不是生产准入申请。
- 仓库：`flykingvip-cloud/ai-optimization`
- 核验对象：`origin/main` HEAD `4e5cd8a047686eaec662332e5d50b646a46b2516`
- 合并提交说明：`Merge pull request #2 from flykingvip-cloud/feat/p0-1-oidc-jwks-security`
- PR #2：https://github.com/flykingvip-cloud/ai-optimization/pull/2 （核验时为 `MERGED`）
- 合并时间：2026-11-28 09:25:30 CST（Asia/Shanghai）
- 本文件记录日期：2026-11-28（Asia/Shanghai）
- 工程阶段：Engineering Complete
- 生产准入：保持关闭
- P0-2：未启动，本轮不启动
- 相关历史记录：`docs/architecture/handover/P0_1_ENGINEERING_BASELINE.md` 是合并前的工程完成基线（工程完成 SHA `b0de71b`，记录时 PR #2 仍为 OPEN）。本文件不改写该历史记录。

- 第 1–6 节是 2026-11-28 对合并提交 `4e5cd8a047686eaec662332e5d50b646a46b2516` 的历史快照，不得因后续 `main` 前进而改写。第 7 节记录该快照之后的状态。

## 1. 负责人确认的状态表

下列状态在 2026-11-28 对合并后 `main` 做只读核验后确认，不改变生产准入关闭的结论。

| 项目 | 当前状态 |
| --- | --- |
| PR #2 | 已合并 |
| 合并提交 | `4e5cd8a047686eaec662332e5d50b646a46b2516` |
| 合并时间 | 2026-11-28 09:25:30 CST（Asia/Shanghai） |
| 工程阶段 | Engineering Complete |
| 真实 IdP 联调 | 未完成 |
| 生产验收 | 未通过 |
| 生产准入 | 关闭 |
| P0-2 | 未启动 |
| 部署 / 生产接入 | 未启动 |
| PR #1 | 仍开放，未处理 |

## 2. 三层阶段门禁（不得混淆）

必须继续使用三个不同的状态。不得把下层证据写成上层通过。P0-1 合并仅代表代码进入 `main`，不提升生产准入状态。

| 门禁 | 含义 | 本基线结论 |
| --- | --- | --- |
| Engineering Complete | 代码、测试和 CI 证据通过 | **已达到。** 这是本文件记录的唯一通过层。 |
| Integration Accepted | 真实 IdP、跨仓调用和目标基础设施验证通过 | **未达到。** 真实生产 IdP 联调未完成。 |
| Production Accepted | 安全、可靠性、运维和发布门禁全部通过 | **未达到。** 生产准入保持关闭。 |

## 3. 后续执行边界

1. P0-1 合并仅代表代码进入 `main`，不提升生产准入状态。
2. PR #1 是独立审批项，不随 PR #2 一并处理。本轮核验确认 https://github.com/flykingvip-cloud/ai-optimization/pull/1 仍为 `OPEN`，未处理、未合并、未 rebase。
3. P0-2 必须单独评估、明确范围并取得授权。本轮不启动。
4. 任何部署、生产 IdP 接入、生产数据库变更或流量切换，仍须事先单独审批。本轮未启动部署或生产接入。

## 4. 必须保留的审查边界

独立安全审查已在合并前完成，结论仍适用。本轮只核验相关实现仍在合并后的 `main` 源码中，不把本文件写成一次新的完整安全审查。

1. 默认出站路径：已校验地址进行 IP 钉扎，重定向逐跳重新执行完整校验。
2. 自定义 `fetchFn`：仍可能绕过 IP 钉扎，不能将其描述为已具备同等 SSRF 防护。
3. 重复 `kid`：冲突密钥现在失败关闭，属于已修复的安全缺陷。
4. CI 成功：证明当时分支 / 该 SHA 通过了现有自动化检查，不等于真实 IdP 联调或生产安全验收。

## 5. 只读核验证据

核验在 2026-11-28 于本地仓库 `/workspace/repos/ai-optimization` 执行。先 `git fetch origin`，再对照 `origin/main`、GitHub PR 与 GitHub Actions 的实际命令结果。下列 SHA、时间与 URL 均来自实测，不是对先前口头报告的转抄。

### 5.1 `origin/main` HEAD 与合并提交

`git fetch origin` 后：

```text
git rev-parse origin/main
# 4e5cd8a047686eaec662332e5d50b646a46b2516

git log -1 --format='%H%n%s%n%cI' origin/main
# 4e5cd8a047686eaec662332e5d50b646a46b2516
# Merge pull request #2 from flykingvip-cloud/feat/p0-1-oidc-jwks-security
# 2026-11-28T09:25:30+08:00
```

结论：`origin/main` HEAD 仍为约定的合并提交 `4e5cd8a047686eaec662332e5d50b646a46b2516`，核验时 `main` 未继续前进。`git merge-base --is-ancestor 4e5cd8a047686eaec662332e5d50b646a46b2516 origin/main` 退出码为 0。

提交者时间戳为 `2026-11-28T09:25:30+08:00`。`gh pr view 2` 返回 `state=MERGED`，`mergedAt=2026-11-28T01:25:30Z`，`mergeCommit.oid=4e5cd8a047686eaec662332e5d50b646a46b2516`。将 `2026-11-28T01:25:30Z` 转换到 Asia/Shanghai 后为 `2026-11-28 09:25:30 CST`，与提交者时间戳一致。

相对冻结基线 `4716abb81a8b15e8b10b80cd04965b69eb7dcc15`，合并后的 `main` 还包含以下历史（由新到旧）：

1. `4e5cd8a047686eaec662332e5d50b646a46b2516` — Merge pull request #2
2. `8693d70` — docs(architecture): record P0-1 independent security review findings
3. `af6fbc95a9215cce90d1ddcf813305932f9940bb` — security(oidc): reject JWKS documents with conflicting duplicate kids
4. `b505624` — docs(architecture): record P0-1 Engineering Complete baseline
5. `b0de71b4bfdc8432c96293ba4e85c4307888a9b3` — docs(architecture): record successful P0-1 CI run 46023375682
6. `c212a45` — docs(architecture): add OIDC/JWKS P0-1 security re-verification report
7. `0d315d3` — security(oidc): harden JWKS fetch limits, redirects, and SSRF controls

其中 `b0de71b` 仍是合并前记录的 Engineering Complete 基线 SHA；本文件的工程基线是合并后的 `main` HEAD `4e5cd8a`。

### 5.2 合并后 `main` 上的 GitHub Actions CI

查询命令：`gh run list --repo flykingvip-cloud/ai-optimization --commit 4e5cd8a047686eaec662332e5d50b646a46b2516`，并交叉核对 `--branch main --event push`。

该 SHA 在核验时只有 **1** 条 run，并且是推送到 `main` 的 CI，不是 PR 分支上的 run `46083308287`。不得把 PR CI 成功写成合并后 `main` CI 成功。

| 项 | 实测结果 |
| --- | --- |
| Run | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46093043457 |
| 工作流 | CI（`.github/workflows/ci.yml`，`name: CI`） |
| 事件 | `push` |
| `headBranch` | `main` |
| `headSha` | `4e5cd8a047686eaec662332e5d50b646a46b2516` |
| 作业 | `verify`（job `140818100734`） |
| 作业 URL | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46093043457/job/140818100734 |
| 作业结论 | `success`（`status=completed`） |
| 工作流结论 | `success`（`status=completed`） |
| 创建时间 | 2026-11-28T01:25:33Z = 2026-11-28 09:25:33 CST（Asia/Shanghai） |
| 作业开始 | 2026-11-28T01:25:35Z = 2026-11-28 09:25:35 CST（Asia/Shanghai） |
| 完成时间 | 2026-11-28T01:25:52Z = 2026-11-28 09:25:52 CST（Asia/Shanghai） |

作业 `verify` 中与检查相关的步骤（typecheck、测试、依赖审计、密钥扫描）结论均为 `success`。该结果只证明合并提交通过了现有自动化检查，不等于真实 IdP 联调或生产安全验收。

### 5.3 关键安全修复仍在 `origin/main` 源码中

对照文件：`packages/shared-contracts/src/oidc-jwks.ts`、`tests/m4-sandbox/m4-oidc-jwks.test.ts`（均为 `origin/main` 上 `4e5cd8a` 的内容）。

#### 冲突重复 `kid`：失败关闭；相同材料可重复

`git merge-base --is-ancestor af6fbc95a9215cce90d1ddcf813305932f9940bb origin/main` 退出码为 0；`origin/main` 与 `origin/HEAD` 均包含该修复提交（`security(oidc): reject JWKS documents with conflicting duplicate kids`，提交时间 2026-11-28T07:33:32+08:00）。

在 `OidcJwksClient.refreshKeys()` 中，解析 JWKS 时若同一 `kid` 对应不同 PEM 材料，会记入 `conflictingKids`、删除已缓存的该 `kid`，并在刷新结束时抛出 `AuthError("invalid_signature", "JWKS contained duplicate kid values with conflicting key material")`，使整份 JWKS 刷新失败。相同材料的重复 `kid` 不会进入冲突集合，可以保留。依据：`packages/shared-contracts/src/oidc-jwks.ts` 约第 628–654 行。

对应测试仍在：

- 第 640 行：`rejects a JWKS document that reuses a kid with different key material and does not accept either key`
- 第 686 行：`accepts duplicate JWKS entries that share a kid and identical key material`

#### 默认出站路径：已校验地址做 IP 钉扎；重定向逐跳重新完整校验

默认出站不走未绑定地址的 `fetch`，而走 `pinnedFetch()`（约第 316 行）。该函数把已校验地址写入请求的 `hostname: address`（第 341 行），并在 HTTPS 且目标名不是 IP 时设置 `servername`（第 356 行），从而把连接钉在校验过的地址上。`fetchOnce()` 仅在未提供自定义 `fetchFn` 时调用 `pinnedFetch`（第 534–540 行）。

重定向由 `fetchJsonBounded()` 手动跟随（约第 549–596 行）：不自动跟随；超过 `maxRedirects`（默认 3）则失败；拒绝 HTTPS 到 HTTP 降级（第 574 行）；每一跳都对 `Location` 重新执行 `assertTrustedUrl(..., "OIDC/JWKS redirect target")`（第 576 行），即主机允许列表、协议与解析地址的完整校验。对应测试包括第 388 行「rejects HTTPS to HTTP redirects and redirects to a private or metadata address」。

本轮确认的是上述逻辑仍在合并后的 `main` 源码中，不是对 TOCTOU / DNS rebinding 的新一轮完整再证明。

#### 自定义 `fetchFn`：仍可能绕过 IP 钉扎

`OidcJwksOptions.fetchFn` 的注释写明：URL、允许列表与已解析地址会在调用前校验，但校验过的地址不会绑定到 socket。若自定义 `fetchFn` 忽略 `redirect: "manual"`、自行做 DNS 查找，或连接到其他地址，则不受 IP 钉扎。依据：`packages/shared-contracts/src/oidc-jwks.ts` 第 49–57 行，以及 `fetchOnce()` 第 537–538 行只把 `url` 传给 `fetchFn`，不传入已校验地址。

**不得**把自定义 `fetchFn` 路径写成已具备与默认出站路径同等的 SSRF 防护。

#### P0-1 已合入的其他行为

- 流式响应体限长：`readResponseBodyBounded()`（第 285 行）按块累计，超过 `maxResponseBytes`（构造函数默认 256 KiB）后取消流并拒绝。对应测试第 442 行。默认出站还设置 `Accept-Encoding: identity`（第 348 行）。
- 独立拒绝非 HTTPS `jwks_uri`：Discovery 取得 `jwks_uri` 后、拉取 JWKS 前调用 `assertTrustedUrl(disc.jwks_uri, "OIDC jwks_uri")`（第 619 行）。`assertTrustedUrl()`（第 503 行）在非 HTTPS（且未显式打开 localhost HTTP 例外）时抛出 `${context} must use HTTPS`。对应测试第 303 行：即使 Discovery issuer 是 HTTPS，HTTP `jwks_uri` 仍被拒绝。
- 默认 `allowedJwksHosts` 为空：构造函数第 447 行为 `options.allowedJwksHosts ?? []`。文件头注释与选项注释写明缺省不允许任意远程 IdP，直到运营方列出受信任主机。对应测试第 330 行：未在允许列表中的公网 HTTPS 主机被拒绝。

### 5.4 本地复跑 `pnpm run check`

在清洁工作树、检出 `4e5cd8a047686eaec662332e5d50b646a46b2516` 时执行。环境：Node v24.22.1、pnpm v10.34.6。时间：2026-11-28 10:46:33–10:46:36 CST（Asia/Shanghai）。未为此修改代码。

```text
$ pnpm run check

> @openbot/ai-optimization@0.1.0 check
> pnpm run typecheck && pnpm run test

> @openbot/ai-optimization@0.1.0 typecheck
> tsc --noEmit

> @openbot/ai-optimization@0.1.0 test
> vitest run

 RUN  v5.1.2 /workspace/repos/ai-optimization

 Test Files  8 passed (8)
      Tests  42 passed (42)
   Start at  10:46:36
   Duration  409ms

EXIT=0
```

该结果只证明当前 `main` 工作树通过了仓库现有的 `typecheck` 与单元/合同测试，不等于真实 IdP 联调或生产验收。

### 5.5 PR #1 状态

`gh pr view 1 --repo flykingvip-cloud/ai-optimization` 在核验时返回：

- `state=OPEN`
- `isDraft=false`
- `baseRefName=main`
- `headRefName=docs/phase0-handover-baseline`
- URL：https://github.com/flykingvip-cloud/ai-optimization/pull/1

本轮未处理、未合并、未 rebase 该 PR。

## 6. 本基线不证明的事项

- 不证明 Integration Accepted 或 Production Accepted。
- 不证明已完成真实生产 IdP 联调、跨仓集成或目标环境验证。
- 不授权部署、生产 IdP 接入、生产数据库变更、流量切换或开放生产准入。
- 不授权启动 P0-2。
- 自定义 `fetchFn` 路径的 SSRF 防护与默认出站路径不等价。
- 合并后 `main` CI run `46093043457` 成功，只说明该 SHA 通过了现有自动化检查。

## 7. 后续状态说明

本节记录第 1–6 节历史快照之后的状态，不改写该快照，也不把后续变化写成该快照当日的核验结果。本节仍不是真实 IdP 联调通过证明，不是生产验收，也不是一次新的安全审查。

快照记录之后，PR #1 作为独立审批项获得单独授权并已合并。

- 合并提交：`c5779f20c8f9011396cd0aea299f8c2b9cd9e240`
- 合并说明：`Merge pull request #1 from flykingvip-cloud/docs/phase0-handover-baseline`
- 合并时间：2026-11-28 11:52:03 CST（Asia/Shanghai）（`2026-11-28T03:52:03Z`）
- 父提交：`4e5cd8a047686eaec662332e5d50b646a46b2516` 与 `3f9e97ef49f45bf729786f0db7ffbbefa37371ff`
- 该合并带入 `main` 的文件：`docs/architecture/handover/AGENT_HANDOVER_BASELINE_AUDIT.md`、`docs/architecture/handover/PHASE0_EXECUTION_PLAN.md`
- 该合并提交推送到 `main` 的 CI：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46104874648 （工作流 `CI`，事件 `push`，作业 `verify`，结论 `success`，完成时间 2026-11-28T03:52:20Z = 2026-11-28 11:52:20 CST（Asia/Shanghai））

截至本说明撰写时，`origin/main` HEAD 为 `c5779f20c8f9011396cd0aea299f8c2b9cd9e240`。这不改变第 1–6 节对合并提交 `4e5cd8a` 的历史快照，也不提升生产准入状态。生产准入保持关闭。Engineering Complete 仍是唯一已通过的门禁；Integration Accepted 与 Production Accepted 均未达到。

本文件所在的 PR #3 仍未合并。

同日稍后，负责人另外授权在独立功能分支上开展 P0-2 Telemetry WAL 工作（实现、测试，并开设 PR）。该授权不合并该 PR，不启动部署，也不开放生产准入。P0-2 不得被写成已完成，也不得被写成已在 `main` 上启动。该 PR 的合并、部署与生产接入仍须事先单独审批。生产准入保持关闭。
