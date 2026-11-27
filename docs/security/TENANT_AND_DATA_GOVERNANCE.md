# Tenant Isolation & Data Governance

## 1. 租户隔离（Tenant Isolation）
- 所有核心对象（`Dataset`、`DatasetVersion`、`DatasetCase`、`EvaluationJob`、`EvaluationResult`、`Experiment`、`ExperimentRun`、`OptimizationArtifact`）均强制绑定 `tenantId`。
- 服务端严禁仅依赖客户端请求体传入的 `tenantId`，必须从已认证主体的 `AuthContext.tenantId` 派生并校验。
- 跨租户读写默认拒绝（Fail-closed）；任何跨租户 Benchmark 必须有显式授权记录、审批人与完整审计日志。
- 永久身份主键使用不可变 `subjectId` / `servicePrincipalId`，严禁使用 Email 作为永久主键。

## 2. 数据治理与脱敏（Data Governance & Redaction）
- Dataset 分为 `golden`、`evaluation`、`train_candidate`；`train_candidate` 默认禁止进入训练。
- `DatasetVersion` 不可变，修改必须发布新版本并通过污染检测（防止 `evaluation`/`golden` 样本混入训练集）。
- 入库与出站前均执行 Secret/PII 脱敏；敏感原始内容严禁因重试或死信机制绕过脱敏。
- 支持租户级数据删除（GDPR）与 TTL 保留清理策略。
