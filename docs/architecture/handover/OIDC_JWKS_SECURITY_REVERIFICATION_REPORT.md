# OIDC/JWKS 安全复验报告（P0-1）

- 文档性质：P0-1 实施后的安全复验记录，以及 2026-11-28 对 PR #2 的独立安全审查结论。不是生产准入申请，也不是生产 IdP 联调通过证明。
- 仓库：`flykingvip-cloud/ai-optimization`
- 分支：`feat/p0-1-oidc-jwks-security`
- 冻结 `origin/main`：`4716abb81a8b15e8b10b80cd04965b69eb7dcc15`
- 工程完成基线 SHA：`b0de71b4bfdc8432c96293ba4e85c4307888a9b3`（详见 `P0_1_ENGINEERING_BASELINE.md`）
- 本轮审查修复提交：`af6fbc95a9215cce90d1ddcf813305932f9940bb`（拒绝冲突的重复 `kid`；为 `fetchFn` 补充非钉扎说明）
- 审查日期：2026-11-28（Asia/Shanghai）
- 生产准入：保持关闭
- PR #2：https://github.com/flykingvip-cloud/ai-optimization/pull/2 （审查期间保持 OPEN，未合并）

## 1. 证据分层结论

必须按层级阅读本报告，不得将下层证据上推为上层通过。

| 证据层级 | 本轮结论 |
| --- | --- |
| 源码实现 | 已在 `packages/shared-contracts/src/oidc-jwks.ts` 落地流式限长、Discovery issuer 精确校验、非 HTTPS `jwks_uri` 拒绝、重定向限制、默认收紧的 JWKS 主机/CIDR 允许列表，以及解析后的私网/回环/链路本地/元数据地址拦截。JWK `use` / `alg` / `key_ops` / `kty` / `crv` / `kid` 过滤已落地。独立审查后，冲突的重复 `kid` 改为整份 JWKS 刷新失败，不再最后写入覆盖。 |
| 自动化测试 | 基线 `b0de71b` 上复跑 `pnpm run check` 为 8 个文件 / 40 个测试通过。修复后为 8 个文件 / 42 个测试通过，其中专题 `tests/m4-sandbox/m4-oidc-jwks.test.ts` 为 18 个测试通过。测试未连接任何生产 IdP。 |
| CI | 工程完成基线 SHA `b0de71b` 的 GitHub Actions Workflow `CI` / Job `verify` 已再次核对为成功（run `46023943679`）。本轮新提交的 CI 以推送后的实际 Run 为准，不得预先写成成功。CI 成功不是生产 IdP 联调通过。 |
| 独立安全审查 | 已完成对负责人指定的四项重点的源码审查。发现并修复了冲突重复 `kid` 的最后写入覆盖。其余重点未发现必须立刻再改的可利用缺陷，但多项残留风险仍为未闭合，见第 8、9 节。审查通过不等于 Integration Accepted 或 Production Accepted。 |
| 真实生产 IdP 联调 | **未完成。** 本轮只使用显式开启的 localhost HTTP 测试 IdP，以及注入的 `fetchFn` / `dnsLookupFn` 模拟。 |
| 生产验证 | **未进行。** 未连接生产数据库，未修改生产配置，未切换生产流量。 |

### 三层阶段门禁

| 门禁 | 本轮结论 |
| --- | --- |
| Engineering Complete | **已达到**（基线 `b0de71b`）。本轮审查修复是在该基线之上的安全收紧，不把门禁上推。 |
| Integration Accepted | **未达到。** 真实生产 IdP 联调未完成，也没有跨仓调用或目标基础设施验证。 |
| Production Accepted | **未达到。** 生产准入保持关闭。 |

将来若合并 PR #2，只代表代码进入主分支，不代表生产安全验收通过。本报告不申请合并。

真实生产 IdP 联调仍需以下前置条件，本轮均不具备：

1. 负责人确认并写入配置的生产 issuer、audience，以及 `allowedJwksHosts` 中的可信主机/CIDR。
2. 生产 IdP 的 OIDC Discovery 与 JWKS 均通过 HTTPS 对公或对企业允许的私网 CIDR 提供，且证书链可被运行时信任。
3. 在受控非生产或预发环境中，使用真实 IdP 签发的有效、过期、错误 audience、错误 issuer 与跨租户令牌做联调，而不是注入 `fetchFn`。
4. 密钥轮换与 JWKS 负缓存在真实网络时延、失败和重试下的观察记录。
5. 生产密钥管理、监控告警和责任人审批（这些也是总的生产准入条件，不在本 PR 范围内）。

## 2. 实施范围

本轮严格限于 P0-1。独立审查也只触及 OIDC/JWKS 客户端、对应测试，以及 `docs/architecture/handover/` 下的本报告与阶段基线记录。

修改文件：

- `packages/shared-contracts/src/oidc-jwks.ts`
- `tests/m4-sandbox/m4-oidc-jwks.test.ts`
- `docs/architecture/handover/OIDC_JWKS_SECURITY_REVERIFICATION_REPORT.md`（本报告）
- `docs/architecture/handover/P0_1_ENGINEERING_BASELINE.md`（阶段基线记录，单独提交）

未修改：

- Telemetry WAL、PostgreSQL Schema/Migration、OpenBot、OpenAPI / 对外 HTTP 契约、`M4_ACCEPTANCE_REPORT.md`、`docs/phase0-handover-baseline`、生产配置、`auth.ts`。

## 3. 关键设计（实施时落地，已用源码复核）

### 3.1 流式响应限长

`fetchJsonBounded` 不再调用 `res.text()` 后再计算字节数。`readResponseBodyBounded` 通过 `ReadableStream` 逐块读取，一旦累计长度超过 `maxResponseBytes`（默认 256 KiB）立即 `cancel` 并抛出 `invalid_signature`。默认出站路径（`pinnedFetch`）设置 `Accept-Encoding: identity`，避免压缩比导致的限长失真。注入的 `fetchFn` 不会被自动加上该请求头。

### 3.2 Discovery issuer 与 `jwks_uri`

- issuer 必须存在，且去掉尾斜杠后与配置的 `issuerUrl` 精确匹配。
- 非 HTTPS issuer 默认拒绝。
- 即使 issuer 为 HTTPS，非 HTTPS `jwks_uri` 也会在拉取 JWKS 之前被独立拒绝。
- `allowInsecureHttpForLocalhost` 默认为 `false`。仅当显式开启且主机为 `localhost` / `127.0.0.1` / `::1` 时，才允许 localhost HTTP。这不是生产默认行为。

### 3.3 重定向策略

默认出站路径由客户端手动跟随重定向：`pinnedFetch` 使用 `http`/`https.request`，不会自动跳转；注入 `fetchFn` 时客户端传入 `redirect: "manual"`，**但只有调用方遵守该选项时**，后续跳转才会进入同一套校验。客户端最多跟随 `maxRedirects`（默认 3）次跳转。在这条受控路径上，每次跳转都会：

- 要求存在有效 `Location`；
- 用 `new URL(location, current)` 解析相对和 scheme-relative（`//host/path`）地址；
- 拒绝从 HTTPS 降级到 HTTP；
- 对目标 URL 重复执行 `assertTrustedUrl`（协议、禁止 userinfo、主机允许列表、解析后全部地址校验、元数据硬拦截）；
- 在继续或失败前取消未消费的响应体。

未实现单独的重定向环路检测；跳数上限是当前的环路防护。不得把「客户端请求了 `redirect: "manual"`」写成「自定义 `fetchFn` 一定不会自行跟随重定向」。

### 3.4 SSRF 与信任主机策略

生产默认收紧：`allowedJwksHosts` 缺省为空，任意公网主机默认不可达，必须由运营方显式列出可信 Discovery/JWKS 主机名（精确、大小写不敏感）和/或 CIDR。测试可通过该选项以及 `allowInsecureHttpForLocalhost` 配置本地目标。

解析后的全部地址都必须可接受，否则拒绝：

- 默认拦截私网、回环、链路本地、CGNAT、组播、文档网段等；
- 企业私网 IdP 需要同时写入主机名和对应 CIDR：仅有主机名时，解析到私网地址仍会被拦截；仅有 CIDR 时，主机名 URL 无法通过允许列表。对 IP 字面量 URL，CIDR 本身即可匹配。
- 云元数据地址（包括 `169.254.169.0/24`、`169.254.170.2`、`100.100.100.200`、`fd00:ec2::254`，以及对 `::ffff:` / NAT64 `64:ff9b::/96` 映射出的上述 IPv4）为硬拦截，即使出现在允许列表中也被拒绝。

默认出站路径使用已校验地址发起连接（`pinnedFetch` 把 `hostname` 设为该 IP，HTTPS 在主机名不是 IP 时设置 `servername` 为原主机名，`Host` 为原 `url.host`），从而避免按主机名二次解析。这是 IP 钉扎，不是形式上的零窗口，也没有 TTL 钉扎或连接后对 `socket.remoteAddress` 的复查。注入 `fetchFn` 的路径会在调用前完成同样的 URL 与地址校验，但不会把已校验地址绑定到套接字；不得把该路径写成已被 IP 钉扎。

### 3.5 JWK 过滤与 JWT 语义

继续忽略：缺 `kid`、`use` 存在且不为 `sig`、`key_ops` 存在但不含 `verify` 的密钥。补强：

- OKP + Ed25519 仅接受 `alg` 缺省、`EdDSA` 或 `Ed25519`；
- RSA 仅接受 `alg` 缺省或 `RS256`（与现有 `verifyJwtAuth` 算法面一致）；
- 单条无效或无法导入的 JWK 不会让整个 JWKS 失败，但若过滤后没有任何可用签名密钥，刷新失败。
- **审查修复：** 两个均通过过滤的签名密钥若共用同一 `kid` 但导出 PEM 不同，整份 JWKS 刷新失败（`invalid_signature` / duplicate kid），不会再以最后一条覆盖合法密钥；材料相同的重复条目仍可接受。

`verifyAuthorization` 只把缓存的 PEM 按 `kid` 交给 `verifyJwtAuth`。验签时使用 JWT header 的 `alg`（仅 `EdDSA` 或 `RS256`），**没有**把 header `alg` 与原始 JWK `alg` 再做一次显式交叉比较。算法与密钥类型不匹配时，预期由 `crypto.verify` 失败关闭，但这不是已验证的形式化交叉校验。`OidcJwksClient` 不传入 `hmacSecret`，因此 `HS256` 会因未配置密钥被拒绝；`alg=none` 等为不支持算法。

`tenantId` 仍只能来自通过签名、issuer、audience 和有效期校验的 JWT 声明；HTTP 请求 body 中的租户不能成为认证依据。过期令牌映射为认证失败（`token_expired` / HTTP 401），跨租户访问由业务层拒绝（HTTP 403），角色不足为 `insufficient_permissions`。

## 4. 测试命令与实际结果

### 4.1 工程完成基线 `b0de71b` 上的复跑

命令在仓库根目录、检出 `b0de71b` 时执行，环境为 Node v24.22.1、pnpm v10.34.6，时间 2026-11-28 07:32 CST（Asia/Shanghai）。

```text
$ pnpm run check

 RUN  v5.1.2 /workspace/repos/ai-optimization

 Test Files  8 passed (8)
      Tests  40 passed (40)
   Start at  07:32:31
   Duration  346ms
```

与实施时（2026-11-27 23:13 CST）报告的 8 个文件 / 40 个测试通过一致。当时专题测试为 16 个通过。

### 4.2 审查修复后的复跑

命令在包含修复提交 `af6fbc95a9215cce90d1ddcf813305932f9940bb` 的工作树上执行，同一环境，时间 2026-11-28 07:33 CST（Asia/Shanghai）。

```text
$ pnpm exec vitest run tests/m4-sandbox/m4-oidc-jwks.test.ts

 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  07:33:23
   Duration  382ms

$ pnpm run check

 RUN  v5.1.2 /workspace/repos/ai-optimization

 Test Files  8 passed (8)
      Tests  42 passed (42)
   Start at  07:33:26
   Duration  416ms
```

基线 `4716abb` 时代的全量测试是 8 个文件 / 26 个测试。P0-1 实施新增专题断言后为 40；本轮审查再新增 2 个重复 `kid` 测试后为 42。这不是全仓测试面的扩大解释。

### 4.3 本专题测试名称（修复后均已通过）

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
17. rejects a JWKS document that reuses a kid with different key material and does not accept either key
18. accepts duplicate JWKS entries that share a kid and identical key material

## 5. CI 结果

PR：https://github.com/flykingvip-cloud/ai-optimization/pull/2

### 5.1 工程完成基线 HEAD（已再次核对）

- Workflow：`CI`
- Event：`pull_request`
- Job：`verify`
- Run ID：`46023943679`
- URL：https://github.com/flykingvip-cloud/ai-optimization/actions/runs/46023943679
- SHA：`b0de71b4bfdc8432c96293ba4e85c4307888a9b3`
- 状态：`completed` / `success`
- 完成时间：2026-11-27 23:20:09 CST（Asia/Shanghai；Actions 时间戳为 2026-11-27T15:20:09Z）

成功步骤包括 TypeScript typecheck、测试作业、Dependency vulnerability audit（`pnpm audit --audit-level=high`）和 Secret scanning check。

同一基线还记录过针对 `c212a45` 的成功 run `46023375682`。讨论 HEAD CI 时以 `46023943679` 为准。

### 5.2 本轮审查提交的 CI

推送审查修复与本报告更新后，新 HEAD 会触发另一次 Actions。应以当时最新 Run 的实际状态为准；在 Run 完成前不得把新 HEAD 写成 CI 已通过。即使新 Run 成功，也只是本仓工作流证据，不是生产 IdP 联调或生产准入。

## 6. 独立安全审查结论（2026-11-28）

审查基于审前确认仍为 `b0de71b` 的功能分支，直接阅读 `oidc-jwks.ts`、`auth.ts` 中的 `verifyJwtAuth`，以及专题测试，而不是只采信原复验报告。下表是负责人指定的四项重点。

### 6.1 DNS 解析与实际连接之间的 TOCTOU / DNS rebinding

**代码事实：**

- 默认出站路径在 `assertTrustedUrl` / `resolveValidatedAddresses` 中解析主机，并要求**全部**地址通过校验后才调用 `pinnedFetch`。
- `pinnedFetch` 只使用 `addresses[0]`，把 `http`/`https.request` 的 `hostname` 设为该已校验 IP，而不是原主机名；因此默认路径不会为这次 TCP/TLS 连接再做一次按名字的 DNS 查询。
- HTTPS 且原主机名不是 IP 时设置 `servername` 为原主机名，`Host` 为原 `url.host`。未关闭证书校验，也未设置 `rejectUnauthorized: false`。按 Node 默认行为，身份校验应对 `servername`（原主机名）进行。这一点依据的是 Node 默认语义，本轮没有用真实证书做集成验证。
- 解析选项为 `all: true, verbatim: true`。没有 Happy Eyeballs，也没有失败后改连其他地址。任一地址不合格则整组拒绝，因此不存在「重试时连到未校验地址」的代码路径。
- 不可解析为 IP 的 lookup 结果会被 `isHardBlockedIp` 拒绝，避免把主机名再次交给 `request`。

**结论：** 默认路径存在真实的 IP 钉扎，经典「先解析到合法地址、再按主机名连接时重绑定到私网/元数据」的窗口在该路径上被关闭。不是漏洞。

**仍未闭合 / 未验证：**

- 没有记录或遵守 DNS TTL，也没有在连接建立后复查对端地址。
- 解析与发起连接之间仍有短暂时间窗，但连接目标是已校验的 IP 字符串，而不是二次解析的名字。
- 多地址时只连接第一条合格地址，这是可用性取舍，不是绕过。
- 自动化测试大量走 `fetchFn`；`pinnedFetch` 主要被 localhost HTTP IP 字面量用例间接覆盖，**没有**针对「主机名 + 已解析 IP + SNI/证书校验」的集成测试。不得把源码中的钉扎写成已由测试证明的 HTTPS 钉扎。

### 6.2 自定义 `fetchFn` 是否可能绕过 IP 钉扎

**代码事实：** `fetchOnce` 在存在 `fetchFn` 时先完成 `assertTrustedUrl`，再调用 `this.fetchFn(url, { signal, redirect: "manual", method: "GET" })`。已校验的 `addresses` **不会**传入 `fetchFn`，也不会用于套接字绑定。

**结论：** 会绕过。若 `fetchFn` 忽略 `redirect: "manual"`、自行 DNS、或连向其他地址，现有防护失效。这不是默认出站路径的缺陷，但是公共选项上的残留风险。已在 `OidcJwksOptions.fetchFn` 的 JSDoc 中写明，不得把「测试路径已校验 URL」写成「自定义 fetch 也被钉扎」。本轮未改变 `fetchFn` 的运行时行为（例如强制禁用或包装为钉扎传输），因为这是测试注入点，而不是默认生产传输。

### 6.3 每次重定向是否重新执行完整校验

**代码事实：** 在客户端自行跟随的路径上，每个 `Location` 都会重新走协议检查（含 HTTPS→HTTP 拒绝）、允许列表、解析后地址校验、元数据硬拦截，并取消未消费响应体。相对 URL、scheme-relative URL、多跳和超限由 `new URL(location, current)` 与 `maxRedirects` 处理。`file:` / 其他 scheme、带 userinfo 的 URL 会被 `assertTrustedUrl` 拒绝。

**结论：** 受控跟随路径是完整的，未发现必须立刻修复的重定向绕过。自定义 `fetchFn` 只有在遵守 `redirect: "manual"` 时才走同一路径；自行跟随重定向时，这些逐跳校验不会发生。原报告第 3.3 节若被读成「自定义 fetch 的重定向也一定完整」，属于过声称，现已收窄。

### 6.4 重复 `kid` 与 JWK 算法校验

**代码事实（审查前，基线 `b0de71b`）：** 通过过滤且能导入的密钥被写入 `nextKeys[jwk.kid]`。同一 `kid` 出现不同材料时，后写覆盖先写。恶意或错误的 JWKS 可以用后一条密钥替换先一条合法密钥。这是真实缺陷，不是过声称。

**修复（`af6fbc9`）：** 冲突的重复 `kid` 使整份 JWKS 刷新失败，同一文档中其他未冲突密钥也不会被缓存；材料相同的重复条目仍接受。测试 17、18 覆盖「冲突则两边都不接受（含同文档其他 kid）」以及「相同材料可接受」。

**过滤与失败模式：** `use` / `key_ops` / `kty` / `crv` / `alg` 允许列表在导入和验签前生效。`use=enc`、`key_ops` 不含 `verify`、`alg` 与密钥类型不匹配、缺 `kid`、无效材料会被跳过，不导致整份失败。过滤后无可用密钥则刷新失败。unknown `kid` 在刷新后仍映射为 `invalid_signature` / `Unknown signing key id`。

**仍未闭合：** 验签阶段没有把 JWT header `alg` 与原始 JWK `alg` 做显式交叉比较；缓存里只有 PEM。未发现可利用的算法混淆（`OidcJwksClient` 不配置 HMAC 密钥；错误算法/密钥类型预期在 `crypto.verify` 处失败），但不得把这一点写成已完成的交叉校验。

## 7. 原先已记录、仍然成立的风险

1. **真实生产 IdP 联调未做。** 没有对外部正式 issuer 发起 Discovery/JWKS 请求，也没有验证真实证书链、OCSP/CRL 或 IdP 侧轮换窗口。
2. **自定义 `fetchFn` 不钉扎套接字地址。** 见第 6.2 节。默认出站路径不受此限制。
3. **DNS 重绑定不是形式上的零窗口。** 见第 6.1 节。默认路径会把已校验地址用于连接，但未实现 TTL 钉扎或连接期复查；钉扎本身也缺少 HTTPS 集成测试。
4. **允许列表是精确主机名或 CIDR，不支持通配符。** 私网主机名 IdP 必须同时列出主机名和 CIDR。错误配置会导致刷新失败，这是收紧后的预期行为。允许列表不约束端口。
5. **IPv6 / NAT64 / 罕见 IP 字面量形式可能仍有边角。** 已覆盖 IPv4 映射、常见特殊网段和 Node `URL` 会归一化的十进制/十六进制 IPv4，但不能声称穷尽全部解析差异。
6. **算法面仍仅限 EdDSA 与 RS256。** 若未来生产 IdP 只提供 ES256 或其他算法，需要单独评估后再扩展，不得为了联调临时放宽校验。
7. **超大响应测试验证的是流在超过阈值后停止消费，而不是内核级或断电级的内存上限。** 取消时仍可能有已排队的一两块数据被计入读取量。
8. **OIDC 客户端配置变更是行为收紧。** 现有调用方如果未设置 `allowedJwksHosts`，在生产路径上将无法拉取任意公网 JWKS。这是有意为之，接入时需要显式配置。
9. **CI 成功只覆盖本仓工作流。** 它不包含真实生产 IdP、跨仓 OpenBot 联调或 PostgreSQL 生产验证。
10. **未知 `kid` 会触发刷新。** 受负缓存（默认 5 秒）约束，但仍构成有限的刷新放大面。

## 8. 生产准入

P0-1 在本仓已达到 Engineering Complete，并在独立审查中修复了冲突重复 `kid` 的覆盖问题。这只是生产准入条件中的一项准备工作。

生产准入仍然关闭。本 PR 不申请、不授权、也不构成生产 IdP 联调通过、生产切流或生产密钥配置完成。本轮不合并 PR #2，也不启动 P0-2。
