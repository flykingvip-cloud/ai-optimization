# PHASE0_EXECUTION_PLAN.md

- **文档性质**：Phase 0 后续实施计划
- **制定日期**：2026-11-27（Asia/Shanghai，UTC+8）
- **负责人确认**：2026-11-27（Asia/Shanghai）。确认第 1–4 项：接受三仓当前 SHA 为 Phase 0 工程基线（非生产准入）；同意按 P0-1 → P0-2 → P0-3 → P0-4 实施；Knowledge SDK Wave2 暂不纳入；授权本文件与 `AGENT_HANDOVER_BASELINE_AUDIT.md` 经独立功能分支和 PR 入仓。该授权仅覆盖文档变更，不代表授权后续代码修改，也不授权现在开始 P0-1 代码实施。第 5 项同步协调。
- **依据**：`docs/architecture/handover/AGENT_HANDOVER_BASELINE_AUDIT.md` 与项目接管总指令 Phase 1–5
- **存放位置**：`docs/architecture/handover/PHASE0_EXECUTION_PLAN.md`
- **硬约束**：生产准入保持关闭。涉及跨仓接口、安全策略、Schema 或生产行为的实质性修改，须另获负责人授权后再开始。本文件入仓不授权 commit 代码、生产 Migration、生产切流或降低安全校验。

---

## 0. 冻结基线（实施前必须引用）

| 仓库 | 默认分支 | 当前 HEAD | 说明 |
|---|---|---|---|
| `flykingvip-cloud/ai-optimization` | `main` | `4716abb81a8b15e8b10b80cd04965b69eb7dcc15` | 已确认 M4 基线，无后续主线提交。CI Run `45932557643` success（8 files / 26 tests）。 |
| `flykingvip-cloud/openbot-vp` | `main` | `d20d7f7cd45199da0b68d9623336d4e69c999223` | 已超越历史参考 `58287aa449fb499f49080c467df76b774b458222` 共 23 个提交。专项审计短 SHA `25b6613e6` 当前无法解析。HEAD 上 3 个 Actions run 均为 failure（无 runner / 日志 404）。 |
| `flykingvip-cloud/knowledge-sdk` | `main` | `b953c9922cc1096e0e88455dab6746c01a9d27f9` | tests Run `45536468206` success。联合审计参考 `9940818b962ccb186c0dfb0158de6bd9bd49057b` 在未合入分支 `feat/align-wave2-m2-min-slice` 上，比 main 超前 46 个提交。 |

实施时若发现任一默认分支已前进，必须先重新审计差异，不得在过期 SHA 上默默继续。

---

## 1. 建议的执行顺序（先做什么）

**Phase 0 收尾状态（2026-11-27 负责人已确认第 1–4 项，仍不改代码）：**

1. 三仓当前 SHA 已接受为 Phase 0 工程基线（非生产准入）。OpenBot 短 SHA `25b6613e6` 当前无法解析，保留为文档追溯缺口，不阻塞本文件入仓。
2. Knowledge SDK Wave2 未合入分支已确认**不纳入**本阶段，只以当前 `main` 理解边界。
3. 本文件与 `AGENT_HANDOVER_BASELINE_AUDIT.md` 经独立功能分支和 PR 写入 `docs/architecture/handover/`。入仓只授权文档变更，不直接改 `main`，也不授权开始 P0 代码修改。`M4_ACCEPTANCE_REPORT.md` 的分层表述纠正放在 P2，本 PR 不改该原件，避免在未获单独授权时改写既有验收报告。
4. 第 5 项（OpenBot HEAD 上失败 Actions 由维护者先恢复可观测性）同步协调，不阻塞本文档入仓，也不作为现在开始 P0-1 的前提。

**按 P0 → P1 → P2 实施前，P0 代码修改仍须另获授权。不要并行启动会改安全策略或 Schema 的多项工作。**

生产准入在下列全部条件满足并经负责人审批前，不得提出申请，更不得切流。

---

## 2. P0（必须先做，对应总指令 Phase 1–4）

目标文件建议统一放入仓库 `docs/architecture/handover/`（若负责人要求更新原路径上的报告，则更新原件并在 handover 目录留索引，避免重复权威）。

### P0-1 关闭 OIDC/JWKS 安全缺口（Phase 1）

- **目标产出**：`OIDC_JWKS_SECURITY_REVERIFICATION_REPORT.md`
- **仓库**：主要在 `ai-optimization`；不把 localhost 测试写成生产 IdP 通过。
- **必须完成**（对照审计已证实的缺口，而不是再发明新范围）：
  1. 流式读取并限制响应体大小（替换先 `res.text()` 再计字节的实现）。
  2. 保持并补强 Discovery issuer 精确校验。
  3. 独立测试并拒绝：非 HTTPS `jwks_uri`（即使 issuer 为 HTTPS）。
  4. HTTP 重定向目标限制。
  5. DNS/IP 级 SSRF 防护，或书面规定“仅允许的 JWKS 主机/CIDR”，并在代码中强制。
  6. `kty` / `alg` / `key_ops` / `use` 组合过滤测试（含 `use=enc`、算法不匹配、无效 JWK）。
  7. 超时、非法 JSON、超大响应、失败负缓存、并发刷新（singleflight）、密钥轮换、未知 kid。
  8. 过期令牌、认证错误与授权错误区分、跨租户拒绝（补齐当前 `m4-oidc-jwks.test.ts` 标题过声称的部分）。
  9. 真实生产 IdP 联调计划与一次受控联调；在联调完成前，报告必须单列“工程标准已达 / 生产 IdP 未完成”。
- **测试不得降低校验以换取绿条。**
- **等待确认的原因**：改动认证信任根与出站请求策略，属于安全策略变更。

### P0-2 Telemetry WAL 崩溃一致性（Phase 2）

- **目标产出**：`TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md`
- **仓库**：`packages/telemetry-sdk` 及对应测试。
- **必须完成**：
  1. 独立子进程作为 Client A；在不同写入阶段 `SIGKILL` 后由 Client B 恢复。
  2. 部分写入中断、临时文件遗留的恢复或明确丢弃策略。
  3. 原子 rename 后的恢复。
  4. 评估并验证父目录 fsync / 断电持久性策略；若操作系统或测试环境无法做真实断电，必须在报告中标明“未做真实断电”，不得把损坏尾行测试升级为断电通过。
  5. 容量上限下的保留与丢弃；每次丢弃必须有指标和审计信息。
  6. 重复投递、部分批次成功的幂等恢复。
  7. 同一 WAL 路径并发实例的安全性（加锁或明确拒绝）。
- **等待确认的原因**：可能改变 WAL 文件格式、丢弃语义或并发访问契约。

### P0-3 OpenBot 真实状态机跨仓联调（Phase 3）

- **目标产出**：`OPENBOT_AI_OPTIMIZATION_CROSS_REPO_E2E_REPORT.md`
- **必须先再审计**当时的 OpenBot HEAD（当前为 `d20d7f7…`，实施时可能已变），再设计联调方案。
- **技术方案建议**（需负责人选择其一后再写代码）：
  - 跨仓 CI：固定 OpenBot Commit SHA，用受控 checkout / submodule / 独立 contract-test package；禁止测试随意跟踪 OpenBot HEAD。
  - 必须调用真实 `packages/evolution-core/src/state-machine.ts`，停止把冻结表当作最终验收依据。
  - 明确区分四级证据：A 真实状态机函数测试；B Adapter 集成测试；C Evolution Control 执行器沙箱测试；D 生产环境测试。通过 A 不得写成 D。
- **行为差必须纳入测试**：当前冻结表将 `ROLLED_BACK:rollback` 视为幂等；真实状态机没有该转移，会落到 `illegal_transition`。联调应以 OpenBot 真实语义为准，而不是为迁就旧测试去改 OpenBot 状态机。
- **闭环最小路径**：签名 Artifact → OpenBot 取 bundle 并验签（租户 / Agent / 版本 / Epoch / 审批）→ 人工审批 → Canary → 撤销得 410 或可信撤销通知 → Rollback 并真正恢复 `rollbackTargetArtifactId` → 回传 `deployment.rollback.completed` → 终态与重复事件幂等。
- **当前前置缺口**：OpenBot 尚无 AI Optimization Adapter；HEAD CI 无成功测试证据。若 Actions 配额或工作流不可用，跨仓 CI 方案需负责人确认替代证据通道，不得用口头或本地一次运行代替。
- **等待确认的原因**：跨仓接口、固定 SHA、CI 设计都属于跨仓契约。

### P0-4 PostgreSQL 持久化验证（Phase 4）

- **目标产出**：`POSTGRESQL_PERSISTENCE_ACCEPTANCE_REPORT.md`
- **必须**：在真实 PostgreSQL 服务（测试环境，非生产库、非生产数据）上验证 Repository / Schema / 唯一约束 / 外键 / 事务 / 并发 / 租户隔离 / Dataset 版本不可变 / Evaluation·Experiment·Artifact 持久化 / 空库 Migration / 升级与回滚方案。
- **明确禁止**：把现有 `node:sqlite` 测试结论写成 PostgreSQL 已通过；自动连接生产库；未经审批的破坏性 DDL。
- **等待确认的原因**：Schema 与 Migration 策略变更。

---

## 3. P1（总指令 Phase 5，在 P0 证据可复核之后）

### P1-1 正式 OpenBot Adapter 与生产联调准备

- **目标产出**：`OPENBOT_AI_OPTIMIZATION_PRODUCTION_INTEGRATION_PLAN.md`
- **OpenBot 侧审计与实现（不得破坏生产执行权威）**：
  - W3C TraceContext / `traceparent`、`runId`、`promptVersion`、`modelVersion`、`toolPolicyVersion`、`experimentId`
  - 用户反馈与 `runId` 绑定
  - 脱敏、异步、可限流、失败不阻塞 Agent 的 Telemetry 外发
  - Optimization Artifact 消费适配器：验签、版本兼容、审批、Canary、Rollback
- **AI Optimization 侧**：
  - 稳定、版本化的 API 契约；补齐 HTTP 面与 OpenAPI 的偏差（Dataset versions 路径、Evaluation jobs、Experiment HTTP、Artifact 创建与 ReleaseRequest 等），或以正式版本协商收缩 OpenAPI，禁止 silently 让文档和实现继续分叉
  - JWT/OIDC、租户授权、Telemetry 幂等、可观测性
- **必须保持**：不共享数据库；不双写权威数据；不把 TaskOutcome 复制成第二套账本；不绕过 Evolution Control；不自动把未审批制品送进生产。
- **等待确认的原因**：正式跨仓 Adapter 与契约变更。

### P1-2 生产就绪缺口登记

- **目标产出**：`PRODUCTION_READINESS_GAP_REGISTER.md`
- 把 P0/P1 仍开放的项、P0 缺陷、未评估高危安全问题、迁移回滚方案、生产密钥管理、监控告警、审批责任人做成可勾选登记册。
- 在登记册全绿且负责人审批前，不得提出生产准入申请。

---

## 4. P2（必要但不阻塞 P0 启动；不得抢占 P0）

1. **文档权威整理**：入仓时更新或索引 `M4_ACCEPTANCE_REPORT.md` / 兼容性矩阵，纠正将冻结表、localhost IdP、SQLite 写成与跨仓/生产同级 Pass 的表述；处理失效的 OpenBot SHA `25b6613e6` 引用。
2. **OpenBot HEAD CI 可观测性**：与 OpenBot 维护者协同查清当前 3 个 failure run（无 runner、日志 404）的原因。PR #355 作者声称配额耗尽，本审计未能从日志核实。这不影响 AI Optimization 单仓工作，但会阻塞可信的跨仓 CI。
3. **Knowledge SDK**：持续遵守边界。不将知识资产、ACL、检索、Evidence 迁入另外两仓。Wave2 未合入分支不在本阶段实施范围，除非负责人另行授权。
4. **Dataset / Artifact 深度复核**（不改变既定语义，只补证据）：`deleteVersion`、扫描绕过路径、golden 写入保护、HTTP 与服务层错误码一致性、公钥轮换与私钥托管方案。
5. **OpenBot 未合入 PR 观察**：#355 仅为治理文档草稿；#327 明确不建议整包合入。实施跨仓工作前应再次列出开放 PR，避免覆盖他人进行中的工作。不得强制推送，不得无审批删除远端分支。

---

## 5. 七份目标文件与阶段对应

| 文件 | 阶段 | 优先级 | 何时可以开始撰写入仓版 |
|---|---|---|---|
| `AGENT_HANDOVER_BASELINE_AUDIT.md` | Phase 0 | P0 | 负责人已确认；本 PR 入仓 |
| `PHASE0_EXECUTION_PLAN.md`（本文件，可作为 handover 附件） | Phase 0 | P0 | 负责人已确认；本 PR 入仓 |
| `OIDC_JWKS_SECURITY_REVERIFICATION_REPORT.md` | Phase 1 | P0 | P0-1 实施并取得测试 + CI 证据之后 |
| `TELEMETRY_WAL_CRASH_RECOVERY_REPORT.md` | Phase 2 | P0 | P0-2 之后 |
| `OPENBOT_AI_OPTIMIZATION_CROSS_REPO_E2E_REPORT.md` | Phase 3 | P0 | 真实状态机（及尽可能的执行器）联调之后 |
| `POSTGRESQL_PERSISTENCE_ACCEPTANCE_REPORT.md` | Phase 4 | P0 | 真实 PostgreSQL 测试环境验证之后 |
| `OPENBOT_AI_OPTIMIZATION_PRODUCTION_INTEGRATION_PLAN.md` | Phase 5 | P1 | P0 主要缺口关闭方案已确认之后即可并行起草，但 Adapter 落地在 P1 |
| `PRODUCTION_READINESS_GAP_REGISTER.md` | 贯穿 | P1 定稿 | Phase 0 可先建登记草稿；P0/P1 结束后定稿 |

每份入仓报告必须引用：Commit SHA、文件路径、测试名称、CI Run、实际结果。不能只写“已完成”。

---

## 6. 工程执行规范（实施阶段仍须遵守）

每次实施前说明：当前仓库与 Commit、修改目标、影响范围、设计、测试方案、风险、是否破坏性操作。

每次实施后提供：修改文件、关键变更、测试命令与结果、CI Run、Commit SHA、未覆盖场景、遗留风险。

Git：功能分支 + PR；合并前 CI 成功；不覆盖他人工作；不强制 push；不自动改生产配置；不未经批准做生产 Migration 或切流。

---

## 7. 生产准入（再次声明）

当前 **关闭**。本 Agent 无权自行批准生产切流。

即使 P0/P1 代码与测试全部完成，仍需同时满足：全部 P0 缺陷关闭、无未评估高危安全问题、迁移有回滚方案、生产密钥管理已确认、监控告警已配置、责任人完成审批。任一缺失都不得把状态写成“生产就绪”。

---

## 8. 请负责人确认后再开始的事项（清单）

在获得书面确认之前，**不得开始**下列实质性修改：

1. 改动 OIDC/JWKS 出站策略、流式限制、重定向与 SSRF 规则。
2. 改动 Telemetry WAL 格式、fsync/锁/丢弃语义。
3. 引入跨仓 CI、submodule 或固定 OpenBot SHA 的测试依赖。
4. 在 OpenBot 增加 AI Optimization Adapter 或生产 Telemetry 外发。
5. 增加或修改 PostgreSQL Schema / Migration。
6. 收缩或扩展对外 OpenAPI / HTTP 契约。
7. 将其他报告写入三个仓库，或修改 `M4_ACCEPTANCE_REPORT.md` 等既有验收文件（本 PR 仅入仓已经授权的两份 Phase 0 文档）。
8. 以任何形式连接或迁移生产数据库、切换生产流量。

第 1–4 项已确认，但 **P0 代码修改仍须另获授权**。获授权后建议的第一项实施：P0-1（OIDC/JWKS），因为它封闭在 AI Optimization 单仓、不依赖 OpenBot CI 恢复，且是生产 IdP 联调的前提。P0-2 可在 P0-1 测试稳定后启动。P0-3 需与 OpenBot 维护者同步固定 SHA 与 CI 通道。P0-4 需先准备独立的测试用 PostgreSQL，不得指向生产。
