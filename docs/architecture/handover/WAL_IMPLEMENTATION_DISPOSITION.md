# WAL_IMPLEMENTATION_DISPOSITION.md

> PR #4 WAL 的独立处置决策材料（T5）。  
> 核验窗口：2026-11-28 21:43–21:50 CST（Asia/Shanghai）。  
> **本阶段只给出选项与风险，不合并、不实施。PR #4 的合并必须单独授权。**  
> 禁止将进程崩溃测试表述为断电安全证明。禁止把 PR #4 当作 `main` 已具备的能力或默认实施依赖。

---

## 1. 本轮复核事实

| 对象 | 状态 | 标签 |
| --- | --- | --- |
| `ai-optimization` `main` | `16b01d99d33b386102bb9b2b248558eb5517e245`，与上一阶段相同，未包含 PR #4 | `GITHUB_VERIFIED` |
| PR #4 | `OPEN`，标题「P0-2: Telemetry WAL crash consistency…」，HEAD `8324aa2441145bb1c685df5c8e65694277398f84`，`MERGEABLE` / `CLEAN`，`reviewDecision` 为空，无评论、无审查 | `GITHUB_VERIFIED` |
| 与 `main` 的 merge-base | `c5779f20c8f9011396cd0aea299f8c2b9cd9e240`（Merge PR #1，2026-11-28 11:52:03 CST）。`main` 此后仅并入文档向 PR #3，PR 仍显示可干净合并 | `GITHUB_VERIFIED` |
| SHA 对齐 CI | [run 46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496) `verify` **success**，完成 2026-11-28 17:23:44 CST。只证明该 SHA 的单仓 verify | `GITHUB_VERIFIED` |
| 变更范围 | 相对 `origin/main...HEAD`：9 个文件，+2410 / −47，含 `packages/telemetry-sdk/src/index.ts`、新增 `wal-lock.ts`、崩溃恢复测试与冻结文档 | `GITHUB_VERIFIED` / `SOURCE_VERIFIED` |
| OpenBot 官方出站缓冲 | 当前 `main` `@b4e106de`（相对 `13763b2d` 仅 UI 文件变化）**仍不存在**实现 | `SOURCE_VERIFIED` |

`main` 现有 telemetry-sdk（弱 WAL，`SOURCE_VERIFIED`）：不存在 `wal-lock.ts`；队列达到 `maxQueueItems` 时 `this.queue.shift()` 并增加 `droppedCount`（`packages/telemetry-sdk/src/index.ts` 110–112、161–163、184–186 行）。这不满足「未确认事件不得因容量淘汰静默丢失」，也不是 OpenBot 出站缓冲。

PR #4 锁实现注释（`packages/telemetry-sdk/src/wal-lock.ts` 35–58 行，`SOURCE_VERIFIED`）明确：

- Linux 使用抽象 Unix socket 做进程级活锁；内核在进程退出（含 SIGKILL）时释放名称。
- `${walFilePath}.lock` 是 pid/starttime cookie，不是内核 flock。
- **协作式协议**：忽略该协议的进程仍可能并发写 WAL。
- 抽象 socket **仅 Linux**；其他平台 **fail-closed**。
- **不宣称锁 cookie 的断电耐久性**。

PR #4 冻结文档与先前验收已记录、且本轮 SHA 未变故仍然适用的残余限制：

- 已有进程崩溃 / SIGKILL 恢复测试，**没有真实断电或等效电源故障试验**。
- 语义为 at-least-once，**不是** exactly-once。
- 容量淘汰不删除未确认 in-flight，但尚未发送的 pending 在 `maxWalBytes` 下仍可能被 evict 并进入 drop audit。
- Engineering Complete 冻结不等于合并授权。

---

## 2. 三个处置选项

### 选项 A. 保持 PR #4 OPEN，作为后续参考，不进入主干

**含义：** 代码与测试留在开放 PR 中，供 OpenBot 自建缓冲或日后 SDK 评审对照。不合并，不把该包当作运行时依赖。

**优点：** 不把未完成断电验证、Linux 限定活锁的实现带入 `main`；不影响当前主干弱 WAL 的既有行为边界（尽管弱 WAL 本身不满足 D-07）。与「OpenBot 仓内自建」最容易并行。

**风险：** `main` 继续只有较弱 WAL，若有人误把 `main` SDK 用于新场景，仍会静默 `shift()` 丢事件。开放 PR 可能 rebases 漂移，对照成本上升。不解决 OpenBot 出站问题本身。

### 选项 B. 经单独验收后合并 PR #4，作为共享 WAL 实现

**含义：** 另启合并授权与验收后，将 PR #4 合入 `ai-optimization` `main`，作为 AI Optimization 侧共享 telemetry-sdk WAL。

**优点：** 单仓崩溃一致性、锁、leftover tmp、dir fsync、fail-closed 目录读取等加固可进入主干；后续 SDK 使用方可复用测试。

**风险与限制：**

- 合并 **不会**自动使 OpenBot 拥有官方出站缓冲。
- 不得把 PR #4 测试通过写成 OpenBot 跨仓验收通过。
- 非 Linux fail-closed、协作式锁、无断电证明等限制将进入主干，必须在发布说明中保留，不得在合并后升级宣传。
- 仍须单独授权；本阶段不得合并。

### 选项 C. OpenBot 仓库内独立实现，PR #4 不作为依赖

**含义：** 官方出站缓冲在 `openbot-vp` 内实现并验收。可以**对照** PR #4 的语义与测试经验，但必须重新实现、重新取证。PR #4 保持开放或日后再议，均不构成依赖。

**优点：** 符合 D-07「OpenBot 自有」；平台矩阵、配置开关、与 Agent 主链隔离可以按 OpenBot 运行环境设计；避免跨仓版本耦合。

**风险：** 需要在 OpenBot 侧重复实现与测试成本；若对照不充分，可能重复 main 弱 WAL 的静默丢弃缺陷。OpenBot 当前 CI 已红，新增实现不得以「让 CI 变绿」为理由削弱测试（本阶段也不得实施修复）。

**本阶段架构建议（`RECOMMENDATION`，非批准）：** 以 **C** 作为 OpenBot 官方出站的默认方向，同时以 **A** 保留 PR #4 作对照；若未来需要强化 AI Optimization SDK 自身 WAL，再单独评审 **B**。不得选择「OpenBot 直接依赖未合并或将要合并的 PR #4 包」作为隐藏选项。

---

## 3. 逐项比较

| 比较项 | `main` 弱 WAL（16b01d9） | PR #4（8324aa2，未合并） | 选项 C（OpenBot 自建，尚未存在） |
| --- | --- | --- | --- |
| 锁机制与平台兼容性 | 无 `wal-lock.ts` | Linux 抽象 Unix socket 活锁 + lock cookie；协作式，非 flock；非 Linux fail-closed | 必须自行规定支持矩阵；若借鉴 PR #4，须在本仓重测，不得在 macOS/Windows 上假装已有同等活锁 |
| 崩溃恢复 | 未达到 PR #4 测试覆盖；异常多处被吞 | 有 SIGKILL / leftover tmp / 提交窗口等测试 | 必须在 OpenBot 侧做同等或更严的故障注入；不得用 PR #4 测试替代 |
| `.cleanup` / sentinel 生命周期 | 弱于 PR #4 | 冻结文档记录了清理与复活窗口的修复 | 若采用类似 sentinel，须有本仓测试，避免陈旧临时文件复活 |
| at-least-once | 不能作为满足 D-07 的证据 | 明确 at-least-once，非 exactly-once | 必须同样声明 at-least-once，接收端去重 |
| idempotency key 与下游去重 | SDK 不代替入库 UNIQUE | 不改变「去重在接收端」的边界 | 出站生成稳定键，禁止用 Trace ID；依赖 D-06 入库去重 |
| 队列容量与背压 | 满员 `shift()`，`droppedCount++`，存在静默丢弃已入队事件的路径 | 不删除未确认 in-flight；pending 在字节上限下仍可能 evict（须审计） | 建议优先反压/拒绝新事件；未确认集合不得静默消失 |
| 发送失败 / 磁盘失败 | 多处 `catch` 吞异常，证据不足表明已 fail-closed | 目录读取等路径已改为 fail-closed（相对 PR #4 代码） | 磁盘/锁失败必须可观测且 fail-closed 于缓冲路径，同时不得同步失败 Agent 主链 |
| 是否可能静默丢弃 | **是**（`shift` + 被吞异常） | 未确认集合不可静默淘汰；pending evict 须走 drop audit，不得无审计丢弃 | 验收必须包含「无静默丢弃未确认事件」 |
| 进程退出与 SIGKILL 恢复 | 不足以为 D-07 举证 | 有进程杀死恢复测试 | 必须重做；重启后至少一次投递，靠幂等去重 |
| 断电 / 电源故障是否已验证 | 否 | **否**。父目录 fsync 只是耐久意图 | **不得写得更强**。无真实断电试验不得宣称断电安全 |

---

## 4. 验收下限（无论选 A/B/C，OpenBot 官方缓冲都必须单独满足）

1. 默认关闭，无配置不得出站试探。
2. 主执行链不等待遥测网络。
3. at-least-once，不得宣称 exactly-once。
4. 未确认事件不得因容量静默丢失。
5. 崩溃恢复不得把 partial 文件晋升为已提交数据。
6. 不得用进程崩溃或 mock fsync 宣称断电耐久。

**当前结论：** PR #4 仍 OPEN、未批准合并；处置选项待 Owner 选择（`OWNER_DECISION_PENDING`）。实施与合并均未授权。
