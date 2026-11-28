# PR #4 WAL 处置 A/B/C 比较

> 工作包 A3。只比较成本、风险与架构影响，**不代 Owner 选择 A/B/C**。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> D-07 已批准原文：「OpenBot 自有、默认关闭、异步非阻塞的本地 WAL；不含并 PR #4。」该批准 **不是** 合并授权，也 **不是** 本表的选定结论。  
> 若选择 B，合并仍须获得**单独明确授权**。本阶段不得合并。PR #4 保持 `OPEN`。

禁止将进程崩溃测试表述为断电安全证明。禁止把 PR #4 WAL 描述为已在 `main` 上存在，或当作默认实施依赖。at-least-once 不是 exactly-once。协作式锁不是内核 flock。

---

## 1. 本轮复核事实

| 对象 | 状态 | 标签 |
| --- | --- | --- |
| `ai-optimization` `main` | 仍为 `16b01d99d33b386102bb9b2b248558eb5517e245`（Merge PR #3，2026-11-28 14:44:27 CST），**不包含** PR #4 | `GITHUB_VERIFIED` |
| [PR #4](https://github.com/flykingvip-cloud/ai-optimization/pull/4) | `OPEN`，非 draft；标题「P0-2: Telemetry WAL crash consistency (lock, leftover tmp, dir fsync, flush cleanup)」；HEAD `8324aa2441145bb1c685df5c8e65694277398f84`；`MERGEABLE` / `CLEAN`；base 指向 `c5779f20c8f9011396cd0aea299f8c2b9cd9e240`（Merge PR #1，2026-11-28 11:52:03 CST） | `GITHUB_VERIFIED` |
| merge-base 与其后 main | `c5779f2` 是当前 `main` 的祖先。`main` 此后仅并入文档向 PR #3。三方 diff `origin/main...HEAD`：9 个文件，+2410 / −47，含 `packages/telemetry-sdk/src/index.ts`、新增 `wal-lock.ts`、崩溃恢复测试与冻结文档 | `GITHUB_VERIFIED` / `SOURCE_VERIFIED` |
| PR #4 CI | [verify run 46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496) **success**，完成 2026-11-28 17:23:44 CST。只证明该 SHA 的单仓 verify，**不等于**跨仓验收 | `GITHUB_VERIFIED` |
| OpenBot 官方出站缓冲 | 当前 `main` `73013587` 相对 `b10ad59` 仅 `package.json` / `pnpm-lock.yaml`（body-parser 升级）。**仍不存在**官方 Telemetry Adapter 出站 WAL 实现 | `SOURCE_VERIFIED` |

`main` 现有 telemetry-sdk（弱 WAL，`SOURCE_VERIFIED`，blob `02928668f00fa8cd8e858836ecf742b9241da7b6`）：

- 不存在 `wal-lock.ts`。
- 恢复时读文件并解析行；损坏行被忽略。
- `persistWalAtomic`：tmp + 文件 fsync + rename；**无** leftover tmp 调和、**无** 父目录 fsync、**无** 活锁。
- 队列达到 `maxQueueItems`（默认 10_000）或序列化超过 `maxWalBytes`（默认 64 MiB）时 `this.queue.shift()` 并 `droppedCount++`（`packages/telemetry-sdk/src/index.ts` 110–112、129–135、161–163、184–186 行）。
- 多处 `catch` 吞异常。

该弱 WAL **不得**被描述为已满足崩溃恢复或 D-07 官方出站要求。它位于 AI Optimization SDK，也不是 OpenBot 自有出站缓冲。

PR #4 锁实现注释（`packages/telemetry-sdk/src/wal-lock.ts` 约 35–58 行，`SOURCE_VERIFIED`）明确：

- Linux 使用抽象 Unix socket 做进程级活锁；内核在进程退出（含 SIGKILL）时释放名称。
- `${walFilePath}.lock` 是 pid/starttime cookie，**不是**内核 flock。
- **协作式协议**：忽略该协议的进程仍可能并发写 WAL。
- 抽象 socket **仅 Linux**；其他平台 **fail-closed**。
- **不宣称**锁 cookie 的断电耐久性。

PR #4 仍适用的残余限制（冻结文档与源码注释，`SOURCE_VERIFIED`）：

- 已有进程崩溃 / SIGKILL 恢复测试，**没有真实断电或等效电源故障试验**。父目录 fsync 只是耐久意图。
- 语义为 at-least-once，**不是** exactly-once。
- 容量淘汰不删除未确认 in-flight，但尚未发送的 pending 在 `maxWalBytes` 下仍可能被 evict 并进入 drop audit。
- Engineering Complete / 单仓测试冻结不等于合并授权。

先前包的架构建议方向是：**以 C 作为 OpenBot 官方出站的默认方向，同时以 A 保留 PR #4 作对照；若未来需要强化 AI Optimization SDK 自身 WAL，再单独评审 B。** 该方向仅作为历史 `RECOMMENDATION` 记录，**不是**本阶段选定的处置，也不是 Owner 决定。

---

## 2. 三个选项

### 选项 A. 保持 PR #4 OPEN，作为参考，不进入主干

**含义：** 代码与测试留在开放 PR 中，供 OpenBot 自建缓冲或日后 SDK 评审对照。不合并，不把该包当作运行时依赖。

**成本：** 较低（无需合并验收与主干承担）。对照成本会随时间与 rebase 上升。`main` 弱 WAL 继续存在，若被误用仍会静默 `shift()` 丢事件。

**风险：** 不解决 OpenBot 出站问题本身；可能有人误把 `main` SDK 当成已满足 D-07。

**架构影响：** 与「OpenBot 仓内自建」最容易并行，跨仓运行时依赖最小。

### 选项 B. 经单独验收后，考虑合并为 AI Optimization 共享 WAL

**含义：** 另启合并授权与验收后，将 PR #4 合入 `ai-optimization` `main`，作为 AI Optimization 侧共享 telemetry-sdk WAL。

**成本：** 需要单独的合并授权、发布说明中保留限制、以及对「合并后仍不是 OpenBot 出站 WAL」的沟通成本。PR 以 `c5779f2` 为基，GitHub 现显示可干净合并，但仍须在获权后由合并执行者确认与 PR #3 文档提交的合并结果。

**风险与限制：**

- 合并 **不会**自动使 OpenBot 拥有官方出站缓冲。
- 不得把 PR #4 测试通过写成 OpenBot 跨仓验收通过。
- 非 Linux fail-closed、协作式锁、无断电证明等限制将进入主干，不得在合并后升级宣传。
- 仍须单独授权；本阶段不得合并。

**架构影响：** 强化 AI Optimization SDK 自身耐久性；若 OpenBot 再以该包为依赖，会引入跨仓版本耦合，与 D-07「OpenBot 自有」需要额外论证。不得把「OpenBot 直接依赖未合并或将要合并的 PR #4 包」当作隐藏默认项。

### 选项 C. 在 OpenBot 内独立实现官方出站 WAL，PR #4 不作为依赖

**含义：** 官方出站缓冲在 `openbot-vp` 内实现并验收。可以**对照** PR #4 的语义与测试经验，但必须重新实现、重新取证。PR #4 保持开放或日后再议，均不构成依赖。

**成本：** OpenBot 侧重复实现与测试；当前 OpenBot CI Gate 已红（见 G-06），新增实现不得以「让 CI 变绿」为理由削弱测试。本阶段也不得实施修复或开始编码。

**风险：** 若对照不充分，可能重复 `main` 弱 WAL 的静默丢弃缺陷。

**架构影响：** 最直接符合已批准的 D-07 原文「OpenBot 自有」；平台矩阵、默认关闭开关、与 Agent 主链隔离可按 OpenBot 运行环境设计；避免把 AI Optimization SDK 变成出站缓冲的运行时依赖。

---

## 3. 对五项关注点的影响

| 关注点 | 选项 A | 选项 B | 选项 C |
| --- | --- | --- | --- |
| OpenBot 自有 WAL | 不提供实现；仅提供对照材料。官方缓冲仍须在 OpenBot 另建 | 不自动提供 OpenBot 自有 WAL。若错误地直接依赖合并后的 SDK，会削弱「自有」边界 | 官方实现落在 OpenBot 仓内，符合 D-07 原文。PR #4 不是依赖 |
| 故障隔离 | 不改变现状：OpenBot 仍无官方异步出站缓冲；不得用 AI Optimization SDK 主路径阻塞 Agent | 合并只影响 AI Optimization SDK。OpenBot 若同步调用对端或误把 SDK flush 放进主链，隔离仍失败 | 可按默认关闭、异步非阻塞设计；对端故障不得进入主执行链。这是实现目标，不是已完成事实 |
| 重复投递 | 无官方出站重放。`main` 弱 WAL 与 PR #4 均不能代替 OpenBot 侧 at-least-once + 入库去重 | PR #4 明确 at-least-once，接收端仍须幂等去重。合并不改变「去重在接收端」 | 必须同样声明 at-least-once；出站生成稳定键，禁止用 Trace ID；依赖 D-06 入库去重（数字与冲突行为仍待批） |
| 运维责任 | AI Optimization 不把 PR #4 锁 / WAL 文件带入主干运维面。OpenBot 出站运维仍待实现后定义 | AI Optimization 需运维 Linux 限定活锁、WAL 文件、drop audit；跨平台 fail-closed 须写入运行要求 | 运维责任主要在 OpenBot 运行主机 / 配置开关；不引入对 PR #4 包的版本运维。支持矩阵须自行规定并重测 |
| 跨仓依赖 | 无运行时依赖。对照是文档与源码级的 | 若仅给 AI Optimization 自用，跨仓依赖有限；若 OpenBot 引用该包，则出现跨仓发布耦合 | 无对 PR #4 的依赖。契约仍通过官方 API / 事件格式耦合，这是必要契约而非 WAL 实现依赖 |

---

## 4. 无论选 A/B/C，OpenBot 官方缓冲都必须单独满足的下限

1. 默认关闭，无配置不得出站试探。
2. 主执行链不等待遥测网络。
3. at-least-once，不得宣称 exactly-once。
4. 未确认事件不得因容量静默丢失。
5. 崩溃恢复不得把 partial 文件晋升为已提交数据。
6. 不得用进程崩溃或 mock fsync 宣称断电耐久。
7. 不得用 PR #4 单仓测试代替 OpenBot 侧故障注入与跨仓第 9 项验收。

**当前结论：** PR #4 仍 `OPEN`、未批准合并；处置选项待 Owner 选择（`OWNER_DECISION_PENDING`）。实施与合并均未授权。`main` 弱 WAL 不满足崩溃恢复要求。
