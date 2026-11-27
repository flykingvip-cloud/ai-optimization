# M4-01 跨系统契约兼容性核对矩阵

- **OpenBot 基线 Commit**：`25b6613e6` (`codex/openbot/workspace-seat-binding`)
- **AI Optimization 基线 Commit**：`eb2ac5a4755363fb08f3f9e66b68903ab8d4f909` (`main`)

---

## 一、数据对象与字段逐项兼容核对

| 契约对象 | AI Optimization 契约 (`contracts/json-schema/`) | OpenBot 对应源码与类型 | 兼容状态与差异说明 |
|---|---|---|---|
| **TaskOutcomeEvent** | `lifecycle`: `active \| awaiting_acceptance \| awaiting_delivery \| recovering \| closed`<br>`taskJudgement`: `success \| failure \| cancelled \| incomplete`<br>`outcomeVersion`, `decidedAt`, `taskId`, `runId` | `openbot/src/task-outcome/types.ts:13-22` (`Lifecycle`, `TaskJudgement`, `outcomeVersion`, `decidedAt`) | **完全兼容**（枚举值 1:1 对齐；`tenantId` 由 OpenBot `TrustedScope` 派生注入） |
| **TelemetryEvent** | `traceContext.traceId`, `traceContext.runId`, `promptVersion`, `toolPolicyVersion`, `experimentId`, `idempotencyKey` | `openbot/src/agents/trace-base.ts`, `src/executor-evidence/model-call-evidence.ts` | **字段部分兼容（待 OpenBot 侧联调补齐）**：OpenBot 已有 `runId`/`sessionId`/`provider`/`modelId`，**缺少 W3C `traceparent`/`traceId`、`promptVersion`、`toolPolicyVersion`**，且 `collaboration-satisfaction.ts` 需绑定 `runId` |
| **OptimizationArtifact** | `Ed25519` 全量规范化签名 + `SHA-256` + `monotonicEpoch` + `revocationStatus` + `targetScope` | `openbot/packages/evolution-core/src/state-machine.ts` | **架构兼容（待 OpenBot 消费适配器接入）**：OpenBot `evolution-core` 具备 `PENDING_AUTHORITY → CANARY → VERIFIED → PROMOTED / ROLLED_BACK` 治理状态机，M4 沙箱通过 `verifyForOpenBot` 对接 |
| **错误码与幂等** | `202` (`duplicate: true/false`), `400`, `401`, `403`, `409`, `410` | `services/http-api/src/server.ts` | **已冻结**：OpenBot 客户端遇 `4xx`/`5xx`/超时均走本地有界 WAL 降级，不阻塞主链路 |
