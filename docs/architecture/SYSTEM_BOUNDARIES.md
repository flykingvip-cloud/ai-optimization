# System Boundaries & Context

## 双平面职责矩阵
- **OpenBot（Runtime & Governance Plane）**：Agent Runtime、Gateway、Tool/Workflow、Model Fallback、Auth Cooldown、Doctor/Diagnosis、TaskOutcome（唯一结果权威）、OTel、Evolution Control（生产审批/Canary/Promotion/Rollback）。
- **AI Optimization（Evaluation & Learning Plane）**：Telemetry Ingestion、Dataset/Golden Dataset、Expert Feedback、Evaluation Engine（Rule + LLM-as-a-Judge）、Benchmark、Experiment Engine、Artifact Registry（及后续 SFT/DPO/RLVR）。

## 单一权威与禁止事项
- `TaskOutcome` 与生产部署/回滚状态由 **OpenBot** 唯一写入；AI Optimization 仅消费异步副本。
- `Dataset`、`EvaluationResult`、`ExperimentRun`、`OptimizationArtifact` 由 **AI Optimization** 唯一写入；OpenBot 仅验签消费并执行生产发布。
- 严禁双主写、严禁 AI Optimization 直接修改 OpenBot 生产配置、严禁 OpenBot 同步阻塞等待 AI Optimization。
