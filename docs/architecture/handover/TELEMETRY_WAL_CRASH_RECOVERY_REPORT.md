# TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md

- **文档性质**：P0-2 Telemetry WAL 崩溃一致性的工程证据。这不是生产验收通过证明，不是断电耐久性通过证明，也不是生产准入申请。
- **仓库**：`flykingvip-cloud/ai-optimization`
- **分支**：`feat/p0-2-telemetry-wal`
- **基线 `origin/main`**：`c5779f20c8f9011396cd0aea299f8c2b9cd9e240`（已合并 PR #1 与 PR #2；本分支由此 SHA 建出）
- **代码与测试提交**：`417413563f79a02c94f363ad0e6471da7fe5ff15`
- **记录日期**：2026-11-28（Asia/Shanghai，UTC+8）
- **生产准入**：保持关闭
- **本轮未执行**：合并本 PR、提交 `main`、部署、生产 IdP 接入、生产数据库变更、流量切换

---

## 1. 文档边界

本文件只记录独立功能分支上的实现、测试和（若已完成）CI 结果。即使后续 CI 成功或本 PR 被合并，也只代表工程检查通过，不提升生产准入状态。

不得把下列证据写成“零丢失”“精确一次”或“断电通过”：

- 损坏尾行恢复（已有 P1-08 / M4 测试）
- 同机 `SIGKILL` 后的文件可见性（与断电后的持久性不是同一件事）
- 父目录 `fsync` 调用成功（只证明该测试环境成功发出了 `fsync(dir)`）

本轮 **未做真实断电**。

---

## 2. 审前 SHA 核对

实施前已在独立 worktree `/workspace/repos/ai-optimization-p0-2` 中 `git fetch origin main`，并确认：

| 引用 | SHA | 结论 |
| --- | --- | --- |
| `origin/main` | `c5779f20c8f9011396cd0aea299f8c2b9cd9e240` | 与授权基线一致（PR #1 合并提交） |
| 功能分支起点 | `c5779f20c8f9011396cd0aea299f8c2b9cd9e240` | 由 `origin/main` 建立 `feat/p0-2-telemetry-wal` |
| 代码与测试提交 | `417413563f79a02c94f363ad0e6471da7fe5ff15` | 本报告所依据的实现 SHA |

未改动另一 worktree 中正在修订的 PR #3 分支 `docs/p0-1-merged-main-baseline`。

---

## 3. 四个指定风险的处理

实现位置：`packages/telemetry-sdk/src/index.ts`、`packages/telemetry-sdk/src/wal-lock.ts`。

### 3.1 多实例并发写同一 WAL 文件

- 每个 `walFilePath` 在客户端生命周期内持有 `${walFilePath}.lock`。
- 锁协议：`O_EXCL` 创建锁文件，写入 `pid` 与 Linux `/proc/<pid>/stat` 的 `starttime`，并 `fsync` 锁文件。第二个仍存活的持有者会被拒绝，抛出 `TelemetryWalLockError`，不会静默 last-write-wins 覆盖。
- `close()` 关闭锁 fd 并删除锁文件。进程 `SIGKILL` 后锁文件可能残留；后继客户端在确认持有者 pid 已不存在（Linux 上还会核对 starttime，减轻 pid 复用）后，将残留锁视为 stale 并获取新锁。
- **这不是内核 `flock`/`fcntl` 锁。** 它是协作式 lockfile 协议。无视该协议的进程仍可写同一 WAL。非 Linux、无法读取 `/proc` starttime 时，pid 复用残留风险更高。本轮未引入原生依赖。

测试：

- `refuses a second live client on the same WAL path and does not overwrite the first writer's snapshot`
- `allows a successor client after close() and after SIGKILL of a lock-holding child`

既有 P1-02 与 M4-03 是同进程“重启”模拟，已在打开后继客户端前补上 `close()`，原有断言未削弱。

### 3.2 崩溃遗留临时文件

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

### 3.3 rename 后目录项持久性（父目录 fsync）

- 在 complete tmp 的 rename、最终 WAL 的 rename、以及空 WAL 的 unlink 之后，以 `O_RDONLY|O_DIRECTORY` 打开父目录并 `fsync`，然后关闭。
- 指标：`walDirFsyncCount`、`walDirFsyncErrorCount`。在本机 Linux（Node v24.22.1）测试中，`records parent-directory fsync attempts after rename and does not treat that as a power-loss test` 观察到 `walDirFsyncCount > 0` 且 `walDirFsyncErrorCount = 0`。
- 这只证明该环境成功调用了 `fsync(dir)`。**未做真实断电。** 不得据此声称目录项在掉电后一定可见。同机 `SIGKILL` 后 rename 通常已经对后继进程可见，即使尚未 fsync 父目录；该现象不能替代断电测试。

### 3.4 flush 成功后 WAL 清理的恢复语义

- `flush()` 在 `transport.send` 成功之前不会把已交出的批次从 WAL 快照中清掉。若 send 期间发生并发 `enqueue`，磁盘快照仍包含 in-flight 批次与新事件。
- send 成功后，才持久化剩余队列；若剩余为空，则 **unlink 最终 WAL**（不再写空文件），清理 tmp，并 fsync 父目录。成功清理后的恢复不得把已导出事件救回。
- send 已成功但持久化清理尚未完成时崩溃：恢复会重放这些事件（at-least-once）。消费者须用已有的 `idempotencyKey` 去重。客户端不提供 exactly-once。
- 传输层若只对批次中部分事件成功随后失败，客户端会重试整批；部分成功的去重同样依赖消费者对 `idempotencyKey` 的处理。

测试：

- `replays events if the process crashes after a successful send but before durable WAL cleanup`
- `does not resurrect exported events after a durable post-flush WAL cleanup`
- `replays a full batch after transport failure even if a consumer already accepted part of it, and the consumer can dedupe by idempotencyKey`
- `keeps in-flight flush events in the WAL if a concurrent enqueue persists before send returns`

---

## 4. Phase 0 必须项对照

依据 `docs/architecture/handover/PHASE0_EXECUTION_PLAN.md` 中 P0-2 条款，对照如下。

| # | 必须完成项 | 本轮结果 |
| --- | --- | --- |
| 1 | 独立子进程作为 Client A；在不同写入阶段 `SIGKILL` 后由 Client B 恢复 | 已做。子进程 harness：`tests/integration/helpers/telemetry-wal-crash-child.ts`。覆盖 mid-write partial、complete tmp、rename 后、lock 持有中、send 成功但清理前。 |
| 2 | 部分写入中断、临时文件遗留的恢复或明确丢弃策略 | 已做并写明：partial 丢弃；complete 仅在最终 WAL 缺失且唯一时晋升。 |
| 3 | 原子 rename 后的恢复 | 已做：`recovers events after SIGKILL following atomic rename onto the final WAL path` |
| 4 | 评估并验证父目录 fsync / 断电持久性策略 | 已实现父目录 fsync，并在 Linux 测试环境观察到调用成功。**未做真实断电。** 未把损坏尾行或同机崩溃测试升级为断电通过。 |
| 5 | 容量上限下的保留与丢弃；每次丢弃必须有指标和审计信息 | 已做：`droppedCount` / `droppedByMaxWalBytes` / `droppedByMaxQueueItems` / `droppedByEnqueueError`，以及有界 `recentDrops`（eventId、idempotencyKey、reason、droppedAt）。测试：`evicts oldest events under maxWalBytes and records drop metrics plus audit info`。既有 P1-08 仍通过。 |
| 6 | 重复投递、部分批次成功的幂等恢复 | 已做 at-least-once 重放与消费者按 `idempotencyKey` 去重的测试。客户端本身不在恢复时静默丢弃同键事件。 |
| 7 | 同一 WAL 路径并发实例的安全性（加锁或明确拒绝） | 已做：明确拒绝第二个活实例（`TelemetryWalLockError`）。 |

---

## 5. 本地检查

命令在仓库根目录、功能分支 `feat/p0-2-telemetry-wal`、实现提交 `4174135` 上执行（本报告随后作为同一分支的后续提交写入，不改变上述实现 SHA 的含义）。

环境：Node v24.22.1，pnpm v10.34.6。时间：2026-11-28 13:30 CST（Asia/Shanghai）。

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
      Tests  54 passed (54)
   Start at  13:30:22
   Duration  838ms
```

相对合并后的 `main` 基线（此前记录为 8 个文件 / 42 个测试），本轮新增 1 个测试文件、12 个测试；既有测试全部保持通过，断言未削弱。

---

## 6. CI

PR：https://github.com/flykingvip-cloud/ai-optimization/pull/4 （OPEN，`base=main`，**未合并**，未获合并授权）

在包含代码提交 `417413563f79a02c94f363ad0e6471da7fe5ff15` 与本报告初稿的 HEAD `1c5c2ca1018d26b1f9f1bb7a1d1f0c6da2b50eb0` 上，GitHub Actions `CI / verify` 已成功：

- Run：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46112441099
- Job：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46112441099/job/140878768002
- 结论：`success`（约 16s）
- 完成时间：2026-11-28 13:31:09 CST（Asia/Shanghai）

该 CI 成功只证明工程检查通过。它不是生产验收，也不是合并或部署授权。若本文件随后以新提交写入该分支，新 HEAD 的 CI 需另行查看，但不改变上述针对 `1c5c2ca` 的 run 记录。

---

## 7. 遗留限制

1. **未做真实断电。** 父目录 fsync 已实现并在本测试环境调用成功，但不构成掉电耐久性证明。
2. 锁是协作式 lockfile，不是内核 flock。恶意或不兼容的写入者可以绕过。非 Linux 上 pid 复用缓解较弱。
3. 交付语义是 at-least-once，不是 exactly-once；也不保证 rename 之前未提交写入的零丢失。首次持久化若在 `.complete` 之前崩溃，事件会丢失。
4. 部分批次成功依赖下游按 `idempotencyKey` 去重；客户端会重试整批。
5. 同一进程内未调用 `close()` 的后继客户端会被拒绝。调用方需要在进程退出路径上 `close()`；硬杀进程则依赖 stale 检测。
6. 若测试环境的 `fsync(dir)` 失败，会增加 `walDirFsyncErrorCount`，rename/unlink 本身不会回滚。
7. 多个 complete tmp 且最终 WAL 缺失时 fail-closed，可能暂时无法自动恢复这些未提交快照。
8. 本轮未改 OIDC/JWKS、OpenBot、PostgreSQL、`M4_ACCEPTANCE_REPORT.md` 或对外 HTTP 契约。

---

## 8. 三层门禁（不得混淆）

| 门禁 | 含义 | 本轮结论 |
| --- | --- | --- |
| Engineering Complete | 代码、测试和（若已有）CI 证据通过 | **本分支本地检查已通过；针对 `1c5c2ca` 的 CI verify 已成功（run `46112441099`）。** PR 合并仍待单独审批。这是本文件记录的唯一进行中层。 |
| Integration Accepted | 真实 IdP、跨仓调用和目标基础设施验证通过 | **未达到。** |
| Production Accepted | 安全、可靠性、运维和发布门禁全部通过 | **未达到。** 生产准入保持关闭。 |

本 PR **未获合并授权**。不得把本文件当作生产就绪声明。
