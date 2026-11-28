# TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md

- **文档性质**：P0-2 Telemetry WAL 崩溃一致性的工程证据。这不是生产验收通过证明，不是断电耐久性通过证明，也不是生产准入申请。
- **仓库**：`flykingvip-cloud/ai-optimization`
- **分支**：`feat/p0-2-telemetry-wal`
- **PR**：https://github.com/flykingvip-cloud/ai-optimization/pull/4 （OPEN，`base=main`，**未合并**，未获合并授权）
- **基线 `origin/main`（本分支建立时）**：`c5779f20c8f9011396cd0aea299f8c2b9cd9e240`
- **当前 `origin/main`**：`16b01d99d33b386102bb9b2b248558eb5517e245`（PR #3 已合并；该合并不改变 PR #4 暂缓合并的判断，也不提升生产准入）
- **本轮修复前 HEAD（历史，不得当作当前核验）**：`63279e6e311ec9d9042599ecc5169f26b51c13bc`
- **本轮代码与测试提交**：`9d16bc0ae97e33a254d37984d74853c9f5ba3fd0`
- **记录日期**：2026-11-28（Asia/Shanghai，UTC+8）
- **生产准入**：保持关闭
- **本轮未执行**：合并本 PR、提交 `main`、部署、生产 IdP 接入、生产数据库变更、流量切换、在 GitHub 上批准该 PR、改动其他仓库

---

## 1. 文档边界

本文件只记录独立功能分支上的实现、测试和（若已完成）CI 结果。即使后续 CI 成功，也只代表工程检查通过，不提升生产准入状态。

不得把下列证据写成“零丢失”“精确一次”或“断电通过”：

- 损坏尾行恢复
- 同机 `SIGKILL` 后的文件可见性
- 父目录 `fsync` 调用成功

**send 成功还不等于事件已经完成 WAL 生命周期。** 只有完成后续耐久清理后，恢复才不会把已导出事件重新拉起。清理前崩溃可能造成重复投递，下游必须按 `idempotencyKey` 去重。

本轮 **未做真实断电**。

---

## 2. SHA 与历史 CI（按提交分开，不得混用）

| 引用 | SHA | 本地检查 | CI | 含义 |
| --- | --- | --- | --- | --- |
| 功能分支起点 | `c5779f20c8f9011396cd0aea299f8c2b9cd9e240` | — | — | 建立 `feat/p0-2-telemetry-wal` 时的 `origin/main` |
| 负责人 2026-11-28 16:34 决定前的 HEAD | `63279e6e311ec9d9042599ecc5169f26b51c13bc` | 9 个文件 / 59 个测试 | Run [46117273097](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46117273097) success，完成于 2026-11-28 14:35:27 CST（Asia/Shanghai） | **仅证明 `63279e6`。** 不得当作本轮修复后 HEAD 的核验。负责人决定：PR #4 保持 OPEN，不批准合并。 |
| 更早的历史 run | `365e667` / `1c5c2ca` | — | 46112509294 / 46112441099 | 更早轮次，均不得与 `63279e6` 或本轮 HEAD 混为同一次核验 |
| 本轮代码与测试 | `9d16bc0ae97e33a254d37984d74853c9f5ba3fd0` | 见第 6 节：9 个文件 / 66 个测试（2026-11-28 16:45 CST） | 推送后单独记录。不得把 run 46117273097 抄到本 SHA 上 | 本轮三项修复的实现提交 |
| 本报告更新及此后的最终 HEAD | 随后提交 | — | **必须引用最终推送 HEAD 自己的 run**，见第 7 节 | 文档提交可能使 HEAD 再前进 |

未改动 PR #3 worktree，也未改写 `docs/architecture/handover/P0_1_MERGED_MAIN_BASELINE.md`。

---

## 3. 本轮对修复前代码的确认与修复

以下确认均针对历史 SHA `63279e6`，修复落入 `9d16bc0`。

### 3.1 优先级 1：stale lock 回收竞态与 close() TOCTOU

**确认的问题：** `${wal}.lock` 是协作式 `O_EXCL` + pid/starttime 协议。stale 回收是 check-then-act：进程 B 判定锁已 stale 后 `unlink`，再 `O_EXCL` 创建。若在 B 的 unlink 之前或当时，进程 C 已经回收并成为新的活持有者，B 的 `unlink(lockPath)` 会删掉 C 的锁文件，随后 B 再创建，形成双活持有者。`close()` 先检查 cookie 仍属于自己再 `unlink`，同样存在 TOCTOU：检查之后、unlink 之前若另一进程已成为持有者，会误删新持有者的 cookie。

**修复机制：** 在 Linux 上，活锁独占改为进程生命周期内的抽象 Unix socket（`\0aiopt-wal-<sha256(walPath)>`）。`bind(2)` 在抽象命名空间中是互斥的，进程退出（含 SIGKILL）后内核立即释放该名字。获取顺序是先绑定 socket，再写入 lock cookie。因此：

- 两个活实例不可能都 bind 成功。
- stale 回收不再依赖“先 unlink 再 O_EXCL”；前一进程死后，后继者 bind 成功即可覆盖残留 cookie。
- `close()` 只在仍持有 socket 时、并且重新核对 pid+starttime 仍属于自己后，才删除 cookie，然后才释放 socket。后继者在 socket 释放前无法成为活持有者，关闭了 close() TOCTOU。
- 空锁文件：若已有活持有者（socket 已被占用），视为初始化竞争，不 unlink。若没有活持有者，空 cookie 视为崩溃残留，可由新持有者覆盖。

这仍不是对 WAL 本身的内核 flock。非 Linux 平台 fail-closed（需要抽象 socket）。无视 socket 协议的进程仍可写 WAL。

测试：

- `does not let two live child processes both hold the same WAL lock`
- `does not allow two concurrent stale recoverers to become live holders of the same WAL`
- `does not unlink a replaced lock cookie in the close() TOCTOU window`
- `treats an empty lock file as mid-init contention when a live holder already owns the socket`
- `overwrites a leftover empty lock cookie when no live holder exists`

### 3.2 优先级 2：成功 send 后的清理窗口中 `.complete` 复活

**确认的问题：** `commitEmptyWal()` 在 `63279e6` 上先 `unlink` 最终 WAL，再清理 leftover tmp。若此时残留一个已成功导出批次的 `.complete`（更早崩溃留下，或测试/故障组合），并在 unlink 最终文件之后、删除 `.complete` 之前崩溃，恢复路径会看到“最终 WAL 缺失且恰好一个 `.complete`”并晋升它，把已导出事件当作未导出事件救回。这超出了“send 成功但清理尚未耐久完成时允许 at-least-once 重放”的约定：清理意图已经是退役这些事件，不应再从 stale `.complete` 造出一个新的已发送批次 WAL。

**修复机制：**

1. 空队列清理先写入并 fsync `${wal}.cleanup` 哨兵，再删除全部 tmp（含 `.complete`），再 unlink 最终 WAL，最后删除哨兵。
2. 恢复时若哨兵存在，**永不晋升** `.complete`；若最终 WAL 仍在，按最终文件恢复（at-least-once 重放仍允许）；若最终文件已不在，队列为空，不复活已退役事件。
3. send 成功仍然不等于生命周期结束；`exportedCount` 只在耐久 persist/cleanup 成功后增加。

测试：

- `does not promote a leftover .complete of an already-exported batch when a cleanup sentinel is present`
- `does not resurrect exported events when SIGKILL hits the post-send cleanup window with a leftover .complete and missing final WAL`

仍保留：send 成功但清理前崩溃可以重放，消费者必须按 `idempotencyKey` 去重。

### 3.3 优先级 3：WAL 初始化成功后的读写失败必须 fail-closed

**确认的问题：** P2-2 已使初始化失败抛出 `TelemetryWalInitError`。但初始化成功后，`persistWalAtomic()` / 部分读路径仍可能只增加 `walWriteErrorCount` 并继续运行，调用方会误以为持久化仍然健康。

**修复机制：** 初始化成功后的 WAL 读/写/清理失败抛出 `TelemetryWalIoError`，并将 `walStatus` 置为 `io_failed`。之后的 `enqueue` / `flush` 不再静默降级，而是继续抛出同一类错误。损坏尾行仍按原策略跳过，不把 JSON 解析失败当成 I/O 失败。

测试：

- `fails closed on WAL write errors after a successful initialization`
- 既有 `fails closed with a distinct error when WAL initialization cannot be completed`

---

## 4. 四个指定风险的当前处理（以 `9d16bc0` 为准）

实现位置：`packages/telemetry-sdk/src/index.ts`、`packages/telemetry-sdk/src/wal-lock.ts`。

多实例互斥、遗留 tmp、父目录 fsync、以及 flush 串行化 / in-flight 不被容量淘汰等既有约束仍然成立，并叠加第 3 节的三项修复。父目录 `fsync` 已实现并在本测试环境调用成功。**未做真实断电。**

---

## 5. Phase 0 必须项

依据 `docs/architecture/handover/PHASE0_EXECUTION_PLAN.md` 的 P0-2 条款：独立子进程 SIGKILL 恢复、部分写入与 tmp 策略、rename 后恢复、父目录 fsync（非断电通过）、容量丢弃审计、按 `idempotencyKey` 的至少一次重放、同一路径并发拒绝，均仍覆盖。本轮额外覆盖双进程锁竞争、清理窗口组合故障，以及初始化后 I/O fail-closed。

---

## 6. 本地检查（本轮修复）

命令在仓库根目录、功能分支 `feat/p0-2-telemetry-wal`、实现提交 `9d16bc0ae97e33a254d37984d74853c9f5ba3fd0` 上执行。

环境：Node v24.22.1，pnpm v10.34.6。时间：2026-11-28 16:45 CST（Asia/Shanghai）。

```text
$ pnpm run check

> @openbot/ai-optimization@0.1.0 check
> pnpm run typecheck && pnpm run test

 RUN  v5.1.2 /workspace/repos/ai-optimization-p0-2

 Test Files  9 passed (9)
      Tests  66 passed (66)
   Start at  16:45:16
   Duration  3.47s
```

相对修复前 `63279e6` 的 9 个文件 / 59 个测试，本轮净增 7 个测试。

---

## 7. CI

PR：https://github.com/flykingvip-cloud/ai-optimization/pull/4 （OPEN，**未合并**，未获合并授权）

**历史 CI（不得当作本轮修复后的当前核验）：**

| SHA | Run | 结论 |
| --- | --- | --- |
| `63279e6e311ec9d9042599ecc5169f26b51c13bc` | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46117273097 | success（2026-11-28 14:35:27 CST）。负责人审核/决定时所见的前一轮 HEAD。 |
| `365e667` / `1c5c2ca` | 46112509294 / 46112441099 | 更早轮次 |

**本轮修复后已核验的报告提交**（代码 `9d16bc0` + 本轮报告初稿）：

- SHA：`262c9efb55d5eb897cc9bbea81de90ee63114902`
- Run：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46127394214
- Job：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46127394214/job/140924917879
- Event：`pull_request`
- 结论：`success`（约 21s）
- 完成时间：2026-11-28 16:47:08 CST（Asia/Shanghai）

若本节随后以新的文档提交写入，新 HEAD 必须再查一次 CI。不得把 run `46127394214`、更不得把 `46117273097`（仅证明 `63279e6`）当成新 HEAD 的核验结论。最终以 GitHub 上该 PR 最新 HEAD 的 verify 作业为准，并写入 PR 描述。

CI 成功只证明工程检查通过。它不是生产验收，也不是合并或部署授权。

---

## 8. 遗留限制

1. **未做真实断电。** 父目录 fsync 已实现并在本测试环境调用成功，但不构成掉电耐久性证明。
2. 活锁独占依赖 Linux 抽象 Unix socket，仍是协作式协议，不是对 WAL 文件的内核 flock。无视该协议的进程仍可写同一 WAL。非 Linux 平台当前 fail-closed。
3. 交付语义是 at-least-once，不是 exactly-once。rename 之前未提交的写入（例如 `.complete` 尚未被晋升或改名，且没有清理哨兵）仍可能丢失。
4. **send 成功还不等于 WAL 生命周期结束。** 只有完成后续耐久清理后，恢复才不会重放已导出事件。清理前崩溃可能重复投递，下游必须按 `idempotencyKey` 去重。
5. 部分批次成功依赖下游按 `idempotencyKey` 去重；客户端会重试整批。
6. 若 `fsync(dir)` 在 persist/cleanup 中失败，现在会进入 `io_failed` 并抛出；该失败本身不会回滚已经发生的 rename/unlink。
7. 本轮未改 OIDC/JWKS、OpenBot、PostgreSQL、`M4_ACCEPTANCE_REPORT.md` 或对外 HTTP 契约。

---

## 9. 三层门禁（不得混淆）

| 门禁 | 含义 | 本轮结论 |
| --- | --- | --- |
| Engineering Complete | 代码、测试和针对**当前最终 HEAD** 的 CI 证据通过 | **本轮修复的本地检查已通过（9 个文件 / 66 个测试）。针对 `262c9ef` 的 CI verify 已成功（run `46127394214`）。** 若本文件再前进，须核验新 HEAD 的 CI，不得沿用 `63279e6` 的 run 46117273097。PR 合并仍待单独审批。 |
| Integration Accepted | 真实 IdP、跨仓调用和目标基础设施验证通过 | **未达到。** |
| Production Accepted | 安全、可靠性、运维和发布门禁全部通过 | **未达到。** 生产准入保持关闭。 |

2026-11-28 16:34 CST，负责人正式决定：PR #4 保持 OPEN，不批准合并。本轮只在已授权的独立分支上修复、测试和更新 PR，不构成新的合并授权，也不得把本文件当作生产就绪声明。
