# M4 OpenBot × AI Optimization 沙箱联合验收报告（补证定稿版）

- **目标仓库**：`https://github.com/flykingvip-cloud/ai-optimization` (`main`)
- **OpenBot 参考基线**：`25b6613e6`（未修改 OpenBot 主业务代码、未删除 AOR）

---

## 一、M4-01 ~ M4-07 逐项联合验收矩阵

| 编号 | 验收主题 | 核心实证路径 | 实际测试行为 | 验收结论 |
|---|---|---|---|---|
| **M4-01** | 跨系统契约兼容性核对 | `docs/architecture/M4_01_CONTRACT_COMPATIBILITY_MATRIX.md`, `tests/contract/contracts.test.ts` | Ajv 2020-12 校验 6 套 JSON Schema 与 OpenAPI 3.1 | **Pass (4/4)** |
| **M4-02** | 加固后 OIDC Discovery / JWKS 密钥轮换 | `packages/shared-contracts/src/oidc-jwks.ts`, `tests/m4-sandbox/m4-oidc-jwks.test.ts` | 本地 HTTP IdP、强制 `issuer` 与 HTTPS 校验、忽略 `use: "enc"` 密钥、轮换 `rot-1 → rot-2`、超时与负缓存、`401`/`403` | **Pass (2/2)**（限本地测试 IdP） |
| **M4-03** | Telemetry 进程崩溃 WAL 恢复与故障隔离 | `packages/telemetry-sdk/src/index.ts`, `tests/m4-sandbox/m4-full-sandbox-e2e.test.ts` | Client A 写入 WAL 并追加损坏尾部模拟崩溃 → Client B 重启恢复并补发 → 幂等去重 | **Pass** |
| **M4-04** | Dataset HTTP 治理、Evaluation 与 Experiment | `tests/m4-sandbox/m4-full-sandbox-e2e.test.ts` | HTTP `POST /v1/datasets/ds_m4` 验证 `201`、不可变 `409`、PII `400`、跨租户 `403` + Evaluation + Experiment | **Pass** |
| **M4-05** | Artifact 完整签名、作用域、撤销与防重放 | `services/artifact-registry/src/index.ts`, `tests/integration/secondary-audit-remediation.test.ts` | 逐字段篡改拒绝、`min/maxOpenBotVersion`、`agentIds`、`approvalPolicy`、`410 revoked`、`monotonicEpoch` | **Pass (5/5)** |
| **M4-06** | OpenBot 状态机 Canary → Rollback 闭环 | `tests/m4-sandbox/m4-full-sandbox-e2e.test.ts` | 本地调用 `openbot/packages/evolution-core/src/state-machine.ts`（CI 用等价冻结状态机）执行 `apply_canary → CANARY → 410 → rollback → ROLLED_BACK` 并回传 `deployment.rollback.completed` | **Pass** |
| **M4-07** | 联合验收汇总、兼容性差异与风险定界 | `docs/architecture/M4_ACCEPTANCE_REPORT.md` | 汇总全部测试证据、SQLite ↔ PostgreSQL 差异及生产准入前置项 | **Pass** |

---

## 二、SQLite vs PostgreSQL 行为差异与生产准入遗留项

1. **数据库并发与锁差异（M4 沙箱限 SQLite）**：生产切换 PostgreSQL 需补齐连接池、`INSERT ... ON CONFLICT DO NOTHING`、JSONB 索引及真实 PostgreSQL 迁移流水线。
2. **OpenBot 侧沙箱外发适配 PR 待合入**：OpenBot 仓库侧需在独立 PR 中补齐 W3C `traceparent`、`promptVersion` 注入及 `collaboration-satisfaction.ts` 的 `runId` 强绑定。
3. **最终阶段判断**：
   - **M4 沙箱阶段（隔离沙箱 + 测试数据）：通过**；
   - **生产环境全量准入：保持关闭**（待 PostgreSQL 生产验证、真实生产 OIDC IdP 联调及 OpenBot 侧 PR 合入后开启）。
