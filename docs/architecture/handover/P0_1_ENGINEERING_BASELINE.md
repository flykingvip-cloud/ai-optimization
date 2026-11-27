# P0-1 阶段基线记录（Engineering Complete）

- 文档性质：把负责人确认的 P0-1 当前状态记为阶段基线。这不是独立安全审查通过证明，不是生产 IdP 联调通过证明，也不是生产准入申请。
- 仓库：`flykingvip-cloud/ai-optimization`
- 分支：`feat/p0-1-oidc-jwks-security`
- PR：https://github.com/flykingvip-cloud/ai-optimization/pull/2 （记录时为 OPEN，`base=main`，未合并）
- 冻结 `origin/main`：`4716abb81a8b15e8b10b80cd04965b69eb7dcc15`
- 本轮工程完成基线 SHA：`b0de71b4bfdc8432c96293ba4e85c4307888a9b3`
- 记录日期：2026-11-28（Asia/Shanghai）
- 生产准入：保持关闭
- P0-2：尚未开始，本轮不启动

## 1. 审前 SHA 核对

2026-11-28 开始独立审查前已 `git fetch origin feat/p0-1-oidc-jwks-security main`。结果：

| 引用 | SHA | 结论 |
| --- | --- | --- |
| 本地 `HEAD`（`feat/p0-1-oidc-jwks-security`） | `b0de71b4bfdc8432c96293ba4e85c4307888a9b3` | 与约定的工程完成基线一致 |
| `origin/feat/p0-1-oidc-jwks-security` | `b0de71b4bfdc8432c96293ba4e85c4307888a9b3` | 分支在审前未前进 |
| `origin/main` | `4716abb81a8b15e8b10b80cd04965b69eb7dcc15` | 冻结基线仍成立 |
| PR #2 `head` | `b0de71b4bfdc8432c96293ba4e85c4307888a9b3` | OPEN，未合并 |

因此本文件将 `b0de71b` 作为 P0-1 的 Engineering Complete 基线。若本文件随后以新提交写入该分支，新 HEAD 会前进，但不改变上述工程完成基线 SHA 的含义。

相对冻结 main，该基线包含 3 个提交：

1. `0d315d376b617e5c552d6282298952d6a6eeb88f` — 代码与测试
2. `c212a4563a055d5de709f39bafe25ace448332bc` — 复验报告初稿
3. `b0de71b4bfdc8432c96293ba4e85c4307888a9b3` — 记录 CI run `46023375682`（针对 `c212a45`）

## 2. 三层阶段门禁（不得混淆）

必须继续使用三个不同的状态。不得把下层证据写成上层通过。将来若合并 PR，也只代表代码进入主分支，不代表生产安全验收通过。

| 门禁 | 含义 | 本阶段基线结论 |
| --- | --- | --- |
| Engineering Complete | 代码、测试和 CI 证据通过 | **已达到。** 这是本文件记录的唯一通过层。 |
| Integration Accepted | 真实 IdP、跨仓调用和目标基础设施验证通过 | **未达到。** 真实生产 IdP 联调未完成。 |
| Production Accepted | 安全、可靠性、运维和发布门禁全部通过 | **未达到。** 生产准入保持关闭。 |

## 3. 负责人确认的验收项

下列实现项已对照 `packages/shared-contracts/src/oidc-jwks.ts` 在基线 SHA `b0de71b` 上复核，不是对未经验证保证的照抄。

| 验收项 | 状态 | 源码依据（基线 `b0de71b`） |
| --- | --- | --- |
| 冻结基线 `4716abb` | 已确认 | 审前 fetch 后 `origin/main` 仍为该 SHA |
| 独立分支 `feat/p0-1-oidc-jwks-security` | 已建立 | 本地与远端均指向 `b0de71b` |
| 当前提交 `b0de71b` | 作为本轮工程完成基线 | 审前 HEAD 未变 |
| 流式响应体大小限制 | 已实现 | `readResponseBodyBounded` 按块累计，超过 `maxResponseBytes`（默认 256 KiB）后 `cancel` 并拒绝；默认出站路径设置 `Accept-Encoding: identity` |
| 独立拒绝非 HTTPS `jwks_uri` | 已实现 | Discovery 得到 `jwks_uri` 后、拉取 JWKS 前调用 `assertTrustedUrl`；HTTPS issuer 下的 HTTP `jwks_uri` 仍被拒绝 |
| 重定向限制 | 已实现 | `redirect: "manual"` / `pinnedFetch` 不自动跟随；最多 `maxRedirects`（默认 3）；拒绝 HTTPS→HTTP 降级；每跳对 Location 再执行 `assertTrustedUrl`，并取消未消费响应体 |
| 默认要求受信任主机 | 已实现 | `allowedJwksHosts` 缺省为空；未列入的主机不可达。`allowInsecureHttpForLocalhost` 仅显式开启时放行 `localhost` / `127.0.0.1` / `::1` |
| 本地检查 | 实施时报告 8 个文件 / 40 个测试通过；本轮在基线 SHA 上复跑亦通过 | 见第 4 节 |
| HEAD CI verify | 已再次核对：成功 | 见第 5 节 |
| PR #2 | 已创建，未合并 | https://github.com/flykingvip-cloud/ai-optimization/pull/2 |
| 真实生产 IdP 联调 | 未完成 | 本基线不改变该结论 |
| 生产准入 | 关闭 | 本基线不改变该结论 |
| P0-2 | 尚未开始，本轮不启动 | 本基线不启动 Telemetry WAL 工作 |

## 4. 本地检查复跑

命令在仓库根目录、检出 `b0de71b` 时执行。环境：Node v24.22.1、pnpm v10.34.6。时间：2026-11-28 07:32 CST（Asia/Shanghai）。

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
      Tests  40 passed (40)
   Start at  07:32:31
   Duration  346ms
```

与实施时报告的 8 个文件 / 40 个测试通过一致。测试未连接任何生产 IdP。该结果只支持 Engineering Complete，不能上推为 Integration Accepted 或 Production Accepted。

## 5. HEAD CI verify 再核对

此前用户报告的 HEAD CI 为 run `46023943679`。2026-11-28 再次通过 GitHub Actions API 核对，结论不变：

- Workflow：`CI`
- Event：`pull_request`
- Job：`verify`
- Run ID：`46023943679`
- URL：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46023943679
- SHA：`b0de71b4bfdc8432c96293ba4e85c4307888a9b3`
- 状态：`completed` / `success`
- 完成时间：2026-11-27 23:20:09 CST（Asia/Shanghai；Actions 时间戳为 2026-11-27T15:20:09Z）

成功步骤包括 TypeScript typecheck、测试作业、`pnpm audit`（high/critical 门禁）和 secret scanning。该结果证明本仓 CI 工作流在工程完成基线 SHA 上通过，不是生产 IdP 联调通过，也不是生产准入。

同一 SHA 上更早记录的成功 run `46023375682` 针对的是 `c212a45`，不得与 HEAD run `46023943679` 混用。

## 6. 本基线明确不包含的结论

- 独立安全审查在记录本基线时尚未结束；审查结论与残留风险以随后更新的 `OIDC_JWKS_SECURITY_REVERIFICATION_REPORT.md` 为准，不得预先写成已通过。
- 不得把 `fetchFn` 测试路径上的 URL 预校验写成自定义 fetch 已被套接字级 IP 钉扎。
- 不得把本仓 CI 成功写成跨仓联调或目标基础设施验证通过。
- 本文件不授权合并 PR #2，不启动 P0-2，不放开生产准入。
