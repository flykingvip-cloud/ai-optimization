# Engineering Standards & Testing Strategy

## 技术栈选型（与 AOR 兼容）
- **Runtime**: Node.js >= 22 (ESM, TypeScript strict)
- **Package Manager**: `pnpm` (workspace monorepo)
- **Test Runner**: `vitest`
- **Type Check**: `tsc --noEmit`

## 测试分层要求
- `tests/contract` / `*.contract.test.ts`: JSON Schema 与 OpenAPI 契约校验
- `packages/*/*.test.ts`: 领域模型、脱敏、统计检验、Ed25519 签名/验签/防重放单元测试
- `services/*/*.test.ts`: Telemetry 幂等去重、Dataset 版本不可变与隔离、Evaluation Judge/Rule 集成测试
- `tests/e2e`: OpenBot Telemetry → AI Optimization Evaluation/Artifact → OpenBot 验签与故障隔离端到端测试
