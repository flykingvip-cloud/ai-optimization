# Security Policy

- 严禁将生产密钥、Token 或真实未脱敏生产数据提交至仓库。
- 所有 `OptimizationArtifact` 必须使用 Ed25519 签名并校验 `keyId`、`expiresAt`、`revocationStatus`、`monotonicEpoch`。
- 跨租户访问、绕过 OpenBot 生产审批或未授权使用生产数据进行训练均视为高危安全缺陷。
