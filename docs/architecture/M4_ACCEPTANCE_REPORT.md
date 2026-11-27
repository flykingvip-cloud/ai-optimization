# M4 OpenBot × AI Optimization 沙箱联合验收报告

- **目标仓库**：`https://github.com/flykingvip-cloud/ai-optimization` (`main`)
- **OpenBot 参考基线**：`25b6613e6`（未修改 OpenBot 主业务代码、未删除 AOR）
- **本地验证**：`pnpm run check`（`tsc --noEmit` 0 错误；`vitest run` **8 个测试文件、25 个用例全部通过**，耗时 294ms）

---

## 一、M4-01 ~ M4-06 联合验收矩阵

| 编号 | 验收主题 | 核心实证路径 | 测试结果 |
|---|---|---|---|
| **M4-01** | 跨系统契约兼容性核对 | `docs/architecture/M4_01_CONTRACT_COMPATIBILITY_MATRIX.md`, `tests/contract/contracts.test.ts` | **Pass (4/4)** |
| **M4-02** | 真实 OIDC Discovery + JWKS 缓存与密钥轮换 | `packages/shared-contracts/src/oidc-jwks.ts`, `tests/m4-sandbox/m4-oidc-jwks.test.ts` | **Pass (1/1)**（真实 HTTP IdP、轮换 `rot-1` → `rot-2`、`401` 过期、`403` 跨租户） |
| **M4-03** | Telemetry 异步投递、幂等与故障隔离 | `packages/telemetry-sdk/src/index.ts`, `tests/m4-sandbox/m4-full-sandbox-e2e.test.ts` | **Pass**（远端不可达时零阻塞写磁盘 WAL，恢复后成功补发且幂等去重） |
| **M4-04** | Dataset 治理、Evaluation 追溯与 Experiment 统计 | `services/{dataset-management,evaluation-engine,experiment-engine}/src/index.ts` | **Pass** |
| **M4-05** | Artifact 完整签名、作用域、过期、撤销与防重放 | `services/artifact-registry/src/index.ts`, `tests/integration/secondary-audit-remediation.test.ts` | **Pass (5/5)** |
| **M4-06** | OpenBot 单状态机治理闭环（Approval → Canary → Revoke → Rollback） | `tests/m4-sandbox/m4-full-sandbox-e2e.test.ts` | **Pass**（AI Optimization 仅发 `410 revoked`，OpenBot 执行回滚并回报 `deployment.*`） |

---

## 二、SQLite vs PostgreSQL 行为差异与生产准入遗留项

1. **数据库并发与锁差异（M4 沙箱限 SQLite）**：
   - SQLite `WAL` 模式为单写多读进程内文件锁，适合单实例与沙箱测试；
   - 生产环境切换 PostgreSQL 时需补齐：连接池与 `pg_advisory_lock` / `SERIALIZABLE` 或 `INSERT ... ON CONFLICT DO NOTHING` 幂等语句、JSONB 索引、`TIMESTAMP WITH TIME ZONE` 原生类型及真实 PostgreSQL 迁移流水线。
2. **OpenBot 侧沙箱外发适配待合入**：
   - OpenBot 主仓库当前仍待在独立 PR 中补齐 W3C `traceparent` 上下文传播、`promptVersion` 注入及 `collaboration-satisfaction.ts` 的 `runId` 强绑定。
3. **最终阶段判断**：
   - **M4 沙箱联调（在隔离沙箱与测试数据下）：通过**；
   - **生产环境全量准入**：待完成 PostgreSQL 适配器验证及 OpenBot 侧 Telemetry/Consumer PR 合入后开启。
