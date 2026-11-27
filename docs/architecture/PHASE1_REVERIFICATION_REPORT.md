# AI Optimization Phase 1 验收整改与独立复验报告（二次核查补充版）

- **目标仓库**：`https://github.com/flykingvip-cloud/ai-optimization` (`main`)
- **依据文档**：`PHASE1_STAGE_ACCEPTANCE_AUDIT_f339338.md` 及二次源码核查意见（`P0-06`–`P0-07`、`P1-07`–`P1-11`）
- **定位声明**：本报告确认 **Phase 1 工程与安全底座复验通过**，可进入 **OpenBot 沙箱联调准入**；生产环境全量放量仍需完成 M4 跨系统真实沙箱联调验收。

---

## 一、二次核查补充整改矩阵

| 编号 | 整改项 | 核心实现路径 | 验证结果 |
|---|---|---|---|
| **P0-06** | Artifact 完整规范化签名（覆盖 `approvalPolicy`、`sourceExperimentId`、`evaluationReportRef`、`datasetVersion`、`issuer`、`rollbackTargetArtifactId` 等全量元数据，仅排除 `signature` 与可变 `revocationStatus`） | `services/artifact-registry/src/index.ts` (`canonicalSigningBytes`, `sortKeysDeep`) | **Pass**（逐字段篡改测试全部拒绝 `invalid_signature`） |
| **P0-07** | 真实 HTTP 服务入口接入 JWT/OIDC 与 JWKS 多密钥轮换 | `services/http-api/src/server.ts`, `packages/shared-contracts/src/auth.ts` | **Pass**（`401` 未认证、`403` 跨租户、`202` 密钥轮换全覆盖） |
| **P1-07** | 全核心服务接入 `OptimizationDatabase` (`node:sqlite`) 持久化 | `services/{telemetry-ingestion,dataset-management,evaluation-engine,experiment-engine,artifact-registry}/src/index.ts` | **Pass**（关闭并重开磁盘 DB 后 5 个服务读写全保留） |
| **P1-08** | Telemetry 磁盘 WAL 原子写入（`tmp + fsyncSync + renameSync`）、损坏尾部容错与超限淘汰 | `packages/telemetry-sdk/src/index.ts` | **Pass** |
| **P1-09** | Experiment 真实统计功效/最小样本量计算及 `bonferroni` / `holm_bonferroni` / `fdr_bh` 多重比较校正 | `services/experiment-engine/src/index.ts` | **Pass** |
| **P1-10** | Judge 分布漂移检测（PSI + 均值偏移），可检出均值不变但分布双峰化的漂移 | `services/evaluation-engine/src/reliability.ts` | **Pass** |
| **P1-11** | GitHub Actions CI 完整运行记录核验 | `.github/workflows/ci.yml` + `gh run list` | **以实际推送后 CI Run ID 核验为准** |
