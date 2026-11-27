# OIDC/JWKS 安全复验报告（P0-1）

- 文档性质：P0-1 实施后的安全复验记录，不是生产准入申请，也不是生产 IdP 联调通过证明。
- 仓库：`flykingvip-cloud/ai-optimization`
- 分支：`feat/p0-1-oidc-jwks-security`
- 基线：`origin/main` = `4716abb81a8b15e8b10b80cd04965b69eb7dcc15`（开始实施时已 `git fetch`，main 未前进）
- 代码与测试提交：`0d315d376b617e5c552d6282298952d6a6eeb88f`
- 实施日期：2026-11-27（Asia/Shanghai）
- 生产准入：保持关闭

## 1. 证据分层结论

必须按层级阅读本报告，不得将下层证据上推为上层通过。

| 证据层级 | 本轮结论 |
| --- | --- |
| 源码实现 | 已在 `packages/shared-contracts/src/oidc-jwks.ts` 落地流式限长、Discovery issuer 精确校验、非 HTTPS `jwks_uri` 拒绝、重定向限制、默认收紧的 JWKS 主机/CIDR 允许列表，以及解析后的私网/回环/链路本地/元数据地址拦截。JWK `use` / `alg` / `key_ops` / `kid` 过滤已补强。 |
| 自动化测试 | 本地已跑通。`pnpm run check`：`tsc --noEmit` 通过；`vitest run` 为 8 个文件 / 40 个测试全部通过，其中本专题 `tests/m4-sandbox/m4-oidc-jwks.test.ts` 为 16 个测试全部通过。测试未连接任何生产 IdP。 |
| CI | 本报告撰写时尚未将分支推送到 GitHub，因此没有本分支的 Actions Run 结论。推送并开 PR 后需另行记录 Run URL 与当时状态。不得把基线 CI `45932557643` 当作本轮改动的 CI 证据。 |
| 真实生产 IdP 联调 | **未完成。** 本轮只使用显式开启的 localhost HTTP 测试 IdP，以及注入的 `fetchFn` / `dnsLookupFn` 模拟。 |
| 生产验证 | **未进行。** 未连接生产数据库，未修改生产配置，未切换生产流量。 |

### 工程标准已达 / 生产 IdP 未完成

- **工程标准（本仓 P0-1 范围内）**：源码已关闭审计列出的主要实现缺口；自动化测试标题与断言已对齐，并覆盖计划中的限长、重定向、SSRF/允许列表、JWK 过滤、超时、负缓存、singleflight、密钥轮换、过期令牌、认证与授权错误区分、跨租户拒绝等场景。
- **生产 IdP 联调：未完成。** 不得将 localhost / mock IdP 测试解释为生产 IdP 联调通过。

真实生产 IdP 联调仍需以下前置条件，本轮均不具备：

1. 负责人确认并写入配置的生产 issuer、audience，以及 `allowedJwksHosts` 中的可信主机/CIDR。
2. 生产 IdP 的 OIDC Discovery 与 JWKS 均通过 HTTPS 对公或对企业允许的私网 CIDR 提供，且证书链可被运行时信任。
3. 在受控非生产或预发环境中，使用真实 IdP 签发的有效、过期、错误 audience、错误 issuer 与跨租户令牌做联调，而不是注入 `fetchFn`。
4. 密钥轮换与 JWKS 负缓存在真实网络时延、失败和重试下的观察记录。
5. 生产密钥管理、监控告警和责任人审批（这些也是总的生产准入条件，不在本 PR 范围内）。

## 2. 实施范围

本轮严格限于 P0-1。

修改文件：

- `packages/shared-contracts/src/oidc-jwks.ts`
- `tests/m4-sandbox/m4-oidc-jwks.test.ts`
- `docs/architecture/handover/OIDC_JWKS_SECURITY_REVERIFICATION_REPORT.md`（本报告；`main` 上原先没有 `handover/` 目录，本分支只新增这一份文件，不复制也不改写未合并文档 PR 中的 Phase 0 两份报告）

未修改：

- Telemetry WAL、PostgreSQL Schema/Migration、OpenBot、OpenAPI / 对外 HTTP 契约、`M4_ACCEPTANCE_REPORT.md`、生产配置。

## 3. 关键设计

### 3.1 流式响应限长

`fetchJsonBounded` 不再调用 `res.text()` 后再计算字节数。`readResponseBodyBounded` 通过 `ReadableStream` 逐块读取，一旦累计长度超过 `maxResponseBytes`（默认 256 KiB）立即 `cancel` 并抛出 `invalid_signature`。默认出站请求设置 `Accept-Encoding: identity`，避免压缩比导致的限长失真。

### 3.2 Discovery issuer 与 `jwks_uri`

- issuer 必须存在，且去掉尾斜杠后与配置的 `issuerUrl` 精确匹配。
- 非 HTTPS issuer 默认拒绝。
- 即使 issuer 为 HTTPS，非 HTTPS `jwks_uri` 也会在拉取 JWKS 之前被独立拒绝。
- `allowInsecureHttpForLocalhost` 默认为 `false`。仅当显式开启且主机为 `localhost` / `127.0.0.1` / `::1` 时，才允许 localhost HTTP。这不是生产默认行为。

### 3.3 重定向策略

默认 fetch 与注入的 `fetchFn` 均使用 `redirect: "manual"`（自定义 fetch 由调用方遵守该选项）。客户端最多跟随 `maxRedirects`（默认 3）次跳转。每次跳转都会：

- 要求存在有效 `Location`；
- 拒绝从 HTTPS 降级到 HTTP；
- 对目标 URL 重复执行主机允许列表、协议和解析后地址校验；
- 在继续或失败前取消未消费的响应体。

### 3.4 SSRF 与信任主机策略

生产默认收紧：`allowedJwksHosts` 缺省为空，任意公网主机默认不可达，必须由运营方显式列出可信 Discovery/JWKS 主机名（精确、大小写不敏感）和/或 CIDR。测试可通过该选项以及 `allowInsecureHttpForLocalhost` 配置本地目标。

解析后的全部地址都必须可接受，否则拒绝：

- 默认拦截私网、回环、链路本地、CGNAT、组播、文档网段等；
- 企业私网 IdP 可将对应 CIDR 写入允许列表；
- 云元数据地址（包括 `169.254.169.0/24`、`169.254.170.2`、`100.100.100.200`、`fd00:ec2::254`）为硬拦截，即使出现在允许列表中也被拒绝。

默认出站路径使用解析后的地址发起连接（HTTPS 保留原主机名作为 SNI / `Host`），以缩小 DNS 重绑定窗口。注入 `fetchFn` 的测试路径会在调用前完成同样的 URL 与地址校验，但无法为自定义 fetch 做套接字级 IP 钉扎；这一点记入下方残余风险。

### 3.5 JWK 过滤与 JWT 语义

继续忽略：缺 `kid`、`use` 存在且不为 `sig`、`key_ops` 存在但不含 `verify` 的密钥。补强：

- OKP + Ed25519 仅接受 `alg` 缺省、`EdDSA` 或 `Ed25519`；
- RSA 仅接受 `alg` 缺省或 `RS256`（与现有 `verifyJwtAuth` 算法面一致）；
- 单条无效 JWK 不会让整个 JWKS 失败，但若过滤后没有任何可用签名密钥，刷新失败。

`tenantId` 仍只能来自通过签名、issuer、audience 和有效期校验的 JWT 声明；HTTP 请求 body 中的租户不能成为认证依据。过期令牌映射为认证失败（`token_expired` / HTTP 401），跨租户访问由业务层拒绝（HTTP 403），角色不足为 `insufficient_permissions`。

## 4. 测试命令与实际结果

命令在仓库根目录执行，环境为 Node v24.22.1、pnpm v10.34.6，时间 2026-11-27 23:13 CST（Asia/Shanghai）。

```text
$ pnpm run check

> @openbot/ai-optimization@0.1.0 check
> pnpm run typecheck && pnpm run test

> @openbot/ai-optimization@0.1.0 typecheck
> tsc --noEmit

> @openbot/ai-optimization@0.1.0 test
> vitest run

 RUN  v5.1.2 /workspace/repos/ai-optimization

 Test Files  8 passed (8)
      Tests  40 passed (40)
   Start at  23:13:04
   Duration  374ms
```

专题测试单独复跑结果：

```text
$ pnpm exec vitest run tests/m4-sandbox/m4-oidc-jwks.test.ts

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  23:12:57
   Duration  411ms
```

基线 `4716abb` 时代的全量测试是 8 个文件 / 26 个测试。本轮新增的是 OIDC/JWKS 专题断言，不是全仓测试面的扩大解释。

### 4.1 本专题测试名称（均已通过）

文件：`tests/m4-sandbox/m4-oidc-jwks.test.ts`

1. discovers JWKS over opt-in localhost HTTP, ignores use=enc keys, and rotates on a new kid
2. rejects expired tokens with HTTP 401 and distinguishes them from cross-tenant authorization failures (HTTP 403)
3. rejects a non-HTTPS issuer URL
4. does not allow localhost HTTP unless allowInsecureHttpForLocalhost is explicitly enabled
5. rejects a missing discovery issuer and a mismatched discovery issuer
6. rejects a non-HTTPS jwks_uri even when the discovery issuer is HTTPS
7. denies fetches to a public HTTPS host that is not in the JWKS allowlist
8. rejects a JWKS or discovery hostname that resolves to a private or metadata address
9. rejects cloud metadata addresses even when they appear in the JWKS allowlist
10. rejects HTTPS to HTTP redirects and redirects to a private or metadata address
11. rejects redirect chains that exceed the configured hop limit
12. stops consuming an oversized OIDC/JWKS response at maxResponseBytes without buffering the remainder
13. rejects malformed OIDC JSON and enforces a failure negative cache
14. times out a stalled OIDC/JWKS request
15. coalesces concurrent JWKS refreshes through singleflight
16. filters use=enc, alg-mismatched, key_ops-without-verify, missing-kid, and invalid JWK material, then rejects an unknown kid

## 5. 尚未覆盖的场景与风险

1. **真实生产 IdP 联调未做。** 没有对外部正式 issuer 发起 Discovery/JWKS 请求，也没有验证真实证书链、OCSP/CRL 或 IdP 侧轮换窗口。
2. **自定义 `fetchFn` 不钉扎套接字地址。** 地址策略在调用前执行；若调用方提供的 `fetchFn` 忽略 `redirect: "manual"` 或自行解析另一组 DNS 结果，防护会减弱。默认出站路径不受此限制。
3. **DNS 重绑定不是形式上的零窗口。** 默认路径会把已校验地址用于连接，但解析与连接之间仍存在短暂竞争；未实现持续的 TTL 钉扎或连接期复查。
4. **允许列表是精确主机名或 CIDR，不支持通配符。** 多主机 IdP 必须逐项列出。错误配置（漏列 `jwks_uri` 主机）会导致刷新失败，这是收紧后的预期行为。
5. **IPv6 / NAT64 / 罕见 IP 字面量形式可能仍有边角。** 已覆盖 IPv4 映射、常见特殊网段和 Node `URL` 会归一化的十进制/十六进制 IPv4，但不能声称穷尽全部解析差异。
6. **算法面仍仅限 EdDSA 与 RS256。** 若未来生产 IdP 只提供 ES256 或其他算法，需要单独评估后再扩展，不得为了联调临时放宽校验。
7. **超大响应测试验证的是流在超过阈值后停止消费，而不是内核级或断电级的内存上限。** 取消时仍可能有已排队的一两块数据被计入读取量。
8. **本报告撰写时没有本分支 CI 结论。** 合并前必须确认 GitHub Actions 成功。
9. **OIDC 客户端配置变更是行为收紧。** 现有调用方如果未设置 `allowedJwksHosts`，在生产路径上将无法拉取任意公网 JWKS。这是有意为之，接入时需要显式配置。

## 6. 生产准入

P0-1 的工程缺口已在本仓源码和自动化测试层关闭，但这只是生产准入条件中的一项准备工作。

生产准入仍然关闭。本 PR 不申请、不授权、也不构成生产 IdP 联调通过、生产切流或生产密钥配置完成。
