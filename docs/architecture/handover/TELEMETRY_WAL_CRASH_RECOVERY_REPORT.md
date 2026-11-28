# TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md

- **文档性质**：P0-2 Telemetry WAL 崩溃一致性的工程证据。这不是生产验收通过证明，不是断电耐久性通过证明，也不是生产准入申请。
- **仓库**：`flykingvip-cloud/ai-optimization`
- **分支**：`feat/p0-2-telemetry-wal`
- **PR**：https://github.com/flykingvip-cloud/ai-optimization/pull/4 （OPEN，`base=main`，**未合并**，未获合并授权）
- **基线 `origin/main`**：`c5779f20c8f9011396cd0aea299f8c2b9cd9e240`（已合并 PR #1 与 PR #2；本分支由此 SHA 建出）
- **负责人审核时的 HEAD**（2026-11-28，已过时，不得当作当前核验结论）：`365e667654152b2f1ed48a5e28e65241476ddf5a`
- **本轮修复代码与测试提交**：`6d7d823e922f7b954cd690c0702c06e9dc429946`
- **记录日期**：2026-11-28（Asia/Shanghai，UTC+8）
- **生产准入**：保持关闭
- **本轮未执行**：合并本 PR、提交 `main`、部署、生产 IdP 接入、生产数据库变更、流量切换、在 GitHub 上批准该 PR

---

## 1. 文档边界

本文件只记录独立功能分支上的实现、测试和（若已完成）CI 结果。即使后续 CI 成功或本 PR 被合并，也只代表工程检查通过，不提升生产准入状态。

不得把下列证据写成“零丢失”“精确一次”或“断电通过”：

- 损坏尾行恢复（已有 P1-08 / M4 测试）
- 同机 `SIGKILL` 后的文件可见性（与断电后的持久性不是同一件事）
- 父目录 `fsync` 调用成功（只证明该测试环境成功发出了 `fsync(dir)`）

send 成功还不等于事件已经完成 WAL 生命周期。只有完成后续耐久清理后，恢复才不会把已导出事件重新拉起。清理前崩溃可能造成重复投递，下游必须按 `idempotencyKey` 去重。

本轮 **未做真实断电**。

---

## 2. SHA 核对

| 引用 | SHA | 说明 |
| --- | --- | --- |
| `origin/main` | `c5779f20c8f9011396cd0aea299f8c2b9cd9e240` | 功能分支起点；与授权基线一致 |
| 初版代码与测试 | `417413563f79a02c94f363ad0e6471da7fe5ff15` | 历史实现，不是当前核验对象 |
| 初版报告提交 | `1c5c2ca1018d26b1f9f1bb7a1d1f0c6da2b50eb0` | 历史文档提交 |
| 负责人 2026-11-28 审核 HEAD | `365e667654152b2f1ed48a5e28e65241476ddf5a` | 审核结论：暂不批准合并。该 SHA 及其 CI 不得当作修复后的核验结论 |
| 本轮 P1/P2 修复代码与测试 | `6d7d823e922f7b954cd690c0702c06e9dc429946` | 当前实现提交 |
| 本报告更新 | 本文件随后作为同一分支的后续提交写入 | 不以历史 CI 代替该后续 HEAD 的核验 |

未改动 PR #3 的 worktree（`/workspace/repos/ai-optimization`，分支 `docs/p0-1-merged-main-baseline`）。

---

## 3. 负责人 2026-11-28 审核结论（针对 `365e667`）

负责人独立审查了 PR #4 的代码差异、测试与 CI，结论是：**工程方向正确，CI 通过，但暂不批准合并，生产验收未通过。**

已确认在 `365e667` 上基本符合设计的部分：同一 WAL 多实例拒绝存活持有者、不完整 `.partial` 不晋升、唯一 `.complete` 仅在最终 WAL 缺失时晋升、rename 后 fsync 父目录、flush 成功后 unlink 并 fsync、发送成功但清理前允许重放、容量丢弃有指标与有限审计。

审核时核验的 CI **仅** 针对 `365e667`：

- Run：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46112509294
- 结论：`success`（2026-11-28 13:32:00 CST，Asia/Shanghai）

更早的 `1c5c2ca` run https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46112441099 是另一次历史验证，**不得与 `365e667` 的 run 混为同一次核验，也不得作为本轮修复后的当前结论。**

### 3.1 阻断项（P1）与补强项（P2）

| 编号 | 审核发现 | 本轮修复 |
| --- | --- | --- |
| P1-1 | 单个 `inFlightBatch` 且 `flush()` 未串行化。第二次 flush 可覆盖第一次的 in-flight 状态；并发 enqueue 可能把未确认的批次 A 从 WAL 快照中抹掉。 | `flush()` 改为串行化：后一次 flush 等待前一次结束，并且只发送当时仍留在 pending 队列中的事件。未确认批次保存在 `inFlightBatches` 中，持久化快照始终覆盖全部未确认事件与 pending 队列。 |
| P1-2 | `evictUntilWithinWalBudget()` 优先从 in-flight 删除事件，容量压力下可能丢掉仍在等待 `transport.send` 的事件。 | 容量淘汰只删除可安全丢弃的 pending 队列事件，**永不删除未确认 in-flight 事件**。若 in-flight 加上新事件仍无法落入 `maxWalBytes`，则拒绝该新事件并记录 `wal_capacity_refused` 审计，保留 in-flight 集合。 |
| P2-1 | 创建锁文件与写入 pid/starttime 是两步。空锁文件在约 30ms 后可能被当成 stale 删除，持有者若在 `O_EXCL` 之后、写 payload 之前被调度暂停，可能出现双写窗口。 | 空锁文件按初始化竞争处理，不再因短暂为空而 unlink。`close()` 只有在锁文件仍属于当前持有者（pid + starttime）时才删除。若进程在写入 payload 前崩溃，可能留下sticky 空锁，后继获取将 fail-closed 拒绝。 |
| P2-2 | `acquireWalLockAndRecover()` 在 `io_error` 时只增加 `walWriteErrorCount` 并返回，配置了 `walFilePath` 的客户端会在 `walEnabled=false` 下继续运行，调用方可能误以为持久化已启用。 | 明确区分：未配置 WAL（`walStatus=disabled`）、WAL 已启用（`walStatus=enabled`）、初始化失败（构造期抛出 `TelemetryWalInitError`，不返回一个“看起来可用但不持久化”的客户端）。 |

---

## 4. 四个指定风险的当前处理（修复后）

实现位置：`packages/telemetry-sdk/src/index.ts`、`packages/telemetry-sdk/src/wal-lock.ts`。以下描述以 `6d7d823e922f7b954cd690c0702c06e9dc429946` 为准。

### 4.1 多实例并发写同一 WAL 文件

- 每个 `walFilePath` 在客户端生命周期内持有 `${walFilePath}.lock`。
- 锁协议：`O_EXCL` 创建锁文件，写入 `pid` 与 Linux `/proc/<pid>/stat` 的 `starttime`，并 `fsync` 锁文件。第二个仍存活的持有者会被拒绝，抛出 `TelemetryWalLockError`，不会静默 last-write-wins 覆盖。
- 空锁文件视为初始化竞争，不 unlink。`close()` 先核对 pid+starttime，确认仍属当前持有者后才删除锁文件。
- 进程 `SIGKILL` 后、且锁文件已含完整 payload 时：后继客户端在确认持有者 pid 已不存在（Linux 上还会核对 starttime）后，将残留锁视为 stale 并获取新锁。
- **这不是内核 `flock`/`fcntl` 锁。** 它是协作式 lockfile 协议。无视该协议的进程仍可写同一 WAL。非 Linux、无法读取 `/proc` starttime 时，pid 复用残留风险更高。本轮未引入原生依赖。

测试：

- `refuses a second live client on the same WAL path and does not overwrite the first writer's snapshot`
- `allows a successor client after close() and after SIGKILL of a lock-holding child`
- `treats an empty lock file as contention and does not unlink it`
- `does not unlink a lock file that no longer belongs to the releasing holder`

既有 P1-02 与 M4-03 是同进程“重启”模拟，已在打开后继客户端前补上 `close()`。P1-02 的不可写路径断言已改为构造期抛出 `TelemetryWalInitError`（P2-2 的 fail-closed 要求），恢复断言未削弱。

### 4.2 崩溃遗留临时文件

写入路径：

1. 写入 `${wal}.tmp.<pid>.partial`（先写一半，再写完并 `fsync` 文件）
2. rename 为 `${wal}.tmp.<pid>.complete`，然后 fsync 父目录
3. rename 到最终 WAL 路径，然后再次 fsync 父目录

恢复策略：

- `.partial` **永不晋升**，即使内容恰好可解析为 JSON（可能是截断写入）。最终 WAL 缺失时，未提交的首次写入会被丢弃。
- `.complete` 仅在**最终 WAL 不存在**且**恰好只有一个** complete tmp 时晋升；晋升后 fsync 父目录再进入正常恢复。
- 最终 WAL 仍存在时，所有遗留 tmp 都丢弃。commit 点是指向最终路径的 rename（或空队列时的 unlink）。rename 之前的新快照视为未提交。
- 最终 WAL 缺失且存在多个 complete tmp 时 fail-closed：不晋升，保留这些 complete 文件供检查，并增加 `walWriteErrorCount`。单写者协议下这不应出现。

最终 WAL 格式仍是事件 JSONL，未改既有有效行 + 损坏尾行的恢复语义。

测试：

- `discards a leftover partial tmp after SIGKILL mid-write and does not promote truncated data`
- `promotes a leftover complete tmp when the final WAL is missing after SIGKILL`
- `discards a leftover complete tmp when the final WAL still exists and keeps the pre-rename snapshot`

### 4.3 rename 后目录项持久性（父目录 fsync）

- 在 complete tmp 的 rename、最终 WAL 的 rename、以及空 WAL 的 unlink 之后，以 `O_RDONLY|O_DIRECTORY` 打开父目录并 `fsync`，然后关闭。
- 指标：`walDirFsyncCount`、`walDirFsyncErrorCount`。在本机 Linux（Node v24.22.1）测试中，`records parent-directory fsync attempts after rename and does not treat that as a power-loss test` 观察到 `walDirFsyncCount > 0` 且 `walDirFsyncErrorCount = 0`。
- 这只证明该环境成功调用了 `fsync(dir)`。**未做真实断电。** 不得据此声称目录项在掉电后一定可见。同机 `SIGKILL` 后 rename 通常已经对后继进程可见，即使尚未 fsync 父目录；该现象不能替代断电测试。

### 4.4 flush 成功后 WAL 清理的恢复语义

- `flush()` 串行执行。后一次调用等到前一次结束后，只发送当时仍留在 pending 队列中的事件。
- 在 `transport.send` 成功之前，不会把未确认批次从 WAL 快照中清掉。send 期间的并发 `enqueue`，以及重叠的第二次 `flush()`，都不会把仍未确认的事件移出持久化快照。
- send 成功后，才持久化剩余队列；若剩余为空，则 **unlink 最终 WAL**（不再写空文件），清理 tmp，并 fsync 父目录。成功清理后的恢复不得把已导出事件救回。
- send 已成功但持久化清理尚未完成时崩溃：恢复会重放这些事件（at-least-once）。消费者须用已有的 `idempotencyKey` 去重。客户端不提供 exactly-once。
- 传输层若只对批次中部分事件成功随后失败，客户端会重试整批；部分成功的去重同样依赖消费者对 `idempotencyKey` 的处理。
- 容量压力下不删除 in-flight 事件；放不下的新事件被拒绝并记入 `wal_capacity_refused`。

测试：

- `replays events if the process crashes after a successful send but before durable WAL cleanup`
- `does not resurrect exported events after a durable post-flush WAL cleanup`
- `replays a full batch after transport failure even if a consumer already accepted part of it, and the consumer can dedupe by idempotencyKey`
- `keeps in-flight flush events in the WAL if a concurrent enqueue persists before send returns`
- `overlapping flushes keep all unconfirmed events in the WAL snapshot and recoverable after close`
- `does not evict unconfirmed in-flight events under WAL capacity pressure and refuses events that cannot fit`

---

## 5. Phase 0 必须项对照

依据 `docs/architecture/handover/PHASE0_EXECUTION_PLAN.md` 中 P0-2 条款，对照如下。

| # | 必须完成项 | 本轮结果 |
| --- | --- | --- |
| 1 | 独立子进程作为 Client A；在不同写入阶段 `SIGKILL` 后由 Client B 恢复 | 已做。子进程 harness：`tests/integration/helpers/telemetry-wal-crash-child.ts`。覆盖 mid-write partial、complete tmp、rename 后、lock 持有中、send 成功但清理前。 |
| 2 | 部分写入中断、临时文件遗留的恢复或明确丢弃策略 | 已做并写明：partial 丢弃；complete 仅在最终 WAL 缺失且唯一时晋升。 |
| 3 | 原子 rename 后的恢复 | 已做：`recovers events after SIGKILL following atomic rename onto the final WAL path` |
| 4 | 评估并验证父目录 fsync / 断电持久性策略 | 已实现父目录 fsync，并在 Linux 测试环境观察到调用成功。**未做真实断电。** 未把损坏尾行或同机崩溃测试升级为断电通过。 |
| 5 | 容量上限下的保留与丢弃；每次丢弃必须有指标和审计信息 | 已做：`droppedCount` / `droppedByMaxWalBytes` / `droppedByWalCapacityRefused` / `droppedByMaxQueueItems` / `droppedByEnqueueError`，以及有界 `recentDrops`。pending 淘汰与 in-flight 保护见第 3、4 节。既有 P1-08 仍通过。 |
| 6 | 重复投递、部分批次成功的幂等恢复 | 已做 at-least-once 重放与消费者按 `idempotencyKey` 去重的测试。客户端本身不在恢复时静默丢弃同键事件。 |
| 7 | 同一 WAL 路径并发实例的安全性（加锁或明确拒绝） | 已做：明确拒绝第二个活实例（`TelemetryWalLockError`）。空锁失败闭、释放时校验所有权见 P2-1。 |

---

## 6. 本地检查（本轮修复）

命令在仓库根目录、功能分支 `feat/p0-2-telemetry-wal`、修复提交 `6d7d823e922f7b954cd690c0702c06e9dc429946` 上执行。本报告随后作为后续提交写入，不改变该实现 SHA 的含义。

环境：Node v24.22.1，pnpm v10.34.6。时间：2026-11-28 14:32 CST（Asia/Shanghai）。

```text
$ pnpm run check

> @openbot/ai-optimization@0.1.0 check
> pnpm run typecheck && pnpm run test

> @openbot/ai-optimization@0.1.0 typecheck
> tsc --noEmit

> @openbot/ai-optimization@0.1.0 test
> vitest run

 RUN  v5.1.2 /workspace/repos/ai-optimization-p0-2

 Test Files  9 passed (9)
      Tests  59 passed (59)
   Start at  14:32:50
   Duration  1.19s
```

相对审核时的 9 个文件 / 54 个测试，本轮新增 5 个测试（见第 3、4 节列出的 P1/P2 用例）。既有恢复断言保持通过。P1-02 不可写路径改为构造失败，以符合 P2-2，而不是静默降级。

---

## 7. CI

PR：https://github.com/flykingvip-cloud/ai-optimization/pull/4 （OPEN，**未合并**，未获合并授权）

**历史 CI（不得当作本轮修复后的当前核验）：**

| SHA | Run | 结论 | 含义 |
| --- | --- | --- | --- |
| `1c5c2ca1018d26b1f9f1bb7a1d1f0c6da2b50eb0` | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46112441099 | success（2026-11-28 13:31:09 CST） | 初版报告 HEAD 的历史验证，不是 `365e667`，也不是本轮修复 |
| `365e667654152b2f1ed48a5e28e65241476ddf5a` | https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46112509294 | success（2026-11-28 13:32:00 CST） | 负责人审核时的 HEAD。审核已指出不得与上一 run 混用；该结论已被 P1/P2 修复取代，不能再作为当前 HEAD 的核验 |

**当前实现提交** `6d7d823e922f7b954cd690c0702c06e9dc429946` 及包含本报告更新的后续 HEAD，必须在推送后重新查看 GitHub Actions。本段在推送前写入，因此**此处尚无修复后 HEAD 的 CI 结论**。不得把上表历史 success 抄到当前 HEAD 上。当前 HEAD 的 run URL 与结论将在推送后单独核对。

CI 成功只证明工程检查通过。它不是生产验收，也不是合并或部署授权。

---

## 8. 遗留限制

1. **未做真实断电。** 父目录 fsync 已实现并在本测试环境调用成功，但不构成掉电耐久性证明。
2. 锁是协作式 lockfile，不是内核 flock。恶意或不兼容的写入者可以绕过。非 Linux 上 pid 复用缓解较弱。空锁文件 fail-closed 后，若创建者在写 payload 前崩溃，可能留下需要人工处理的 sticky 空锁。
3. 交付语义是 at-least-once，不是 exactly-once；也不保证 rename 之前未提交写入的零丢失。首次持久化若在 `.complete` 之前崩溃，事件会丢失。
4. **send 成功还不等于 WAL 生命周期结束。** 只有完成后续耐久清理后，恢复才不会重放已导出事件。清理前崩溃可能重复投递，下游必须按 `idempotencyKey` 去重。
5. 部分批次成功依赖下游按 `idempotencyKey` 去重；客户端会重试整批。
6. 同一进程内未调用 `close()` 的后继客户端会被拒绝。调用方需要在进程退出路径上 `close()`；硬杀进程则依赖已写入 payload 的 stale 检测。
7. 若测试环境的 `fsync(dir)` 失败，会增加 `walDirFsyncErrorCount`，rename/unlink 本身不会回滚。
8. 多个 complete tmp 且最终 WAL 缺失时 fail-closed，可能暂时无法自动恢复这些未提交快照。
9. 未确认 in-flight 集合可能使 WAL 暂时超过 `maxWalBytes`（拒绝新事件而不删除 in-flight）。这是有意的 fail-closed 取舍。
10. 本轮未改 OIDC/JWKS、OpenBot、PostgreSQL、`M4_ACCEPTANCE_REPORT.md` 或对外 HTTP 契约。

---

## 9. 三层门禁（不得混淆）

| 门禁 | 含义 | 本轮结论 |
| --- | --- | --- |
| Engineering Complete | 代码、测试和针对**当前 HEAD** 的 CI 证据通过 | **本轮修复的本地检查已通过（9 个文件 / 59 个测试）。** 修复后 HEAD 的 GitHub CI 须在推送后单独核对，不得沿用 `365e667` 或 `1c5c2ca` 的 CI 结论。PR 合并仍待单独审批。这是本文件记录的唯一进行中层。 |
| Integration Accepted | 真实 IdP、跨仓调用和目标基础设施验证通过 | **未达到。** |
| Production Accepted | 安全、可靠性、运维和发布门禁全部通过 | **未达到。** 生产准入保持关闭。 |

本 PR **未获合并授权**。负责人 2026-11-28 对 `365e667` 的结论是暂不批准合并。本轮只修复被指出的 P1/P2 问题并请求重新核验最新 HEAD，不构成新的合并授权，也不得把本文件当作生产就绪声明。
