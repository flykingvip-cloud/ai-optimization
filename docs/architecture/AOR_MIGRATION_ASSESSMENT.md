# AOR 历史代码迁移专项评估报告（Migration Assessment）

> **状态**：仅评估与方案制定；**在架构负责人批准迁移方案前，严禁从 OpenBot 删除任何 AOR 源码。**

| 包名 | 当前职责 | 核心接口 | 代码与外部依赖 | 测试覆盖 | 与 OpenBot 耦合点 | 与新领域模型关系 | 迁移风险 | 是否保留 / 推荐迁移阶段 |
|---|---|---|---|---|---|---|---|---|
| `packages/aor-core` | 启发式评测探针、Thompson Sampling Bandit、多策略模型排序 | `VerifiableEvaluator`, `BanditFeedbackStore`, `rankModels` | 零 Gateway 依赖，纯 TS | 13 files, 56 tests Pass | `src/gateway/model-entitlement/employee-model-gate.ts` 间接调用排序 | 对应 `evaluation-core` 与 `optimization-core` | 低 | **迁移**（Phase 1 M2/M3 保留 Git 历史迁入） |
| `packages/aor-sdk-node` | 编码任务 Benchmark CLI、构建/测试探针 | `bench.ts`, `coding-evaluator.ts`, `probes.ts` | `@openbot/aor-core`, `@openbot/aor-backend-openbot` | 独立 Vitest 套件 | 通过 HTTP/RPC 访问 OpenBot | 对应 Benchmark 与 Rule Evaluator | 低 | **迁移**（Phase 1 M2 迁入） |
| `packages/aor-sdk-python` | Python 轻量客户端，调用 `/v1/chat/completions` | `aor_sdk` | `httpx` / 标准库 | pytest 套件 | 仅公开 HTTP 契约 | 独立优化 SDK 客户端 | 低 | **迁移**（Phase 1 M2 迁入） |
| `packages/aor-backend-openbot` | OpenBot `/v1/chat/completions` 与 RPC 适配器 | `OpenAiCompatGatewayClient`, `OpenBotBackend` | `@openbot/aor-core` | 独立测试 | 适配 OpenBot 公开端点 | 属于运行时适配层（评测器调用被测 OpenBot） | 低-中 | **迁移或作为独立适配器保留**（M2） |
| `packages/aor-backend-graph` | 图执行后端适配器 | `createGraphExecutionBackend` | `@openbot/aor-core` | 交叉测试 | 无 OpenBot 内部耦合 | 属于实验执行后端 | 低 | **迁移**（M2） |
| `packages/aor-backend-stub` | 测试桩后端 | `StubBackend` | `@openbot/aor-core` | 交叉测试 | 无 | 测试夹具 | 低 | **迁移**（M2） |

## 过渡期兼容策略
1. OpenBot `src/gateway/model-entitlement/employee-model-gate.ts` 与 `src/agents/model-fallback.ts:86` (`applyPreferredModelOrder`) 在过渡期保持现有接口不变；
2. 待 AI Optimization 的 `OptimizationArtifact` (`model_routing_policy`) 上线并通过 M4 联调后，OpenBot 切换为消费签名后的路由策略制品，再按 PR 审批清理 OpenBot 冗余 AOR 代码。
