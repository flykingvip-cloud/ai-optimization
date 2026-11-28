# TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md

- **文档性质**：P0-2 Telemetry WAL 崩溃一致性的工程证据。这不是生产验收通过证明，不是断电耐久性通过证明，也不是生产准入申请。
- **仓库**：`flykingvip-cloud/ai-optimization`
- **分支**：`feat/p0-2-telemetry-wal`
- **PR**：https://github.com/flykingvip-cloud/ai-optimization/pull/4 （OPEN，`base=main`，**未合并**，未获合并授权）
- **基线 `origin/main`（本分支建立时）**：`c5779f20c8f9011396cd0aea299f8c2b9cd9e240`
- **当前 `origin/main`**：`16b01d99d33b386102bb9b2b248558eb5517e245`（PR #3 已合并；该合并不改变 PR #4 暂缓合并的判断，也不提升生产准入）
- **上一轮最终 HEAD（历史，不得当作本轮验收证据）**：`b72ec70eef681e72e723a2af8e784e1496c49add`（CI run [46127466291](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46127466291) **仅证明**该 SHA，完成于 2026-11-28 16:48:01 CST。不得作为本轮验收证据。）
- **本轮代码与测试提交**：`fb53e6ca5c919c6d52bed40f6a85b00b66923e29`（与任何文档提交都是不同的 SHA）
- **冻结前文档 HEAD**：`8789bf29c955611455f6b618ecf20718d9d193da`（CI run [46129328336](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129328336) **仅证明**该 SHA，完成于 2026-11-28 17:12:22 CST）。本冻结文档提交一旦存在，**不得再把 `8789bf2` 称为当前最终 HEAD**。
- **冻结正文文档提交**：`a5eff7789e35d42e8d4a39f0ec855f74c3942a75`（CI run [46130161924](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130161924) **仅证明**该 SHA，完成于 2026-11-28 17:22:47 CST）。记录冻结结论的正文；代码提交 `fb53e6c` 与该文档提交是不同 SHA。
- **本 CI 记录提交 / 新的最终文档 HEAD**：在 `a5eff77` 之后另有一次仅记录其 CI 的文档提交。该提交一旦存在，**不得再把 `a5eff77` 或 `8789bf2` 称为当前最终 HEAD**。新 HEAD 必须有自己的 CI run，不得把 run `46130161924`、`46129328336` 或 `46129186635` 当作新 HEAD 的核验。
- **工程结论**：P0-2 工程实现与测试完成（**仅 Engineering Complete**）。这不是合并授权，不是 Integration Accepted，也不是 Production Accepted。
- **记录日期**：2026-11-28（Asia/Shanghai，UTC+8）。负责人于 2026-11-28 17:17 CST 授权本轮只做证据归档与门禁冻结；只读核验完成于 2026-11-28 17:21 CST。
- **生产准入**：保持关闭
- **本轮未执行**：修改 WAL 代码或测试、合并本 PR、提交 `main`、部署、生产 IdP 接入、生产数据库变更、流量切换、在 GitHub 上批准该 PR、改动其他仓库、启动下一阶段跨仓工作

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
| 更早的历史 run | `365e667` / `1c5c2ca` | — | 46112509294 / 46112441099 | 更早轮次，不得与后续 SHA 混为同一次核验 |
| 负责人 2026-11-28 16:34 决定前的 HEAD | `63279e6e311ec9d9042599ecc5169f26b51c13bc` | 9 个文件 / 59 个测试 | Run [46117273097](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46117273097) success，完成于 2026-11-28 14:35:27 CST（Asia/Shanghai） | **仅证明 `63279e6`。** 负责人决定：PR #4 保持 OPEN，不批准合并。 |
| 上一轮代码（锁竞态 / 清理哨兵 / 初始化后 I/O） | `9d16bc0ae97e33a254d37984d74853c9f5ba3fd0` | 9 个文件 / 66 个测试（2026-11-28 16:45 CST） | 不得单独把更早 run 抄到该 SHA 上 | 上一轮三项修复的实现提交 |
| 上一轮最终 HEAD | `b72ec70eef681e72e723a2af8e784e1496c49add` | 同上 66 个测试（文档记录提交） | Run [46127466291](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46127466291) success，完成于 2026-11-28 16:48:01 CST（Asia/Shanghai） | **仅证明 `b72ec70`。** 不得当作本轮 `listTmpFiles` 修复的核验。 |
| 本轮代码与测试 | `fb53e6ca5c919c6d52bed40f6a85b00b66923e29` | 见第 6 节：9 个文件 / 71 个测试（2026-11-28 17:09:05 CST）。**这是该提交上的执行记录，不是独立复现。** | Run [46129186635](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129186635) success，完成于 2026-11-28 17:10:33 CST（Asia/Shanghai）。**仅证明 `fb53e6c`。** | 本轮 `listTmpFiles()` 非 ENOENT 目录读取错误 fail-closed 修复与故障注入测试。已核验它是 `8789bf2` 的祖先。 |
| 冻结前文档 HEAD | `8789bf29c955611455f6b618ecf20718d9d193da` | 文档记录提交，不含新的测试执行 | Run [46129328336](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129328336) success，完成于 2026-11-28 17:12:22 CST（Asia/Shanghai）。**仅证明 `8789bf2`。** | 记录 `fb53e6c` 修复与其 CI 的文档提交。代码提交与该文档提交是两个不同 SHA。本冻结提交出现后，不得再称其为当前最终 HEAD。 |
| 冻结正文文档提交 | `a5eff7789e35d42e8d4a39f0ec855f74c3942a75` | 本轮未重新执行 `pnpm run check`，不覆盖、不改标 `fb53e6c` 在 17:09:05 CST 的执行记录 | Run [46130161924](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130161924) success，完成于 2026-11-28 17:22:47 CST（Asia/Shanghai）。**仅证明 `a5eff77`。** | 工程验收冻结正文。已核验 `fb53e6c` 与 `8789bf2` 都是它的祖先。本 CI 记录提交出现后，不得再称其为当前最终 HEAD。 |
| 本 CI 记录提交 / 新的最终文档 HEAD | 本文件本次提交（推送后的新 HEAD） | 同上：未重新执行测试 | **不得**使用 run `46130161924`（仅证明 `a5eff77`）、`46129328336`（仅证明 `8789bf2`）、`46129186635`（仅证明 `fb53e6c`）或 `46127466291`（仅证明 `b72ec70`）。必须等待并引用新 HEAD 自己的 verify run，并写入 PR 描述。 | 仅把 `a5eff77` 的 CI 记入报告，不修改代码或测试 |

2026-11-28 17:21 CST 只读核验（与预期一致，无待核实项）：PR #4 当时 HEAD 为 `8789bf29c955611455f6b618ecf20718d9d193da`，状态 OPEN、未合并、`MERGEABLE` / `CLEAN`。GitHub 记录的 PR base SHA 为 `c5779f20c8f9011396cd0aea299f8c2b9cd9e240`（分支建立时的 `main`，也是与当前 `origin/main` `16b01d99d33b386102bb9b2b248558eb5517e245` 的 merge-base）。`git merge-base --is-ancestor` 确认 `fb53e6c` 是 `8789bf2` 的祖先。Run `46129186635` 的 `headSha` 等于 `fb53e6c` 全长 SHA，`pull_request` / job `verify`（140930402553）success，作业完成于 2026-11-28 17:10:33 CST。Run `46129328336` 的 `headSha` 等于 `8789bf2` 全长 SHA，`pull_request` / job `verify`（140930833612）success，作业完成于 2026-11-28 17:12:21 CST，run 完成于 17:12:22 CST。相对 base 的变更文件仍为 9 个：本报告、`packages/telemetry-sdk/src/index.ts`、`packages/telemetry-sdk/src/wal-lock.ts`、三份 crash-recovery 测试辅助文件、`tests/integration/telemetry-wal-crash-recovery.test.ts`、`tests/integration/persistence-wal-perf.test.ts`、`tests/m4-sandbox/m4-full-sandbox-e2e.test.ts`。

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

### 3.4 本轮（2026-11-28 17:05 CST）补修：`listTmpFiles()` 静默吞掉目录读取错误

**确认的问题：** 截至上一轮最终 HEAD `b72ec70`，`listTmpFiles()` 在 `fs.readdirSync(dir)` 失败时捕获异常并返回空数组。这会把真实 I/O 故障伪装成“没有临时文件”。初始化阶段可能因此把残留 tmp 状态当成空目录，并将 WAL 错误地标记为 `enabled`；成功 send 后的清理阶段可能在未枚举 `.complete` 的情况下继续删除最终 WAL、清除 cleanup sentinel，破坏 fail-closed 保证。

**修复机制（代码提交 `fb53e6ca5c919c6d52bed40f6a85b00b66923e29`）：**

1. 移除 `listTmpFiles()` 对目录读取错误的静默吞异常。除负责人明确允许忽略的 `ENOENT`（目录不存在，视为没有残留 tmp）外，其他 `readdir` 错误必须向上抛出。
2. 初始化 / 恢复阶段的目录读取失败由既有 `acquireWalLockAndRecover()` 包装为 `TelemetryWalInitError`。WAL 不得标记为 `enabled`，已获取的锁会被释放。
3. 成功 send 后的 `commitEmptyWal()` 已先写入并 fsync cleanup sentinel，再调用 `listTmpFiles()`。目录读取失败时停止后续 unlink，保留 sentinel、最终 WAL 和恢复所需文件，并由 `persistWalAtomic()` 将 `walStatus` 置为 `io_failed`、抛出 `TelemetryWalIoError`。重启后若 sentinel 仍在，永不晋升 leftover `.complete`，因此不会把已成功发送且只存在于 stale `.complete` 中的事件复活。
4. 对外错误沿用现有语义：`TelemetryWalInitError` 或 `TelemetryWalIoError`，未新增错误类型。

测试使用可控的 `fs.readdirSync` 故障注入（EIO / EACCES），不依赖真实权限或不稳定的操作系统环境；每个测试结束后恢复 mock。全部通过：

- `fails closed when init-time readdirSync returns EIO and does not mark the WAL enabled`
- `fails closed when init-time readdirSync returns EACCES and does not treat leftover temps as an empty directory`
- `retains the cleanup sentinel when directory read fails during post-send cleanup`
- `does not delete the final WAL early or resurrect exported events when cleanup readdir fails with a leftover .complete`
- `exposes recovery failure when a later directory re-read fails and does not skip leftover state`

**验收项：初始化、恢复、清理阶段 I/O 错误均 fail-closed — 通过。** 依据是上述 5 个故障注入测试以及完整 `pnpm run check`（9 个文件 / 71 个测试）全部通过。该项通过只证明工程检查，不改变 at-least-once 语义，也不提升生产准入。

---

## 4. 四个指定风险的当前处理（锁 / 清理哨兵以 `9d16bc0` 为准；目录读取 fail-closed 以 `fb53e6c` 为准）

实现位置：`packages/telemetry-sdk/src/index.ts`、`packages/telemetry-sdk/src/wal-lock.ts`。

多实例互斥、遗留 tmp、父目录 fsync、以及 flush 串行化 / in-flight 不被容量淘汰等既有约束仍然成立，并叠加第 3 节的三项修复。父目录 `fsync` 已实现并在本测试环境调用成功。**未做真实断电。**

---

## 5. Phase 0 必须项

依据 `docs/architecture/handover/PHASE0_EXECUTION_PLAN.md` 的 P0-2 条款：独立子进程 SIGKILL 恢复、部分写入与 tmp 策略、rename 后恢复、父目录 fsync（非断电通过）、容量丢弃审计、按 `idempotencyKey` 的至少一次重放、同一路径并发拒绝，均仍覆盖。上一轮已额外覆盖双进程锁竞争、清理窗口组合故障，以及初始化后写路径 I/O fail-closed。本轮再覆盖初始化、恢复和清理阶段的目录读取故障注入，使 I/O fail-closed 声明与 `listTmpFiles()` 的实现一致。

---

## 6. 本地检查（本轮 `listTmpFiles` 修复）

**性质：执行记录，不是独立复现。** 下面的结果记录的是实现提交 `fb53e6ca5c919c6d52bed40f6a85b00b66923e29` 上一次已完成的 `pnpm run check`，不得改写成一次新的、独立的复现，也不得用本冻结文档轮次覆盖或改标该时间戳。本冻结轮次未重新执行测试。

命令在仓库根目录、功能分支 `feat/p0-2-telemetry-wal`、实现提交 `fb53e6ca5c919c6d52bed40f6a85b00b66923e29` 上执行。

环境：Node v24.22.1，pnpm v10.34.6。时间：2026-11-28 17:09:05 CST（Asia/Shanghai）。

```text
$ pnpm run check

> @openbot/ai-optimization@0.1.0 check
> pnpm run typecheck && pnpm run test

> tsc --noEmit

 RUN  v5.1.2 /workspace/repos/ai-optimization-p0-2

 Test Files  9 passed (9)
      Tests  71 passed (71)
   Start at  17:09:05
   Duration  3.25s
```

TypeScript 类型检查通过。WAL 崩溃恢复、锁竞争、`.complete` 清理哨兵、并发 flush、容量控制和 in-flight batch 既有测试无回归。本轮新增 5 个目录读取故障注入测试全部通过。相对上一轮最终 HEAD `b72ec70` 的 9 个文件 / 66 个测试，该次执行为 9 个文件 / 71 个测试。以上均为 `fb53e6c` 上 2026-11-28 17:09:05 CST 的执行记录，不是本冻结轮次的独立复现。

---

## 7. CI

PR：https://github.com/flykingvip-cloud/ai-optimization/pull/4 （OPEN，**未合并**，未获合并授权）

**历史 CI（不得当作本轮 `listTmpFiles` 修复的核验）：**

| SHA | Run | 结论 |
| --- | --- | --- |
| `365e667` / `1c5c2ca` | 46112509294 / 46112441099 | 更早轮次 |
| `63279e6e311ec9d9042599ecc5169f26b51c13bc` | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46117273097 | success（2026-11-28 14:35:27 CST）。仅证明 `63279e6`。 |
| `262c9efb55d5eb897cc9bbea81de90ee63114902` | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46127394214 | success（2026-11-28 16:47:08 CST）。仅证明 `262c9ef`。 |
| `b72ec70eef681e72e723a2af8e784e1496c49add` | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46127466291 | success（2026-11-28 16:48:01 CST）。上一轮最终 HEAD，仅证明 `b72ec70`。 |

**本轮代码与测试提交已核验（2026-11-28 17:21 CST 再次对照 GitHub 实况，关联一致）：**

- SHA：`fb53e6ca5c919c6d52bed40f6a85b00b66923e29`
- Run：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129186635
- Job：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129186635/job/140930402553
- Event：`pull_request`
- Workflow：`CI` / Job：`verify`（job id `140930402553`）
- 结论：`success`
- 作业/run 完成时间：2026-11-28 17:10:33 CST（Asia/Shanghai）
- **该 run 只证明 `fb53e6c`。** 不得把 run `46127466291`（仅证明 `b72ec70`）或更早的成功结果抄到本 SHA 上。

**冻结前文档 HEAD 已核验（不得再称为当前最终 HEAD）：**

- SHA：`8789bf29c955611455f6b618ecf20718d9d193da`
- Run：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129328336
- Job：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129328336/job/140930833612
- Event：`pull_request`
- Workflow：`CI` / Job：`verify`（job id `140930833612`）
- 结论：`success`
- 作业完成时间：2026-11-28 17:12:21 CST（Asia/Shanghai）；run 完成时间：2026-11-28 17:12:22 CST（Asia/Shanghai）
- **该 run 只证明 `8789bf2`。** 不得把该 run 当作 `a5eff77` 或其后文档 HEAD 的核验。

**冻结正文文档提交已核验（不得再称为当前最终 HEAD）：**

- SHA：`a5eff7789e35d42e8d4a39f0ec855f74c3942a75`
- Run：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130161924
- Job：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130161924/job/140933323641
- Event：`pull_request`
- Workflow：`CI` / Job：`verify`（job id `140933323641`）
- 结论：`success`
- 作业/run 完成时间：2026-11-28 17:22:47 CST（Asia/Shanghai）
- **该 run 只证明 `a5eff77`。** 本 CI 记录提交会产生新的最终文档 HEAD，不得把 run `46130161924`、`46129328336` 或 `46129186635` 当作新 HEAD 的核验。新 HEAD 的 run id、URL、结论、完成时间与完整 SHA 写入 PR 描述，并区分哪一次 run 证明哪一个 SHA。

CI 成功只证明工程检查通过。它不是生产验收，也不是合并或部署授权。

---

## 8. 遗留限制

1. **未做真实断电。** 父目录 fsync 已实现并在本测试环境调用成功，但不构成掉电耐久性证明。
2. 活锁独占依赖 Linux 抽象 Unix socket，仍是协作式协议，不是对 WAL 文件的内核 flock。无视该协议的进程仍可写同一 WAL。非 Linux 平台当前 fail-closed。
3. 交付语义是 at-least-once，不是 exactly-once。rename 之前未提交的写入（例如 `.complete` 尚未被晋升或改名，且没有清理哨兵）仍可能丢失。
4. **send 成功还不等于 WAL 生命周期结束。** 只有完成后续耐久清理后，恢复才不会重放已导出事件。清理前崩溃可能重复投递，下游必须按 `idempotencyKey` 去重。
5. 部分批次成功依赖下游按 `idempotencyKey` 去重；客户端会重试整批。
6. 若 `fsync(dir)` 在 persist/cleanup 中失败，现在会进入 `io_failed` 并抛出；该失败本身不会回滚已经发生的 rename/unlink。
7. 真实生产 IdP、PostgreSQL 和 OpenBot 集成尚未验收。本轮未改 OIDC/JWKS、OpenBot、Knowledge SDK、PostgreSQL、`M4_ACCEPTANCE_REPORT.md` 或对外 HTTP 契约。

---

## 9. 三层门禁（冻结结论；三门互相独立，不得混淆）

| 门禁 | 含义 | 冻结结论 |
| --- | --- | --- |
| Engineering Complete | WAL 锁、崩溃恢复、cleanup sentinel、I/O fail-closed（含 `listTmpFiles()` 对非 ENOENT 目录读取错误 fail-closed）、对应测试及可对应 SHA 的 CI 已完成 | **通过（仅此门禁）。** 依据：代码与测试提交 `fb53e6ca5c919c6d52bed40f6a85b00b66923e29`；该 SHA 上的执行记录为 9 个文件 / 71 个测试（2026-11-28 17:09:05 CST，不是独立复现）；CI run [46129186635](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129186635) 仅证明该代码 SHA。冻结前文档 HEAD `8789bf2` 由 run [46129328336](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46129328336) 证明，不得再称为当前最终 HEAD。冻结正文 `a5eff77` 由 run [46130161924](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130161924) 证明，本 CI 记录提交出现后也不得再称为当前最终 HEAD。新的最终文档 HEAD 必须引用其自己的 CI，不得沿用上述 run，更不得沿用仅证明 `b72ec70` 的 run 46127466291。通过本门禁 **不是** 合并授权。 |
| Integration Accepted | 真实 OpenBot 遥测接入和目标基础设施验证通过 | **未通过。** 尚未完成真实 OpenBot 遥测集成和目标基础设施验证。 |
| Production Accepted | 生产环境安全、可靠性和运维验收全部通过 | **未通过。** 未进行生产环境安全、可靠性和运维验收。生产准入保持关闭。 |

2026-11-28 16:34 CST，负责人正式决定：PR #4 保持 OPEN，不批准合并。2026-11-28 17:05 CST 的跟进只授权关闭 `listTmpFiles()` 静默吞错缺口。2026-11-28 17:17 CST，负责人确认 P0-2 代码修复作为工程事项通过，并授权本轮只做最终证据归档与门禁冻结，**明确不是合并授权**。不得把本文件当作 Integration Accepted、Production Accepted 或生产就绪声明。

## 10. 建议的下一阶段（仅记录，本轮不启动）

负责人指出：下一阶段应另行开展 OpenBot 遥测适配器的只读接口审计与集成方案设计。在该审计完成并获得独立授权之前，不实施跨仓代码变更。本轮不开始该项工作。
