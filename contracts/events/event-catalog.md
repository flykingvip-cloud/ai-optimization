# Event Catalog (`v1.0.0`)

所有事件必须携带 `schemaVersion`、`eventId`、`idempotencyKey`、`occurredAt`、`tenantId`、`source`、`traceContext`（含 `traceId`, `runId`）与 `redaction`。

| 事件名 | 生产者 | 消费者 | 说明 |
|---|---|---|---|
| `runtime.run.started` | OpenBot | AI Optimization | Agent Run 启动（含 `promptVersion`, `agentVersion`, `experimentId`） |
| `runtime.run.completed` | OpenBot | AI Optimization | Agent Run 正常结束 |
| `runtime.run.failed` | OpenBot | AI Optimization | Agent Run 异常终止 |
| `runtime.model.called` | OpenBot | AI Optimization | 模型调用及 Token/延迟/Fallback 记录 |
| `runtime.tool.called` | OpenBot | AI Optimization | 工具调用及执行结果摘要 |
| `runtime.task_outcome.recorded` | OpenBot | AI Optimization | `TaskOutcome` 终态摘要副本（OpenBot 为唯一权威） |
| `runtime.feedback.recorded` | OpenBot | AI Optimization | 用户/专家显式反馈（强制绑定 `runId`） |
| `evaluation.completed` | AI Optimization | AI Optimization / OpenBot | 评测任务完成通知 |
| `experiment.completed` | AI Optimization | AI Optimization | 实验统计检验完成 |
| `artifact.created` | AI Optimization | AI Optimization | 签名优化制品创建 |
| `artifact.revoked` | AI Optimization | OpenBot | 制品撤销/失效通知（OpenBot 拒收或触发回滚） |
| `deployment.completed` | OpenBot | AI Optimization | OpenBot 生产部署完成状态回报 |
| `deployment.rollback.completed` | OpenBot | AI Optimization | OpenBot 生产回滚完成状态回报 |
