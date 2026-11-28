# OPENBOT_TELEMETRY_WAL_ACCEPTANCE.md

> OpenBot 内部异步遥测缓冲的行为与验收标准（决策收口，不实施）。  
> 原则「在 OpenBot 仓内实现默认关闭的本地异步缓冲，不依赖尚未合并的 PR #4；语义为 at-least-once，不得宣称 exactly-once」是本阶段指令要求固化的方向，**不是**正式 `APPROVED`。  
> **PR #4 的 WAL 不得视为 `ai-optimization` `main` 已具备的能力，本阶段不合并。**  
> 核验窗口：2026-11-28 19:19–19:23 CST。

---

## 1. 必须严格区分的两套对象

| 对象 | SHA / 状态 | 性质 |
| --- | --- | --- |
| `ai-optimization` `main` 现有 telemetry-sdk | `@16b01d99d33b386102bb9b2b248558eb5517e245` | **源码验证事实：** 存在弱 WAL。`packages/telemetry-sdk/src/wal-lock.ts` **不存在**。`enqueue` / `flush` / `persistWalAtomic` 在多处 `catch` 中吞掉异常；队列达到 `maxQueueItems` 时 `this.queue.shift()` 并增加 `droppedCount`（`packages/telemetry-sdk/src/index.ts` 约 111、132、145–169、181–190 行）。这 **不满足**「未确认事件不得因容量淘汰静默丢失」，也 **不是** OpenBot 出站缓冲。 |
| PR #4 更强 WAL（未合并） | HEAD `8324aa2441145bb1c685df5c8e65694277398f84`，OPEN，CI verify [46130248496](https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46130248496) success | **源码验证事实（仅对照，非 main 能力）：** 新增 `packages/telemetry-sdk/src/wal-lock.ts`。注释与报告明确：Linux 抽象 Unix socket 活锁，非 Linux **fail-closed**；协作式协议，不是对 WAL 文件的内核 flock；交付语义 at-least-once，不是 exactly-once；容量淘汰不删除未确认 in-flight 事件，但尚未发送的 pending 队列在 `maxWalBytes` 下仍可能被 evict 并进入 drop audit；**未做真实断电**。文档：`docs/architecture/handover/TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md`。 |
| OpenBot 官方出站缓冲 | `openbot-vp@13763b2d` | **源码验证事实：** 无官方 Telemetry Adapter 出站缓冲实现。本文件定义的是**若获批后应在 OpenBot 仓内自建**的验收标准，而不是已有代码。 |

架构建议：OpenBot 缓冲在本仓实现；可以**对照** PR #4 的语义与测试经验，但必须重新在 OpenBot 侧实现与验收，不得把 PR #4 当作默认依赖或已合并库。

---

## 2. 验收标准（建议，待与 D-07 一并签批）

### 2.1 默认关闭与故障隔离

1. **默认关闭。** 未显式配置出站目标 / 开关时不得发送，不得打开网络连接去「试探」AI Optimization。
2. **主执行链不等待遥测网络请求。** Agent 任务成功或失败不得取决于遥测 POST 是否完成。
3. AI Optimization 不可用、超时、5xx、证书错误或网络中断，**不得影响** Agent 执行、Readiness 或 Control Plane。
4. 缓冲初始化失败或开关关闭时，行为是不发送，而不是同步抛到主路径导致任务失败（可记录本地诊断）。具体「关闭时是否记本地未发送指标」待实施计划细化，但不得反向耦合主链。

### 2.2 投递语义

5. 语义为 **at-least-once**。崩溃后允许重放已发送但未完成清理的事件。
6. **不得宣称 exactly-once。** 接收端必须以 Tenant + Idempotency Key 去重。
7. 幂等键不得使用 Trace ID（见 D-04 与 API 文档）。

### 2.3 丢失、容量与错误

8. **未确认（in-flight / 已进入发送但未得到成功确认）的事件不得因容量淘汰而静默丢失。** 若新事件无法在保留未确认集合的前提下写入，应拒绝该新事件并审计，而不是踢掉未确认集合。
9. 尚未发送的 pending 事件若因容量被淘汰，**不得静默**：必须有审计与指标。是否允许淘汰 pending，是实施细节，须在计划中写明并不得与第 8 条冲突。本阶段建议：优先反压 / 拒绝新事件，避免无审计丢弃。
10. 磁盘错误、目录不可读、fsync 失败、锁不可用：必须 fail-closed 于缓冲写入路径（标记不健康、可观测），**同时仍不得同步失败 Agent 主链**。二者并存：遥测持久化失败是遥测子系统失败，不是任务失败。
11. 崩溃恢复：进程重启后应恢复未确认与已持久未发送事件，并继续至少一次投递。损坏的尾部记录不得让整个缓冲不可恢复；也不得把明显截断的 partial 文件晋升为已提交数据（PR #4 对此有可对照实现，但仍须在 OpenBot 侧再验收）。
12. 重试：对 429 / 5xx / 超时 / 网络中断可重试；对明确的 400/401/403 契约拒绝应停止对同一非法事件的盲目重试并审计。分类表待计划细化。
13. 清理顺序：成功确认后才从持久缓冲移除；清理窗口崩溃允许 at-least-once 重放，不得把已退役批次从陈旧临时文件错误复活（若采用类似 cleanup sentinel 的设计，须有测试）。

### 2.4 锁与平台

14. 若采用单文件 WAL 多进程互斥：必须记录操作系统支持范围。PR #4 的活锁依赖 **Linux 抽象 Unix socket**，非 Linux fail-closed。OpenBot 若借鉴该设计，必须在文档与测试中写明支持矩阵；不得在 macOS / Windows 上假装已有同等活锁，除非另实现并举证。
15. 锁是协作式协议时，必须在文档中写明：无视协议的进程仍可能并发写。不得宣传为内核强制 flock（除非真的实现并测试了该机制）。
16. **不宣称已证明断电级数据持久性**，除非有真实断电或等效故障试验证据。父目录 fsync 成功只是耐久意图，不是断电证明。PR #4 报告已写明「未做真实断电」，OpenBot 缓冲不得写得更强。

---

## 3. 与 PR #4 的关系（待 Owner 的 O-07）

| 选项 | 说明 | 本阶段立场 |
| --- | --- | --- |
| A. 不合并 PR #4，OpenBot 自建缓冲 | 符合本阶段指令 | **建议作为默认方向**，待签批 |
| B. 另启 PR #4 合并评审，供 AI Optimization 入站/SDK 使用 | 与 OpenBot 出站缓冲仍是两件事，即使合并也不能自动成为 OpenBot 依赖 | 须单独授权，本阶段不做 |
| C. 把 OpenBot 出站直接依赖未合并或将来合并的 PR #4 包 | 违反「不预设依赖」 | **不建议** |

无论选 A 或 B，main 上较弱的 WAL **不得**被描述为已满足本文件第 2 节。

---

## 4. 验收测试（建议最低集）

1. 默认配置下无出站网络调用（可用测试桩断言）。
2. 打桩使 POST 阻塞或失败：Agent 主路径仍在超时预算内完成成功 / 失败判定。
3. 进程在 send 成功、清理完成前被 SIGKILL：重启后出现重放，接收端靠幂等去重，无双份业务记录。
4. 进程在 rename 提交前被杀死：不把 partial 当已提交；不出现静默损坏后的假成功。
5. 未确认事件存在时填满容量：未确认集合仍在，新事件被拒绝或进入带审计的回压，而非未确认集合消失。
6. 非支持平台或锁被占用：行为符合文档（拒绝第二写者或 fail-closed），有日志。
7. 不得用「单测里 mock 了 fsync」宣称断电耐久。

**当前结论：** D-07 原则由本阶段指令要求固化；实施仍 **BLOCKED**；PR #4 未合并；正式状态 **非 APPROVED**。
