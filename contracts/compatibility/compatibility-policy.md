# Schema & API Compatibility Policy

1. **Semantic Versioning**: 所有契约与 Schema 采用 `MAJOR.MINOR.PATCH`。
2. **Backward-Compatible Changes (`MINOR` / `PATCH`)**: 允许新增可选字段、新增事件类型或新增枚举成员（消费方需对未知枚举安全降级）。
3. **Breaking Changes (`MAJOR`)**: 删除/重命名必填字段、收窄类型、修改签名规范化算法均属破坏性变更，**必须经过 ADR 审批与双版本并行过渡期**。
