# Artifact Integrity & Supply-Chain Trust Model

## 1. 摘要与签名分离
- `contentHash`：对制品 `payload` 计算 `SHA-256`，仅用于完整性校验，**不等同于发布者身份认证**。
- `signature`：使用 `Ed25519`（`signatureAlgorithm: "Ed25519"`）对规范化 JSON（Canonical JSON）签名，覆盖 `artifactId`, `artifactType`, `artifactVersion`, `schemaVersion`, `tenantId`, `targetScope`, `issuedAt`, `expiresAt`, `monotonicEpoch`, `contentHash`。

## 2. 验证链（OpenBot 消费端 Fail-Closed）
OpenBot 在应用任何 `OptimizationArtifact` 前必须依次通过：
1. **结构与版本检查**：`schemaVersion` 与 `targetCompatibility`（OpenBot 最低/最高版本）匹配；
2. **签名与密钥轮换检查**：通过 `keyId` 查找受信任公钥（支持多 Key 轮换宽限期），校验 `Ed25519` 签名与 `issuer` 身份；
3. **摘要检查**：重新计算 `payload` SHA-256 与 `contentHash` 一致；
4. **时效与撤销检查**：`now >= issuedAt && now < expiresAt`，且 `revocationStatus !== "revoked"`（结合 CRL/撤销查询）；
5. **防重放检查**：`artifact.monotonicEpoch > lastAppliedEpoch(tenantId, targetScope)`；
6. **作用域与审批检查**：`tenantId` 与 `targetScope` 匹配且不越权扩大工具/模型白名单，随后进入 `operator.approvals`。

任一环节失败必须拒绝应用并记录安全审计事件。
