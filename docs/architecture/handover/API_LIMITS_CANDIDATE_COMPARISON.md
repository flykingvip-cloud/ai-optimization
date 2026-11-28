# API 数字与策略候选方案比较

> 工作包 A1。全部数值均为**候选**，正式状态 `PENDING_OWNER`。**不得**将任何候选值标为 `APPROVED`。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> 源码基线：`flykingvip-cloud/ai-optimization` `origin/main` `16b01d99d33b386102bb9b2b248558eb5517e245`（相对上一包未漂移，`GITHUB_VERIFIED`）。  
> D-06 已批准原文：「明确正式 API、安全限制与字段策略；64 KiB 等数字另确认。」64 KiB 仍是候选，不是决定。

禁止把下列实现缺口当成已满足本方案；禁止把单仓 CI 成功当成 API 硬化已通过。

---

## 1. 当前实现事实（`SOURCE_VERIFIED`）

路径均相对于 `16b01d9`。GitHub blob 示例：[server.ts](https://github.com/flykingvip-cloud/ai-optimization/blob/16b01d99d33b386102bb9b2b248558eb5517e245/services/http-api/src/server.ts)、[ingest](https://github.com/flykingvip-cloud/ai-optimization/blob/16b01d99d33b386102bb9b2b248558eb5517e245/services/telemetry-ingestion/src/index.ts)、[OpenAPI](https://github.com/flykingvip-cloud/ai-optimization/blob/16b01d99d33b386102bb9b2b248558eb5517e245/contracts/openapi/ai-optimization-v1.yaml)。

| 项 | 事实 | 路径与行号 | 文件 blob SHA |
| --- | --- | --- | --- |
| POST `/v1/telemetry/events` | 存在。先 `authenticate` 再 `ingest`。`tenant_mismatch` → 403，其他拒绝 → 400，成功 → 202 | `services/http-api/src/server.ts` 53–64、33–48 行 | `7e15cc84bce5d676a99637577f863c77d9900cc8` |
| GET `/v1/telemetry/events` | **实现存在且走同一 `authenticate`**，随后 `listForTenant(auth)` 返回该租户全部事件；无分页、无额外角色门槛。**OpenAPI 未声明该 GET** | 同文件 67–69 行；`contracts/openapi/ai-optimization-v1.yaml` 仅 7–14 行声明 post | OpenAPI blob `bc20d9e0b9da3f49f234a5d620b2a6a1e54a828e` |
| OpenAPI 与 HTTP 漂移 | OpenAPI 还声明 `/v1/datasets`、`/v1/evaluations/jobs`、`/v1/experiments`、`/v1/artifacts`、`/v1/release-requests/{requestId}` 等路径；HTTP 实现另有 `POST /v1/datasets/...`、`POST /v1/evaluations/rules`、`GET .../bundle`、`POST .../revocations`。多条 OpenAPI 路径在 HTTP 层返回 404；GET telemetry 则是未文档化实现 | `server.ts` 72–112 行；OpenAPI 15–82 行 | 同上 |
| 读体 | `readJsonBody` 循环拼接全部 chunk，**无字节上限**，然后 `JSON.parse` | `server.ts` 19–26 行 | 同上 |
| 限流 / 429 / 413 / Retry-After | **不存在** | `server.ts` 全文 | 同上 |
| 必填与红化检查 | 检查 `eventId`、`idempotencyKey`、`traceContext.runId`、`event.tenantId === auth.tenantId`、`event.redaction?.applied`。**不校验** W3C `traceId`，**不校验** agent 绑定，**不调用** `ContractValidator`，**不进行服务端 PII / allowlist 再检查**。`redaction.applied === true` 即放行 | `services/telemetry-ingestion/src/index.ts` 18–27 行 | `fead8b25e9463b8a9ddde29ce103364bedc56967` |
| 未知字段 | 契约 schema 对事件信封声明 `additionalProperties: false`（`payload` 本身为开放 object）。`ContractValidator` **仅用于** `tests/contract/contracts.test.ts`，HTTP / ingest **不使用**。入库将整个 `event` `JSON.stringify` 写入 `payload_json`，或内存 `events.push(event)`，未声明信封字段会被持久化 | `contracts/json-schema/telemetry-event.schema.json` 6、77 行；`packages/shared-contracts/src/validator.ts`；ingest 29–51 行 | schema `203080db0dd57d0e4b01e85bc8524c5b47829386`；validator `972cc5efd67b585ceac194c8753f46446cb5e418` |
| 客户端 SDK 红化 | `BoundedTelemetryClient.enqueue` 在本地 `sanitizeTelemetryPayload` 后把 `redaction.applied` 设为 `true`。未知 payload 键被**静默跳过**（不入库到 payload，也不报错）。这是 SDK 行为，**不是**服务端再检查 | `packages/telemetry-sdk/src/index.ts` 44–56、150–160 行 | `02928668f00fa8cd8e858836ecf742b9241da7b6` |
| 幂等 | DB：`UNIQUE (tenant_id, idempotency_key)`，`INSERT OR IGNORE`；变化行数为 0 则 `duplicate: true`。内存：键为 `` `${auth.tenantId}::${event.idempotencyKey}` ``。无保留期。相同键不同载荷**不会**比较指纹，后到请求被当成重复成功，原记录不被覆盖也得不到 409 | `packages/shared-contracts/src/db.ts` 15–22 行；ingest 29–51 行 | db `a4264a2775f63f6a4e90a3ad92dc46229419c632` |
| 认证失败 | 未配置 `oidcClient` 或 `jwtConfig` 时抛 `missing_token`。认证类错误映射 401，其余 AuthError 映射 403，不入库。`process.env` 在 `origin/main` 的 `.ts` / `.yml` / `.yaml` 中**无匹配**，不存在生产 OIDC / issuer / audience / `allowedJwksHosts` 环境装配入口。`package.json` 无 start / 生产 server 脚本。官方 OpenBot 出站客户端不在本仓实现 | `server.ts` 47、113–124 行；`package.json` | 认证实现 `packages/shared-contracts/src/auth.ts` blob `80af43e37e73a5d1e0f361baa60d217cb0422a01` |
| 测试夹具 Issuer | 测试使用 `expectedIssuer: "https://auth.openbot.love"`、`expectedAudience: "ai-optimization"`。这是测试夹具，**不是**已验证的生产 IdP | `tests/security/security-and-auth.test.ts` 19–20、29–30、51–52 行 | — |
| JWKS 默认 | `OidcJwksClient` 在 `allowedJwksHosts` 省略时默认为空数组；空允许名单不允许远程 IdP | `packages/shared-contracts/src/oidc-jwks.ts` 14、40–43、447 行 | `b16577818786d22a5d1f6d9c97333eb9e3b08d10` |
| TelemetryEvent 契约 | `tenantId`、`idempotencyKey`、`traceContext.traceId` / `runId` 等为类型字段；ingest 不强制 `traceId` | `packages/shared-contracts/src/index.ts` 22–52 行 | `a85154534c9a08410e37e01efe9fc3c2be3b8b2a` |

PR #4（`8324aa2441145bb1c685df5c8e65694277398f84`，未合并）**不改变**上述 HTTP / ingest / OpenAPI / 幂等 / 限流体上限行为；其差异集中在 telemetry-sdk WAL。不得把 PR #4 描述为已解决 API 硬化。

`listForTenant` 虽按 `auth.tenantId` 过滤（`SOURCE_VERIFIED`），GET 仍不是正式 Adapter 契约的一部分。正式验收不得依赖 GET。GET **不得**绕过与 POST 相同的身份与授权边界——当前实现虽先认证，但仍缺少角色门槛、分页与审计，不得视为已满足正式安全策略。

---

## 2. 逐项候选比较

下列「推荐候选」仅供 Owner 选择，标签为 `RECOMMENDATION` + `OWNER_DECISION_PENDING`。容量与安全影响是分析，不是已测量的生产容量数据（本阶段未跑未授权测试，也未做生产流量验证）。

### 2.1 请求体最大字节数

| 方案 | 候选值 | 技术依据 | 容量影响 | 安全影响 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 推荐候选 | **65536 字节（64 KiB）**，按**未解码原始请求体**在 `JSON.parse` 之前计数 | Phase 1 官方事件应为结构化元数据与短摘要，不应承载附件或对话全文。当前 `readJsonBody` 无上限，存在内存放大与慢请求风险（`SOURCE_VERIFIED`）。D-06 将 64 KiB 明确列为「另确认」的例子，故它仍只是候选 | 限制单请求内存与 WAL / 入库行大小；合法红化事件通常可容纳。若工具观察经常超限，应改契约，而不是放大到可传原文 | 给未红化载荷一个硬上限，降低恶意超大体与 zip 炸弹式 JSON 的冲击面 | **不是 APPROVED** |
| 替代 A | 32 KiB | 更保守；可能过早拒绝含多条 tool 观察的合法事件 | 更省内存 | 更严的拒绝面 | — |
| 替代 B | 128 KiB 或 256 KiB | 若 Owner 确认 Phase 1 必须容纳更长结构化摘要 | 单请求与存储放大 | 上限越松，未红化原文越容易混入 | — |
| 替代 C | 1 MiB 或与 SDK `maxWalBytes`（默认 64 MiB）对齐 | **不建议。** 64 MiB 是 WAL 文件上限，不是 HTTP 体上限，不得混用（`SOURCE_VERIFIED`，`packages/telemetry-sdk/src/index.ts` 96 行） | 显著放大入口与磁盘 | 削弱 D-06 安全限制意图 | 仅作对照，不推荐 |

超限时必须**整请求拒绝**，禁止静默截断后再部分解析或入库。

### 2.2 Tenant 维速率限制

| 方案 | 候选值 | 技术依据 | 容量影响 | 安全影响 |
| --- | --- | --- | --- | --- |
| 推荐候选 | 每个已验证 `auth.tenantId`：**平均 20 请求/秒，突发 40 请求/秒，窗口 1 秒** | 当前无线程限流。必须以认证上下文计，不得用事件体内未验证 `tenantId` 计。与已有 `tenant_mismatch` 隔离一致 | 限制单租户误配置或重试风暴打满共享入口；数值偏保守，便于 Phase 1 观察后再调 | 降低租户级拒绝服务与凭证滥用的横向影响 |
| 替代 A | 10/秒，突发 20 | 更保守，可能影响合法突发回放（崩溃恢复后的 WAL 重放） | 更易触发 429，出站需可重试 | 保护面更强 |
| 替代 B | 50/秒，突发 100 | 给重放更大余量 | 共享入口更易被单租户占满 | 保护更弱 |

### 2.3 Service Identity 维速率限制

| 方案 | 候选值 | 技术依据 | 容量影响 | 安全影响 |
| --- | --- | --- | --- | --- |
| 推荐候选 | 每个已验证 Service Identity（`auth.subjectId` 且 `principalType=service`）：**平均 10 请求/秒，突发 20 请求/秒，窗口 1 秒**。与 Tenant 维**同时生效**，任一维触顶即限流 | 防止单一泄露或被盗服务凭证打满整租户配额。`principalType` 仅在声明为 `"service"` 时成立（`auth.ts` 102–105 行，`SOURCE_VERIFIED`） | 单身份回放能力低于整租户预算 | 缩小被盗凭证的爆破半径 |
| 替代 A | 与 Tenant 维相同（20/40） | 实现更简单 | 身份维失去额外约束 | 保护较弱 |
| 替代 B | 用户反馈通道若获批：独立更严预算（候选 2/秒，突发 5） | 用户主体与服务出站不是同一威胁模型 | 单独配额，避免互相挤占 | 需 Owner 确认是否开放用户通道；D-01 下个人数据仍不得进入企业遥测 |

User 通道是否存在，本身仍是范围问题，不得假定已批准。

### 2.4 超限响应及 Retry-After

| 场景 | 推荐候选 | 技术依据 | 容量影响 | 安全影响 | 替代 |
| --- | --- | --- | --- | --- | --- |
| 请求体超限 | **413 Payload Too Large**；不截断、不入库；响应不回显完整超大体；记审计与指标 | 截断会导致半截 JSON 被当成成功事件，破坏证据完整性 | 立即释放读体循环 | 避免超大体进入存储 | 400（不推荐，与校验失败混淆） |
| 速率超限 | **429 Too Many Requests**，响应头 **`Retry-After: 1`**（候选整数秒，对齐 1 秒窗口）。被限流请求不入库。出站将 429 视为可重试，但不得同步阻塞 OpenBot 主执行链 | 当前无 429 分支。与 D-07 异步非阻塞原则一致（原则已批，数字未批） | 为出站退避提供明确信号 | 无 Retry-After 时客户端更易同步重试打满入口 | `Retry-After: 2` 或按剩余窗口动态秒数（实现更复杂，仍待批） |

### 2.5 幂等键保留期

| 方案 | 候选值 | 技术依据 | 容量影响 | 安全影响 |
| --- | --- | --- | --- | --- |
| 推荐候选 | **24 小时**，自首次成功接受起算 | 当前无 TTL，幂等行无限保留（`SOURCE_VERIFIED`）。24 小时覆盖常见崩溃恢复与重试，又不无限累积 | 控制 `telemetry_events` 去重索引长期膨胀 | 超长保留增加历史键被误复用的窗口；过短则延迟重放可能被当成新事件 |
| 替代 A | 12 小时 | 更短存储 | 延迟很久的重放更可能超出窗口 | 需同时批准超期规则 |
| 替代 B | 7 天 | 覆盖更长离线缓冲 | 存储与唯一键表更大 | 键复用冲突窗口更长 |

超期后同一键再提交的规则必须由 Owner 一并确认。推荐候选：超期后若载荷指纹不同则 **409 Conflict**；若完全相同则仍返回幂等成功，以避免延迟重放被当成新业务。该超期规则同样是候选，不是批准值。

幂等键必须由 OpenBot 出站侧生成，**禁止使用 Trace ID**（D-04 已批准原文）。作用域为已验证 Tenant ID + Idempotency Key；跨租户相同键不得互相去重或串桶。

### 2.6 相同幂等键、不同载荷的冲突行为

| 方案 | 候选行为 | 技术依据 | 容量影响 | 安全影响 |
| --- | --- | --- | --- | --- |
| 推荐候选 | 保留期内，同一 Tenant + Key 但事件身份或关键载荷指纹不一致：返回 **409 Conflict**，不覆盖原记录，不入库新记录。完全相同则 202 + `duplicate: true` | 当前 `INSERT OR IGNORE` 把不同载荷也标成 `duplicate: true`，调用方无法发现键被复用到不同事件（`SOURCE_VERIFIED`） | 增加指纹比较与 409 审计 | 防止追踪或键碰撞合并两条不同业务事件 |
| 替代 A | 维持现状（一律当重复成功） | 实现最简单，与 at-least-once 重放兼容，但**掩盖冲突** | 无额外存储 | 安全与证据完整性更弱 |
| 替代 B | 覆盖原记录 | **不建议。** 破坏已接收事件的不可变证据 | 写入放大 | 后到的伪造或错误体可能覆盖先到的合法事件 |

### 2.7 未知字段处理及服务端红化策略

| 子项 | 推荐候选 | 技术依据 | 容量影响 | 安全影响 | 替代 |
| --- | --- | --- | --- | --- | --- |
| 未知信封字段 | **拒绝（400）且不持久化**。不得因「前向兼容」把未声明字段写入 `payload_json`。与 schema `additionalProperties: false` 对齐，但必须在 **HTTP 入库路径**启用校验，而不是只存在于契约测试 | 契约测试已证明额外字段会使 `ContractValidator` 失败（`tests/contract/contracts.test.ts`），生产路径未接该校验（`SOURCE_VERIFIED`） | 轻微 CPU（Ajv 校验） | 降低意外 PII 与契约漂移 | 「丢弃未知字段后接受」更宽松，但仍须保证持久化记录中不出现该字段，且不得静默截断已知字段 |
| payload 未知键 | 服务端按已批准 allowlist 再过滤；未声明键不得持久化。SDK `sanitizeTelemetryPayload` 的静默跳过**不能**代替服务端策略 | 客户端可被绕过 | 小 | 防止旁路 SDK 直接 POST 原文 | 对未知 payload 键直接 400（更严） |
| 服务端红化 | **必须在服务端执行**。客户端 `redaction.applied` **不得作为已红化证据**，最多作为调用方自报声明写入审计并与服务端结果对照。服务端策略名待 Owner 指定。未通过服务端红化检查：400，不入库 | ingest 18–27 行只检查布尔标志，等于信任客户端（`SOURCE_VERIFIED`） | 增加检测成本 | 这是 D-06 字段策略的核心缺口 | 在策略未指定前 fail-closed：拒绝一切带敏感形态字段的请求 |

出站侧配合（`RECOMMENDATION`）：超出已批准（或候选待批）体上限时，不得截断后再发送；应记失败并按 WAL 规则保留或进入拒绝审计。429 / 5xx / 网络中断由异步缓冲重试；400 / 401 / 403 / 409 / 413 中的永久拒绝不得无限重试同一非法体。

---

## 3. 建议验收条件（仍待 Owner 确认，非已执行测试）

1. GET 不出现在正式 Adapter 契约与跨仓官方测试的成功路径中；若过渡期暂留，必须与 POST 使用同一身份 / 授权边界，并另审角色、分页与审计。
2. 请求加入未声明信封字段后，不得 202 入库，持久化记录中不出现该字段。
3. 超过批准体上限的请求被整体拒绝，数据库无部分记录。未批准前不得用 64 KiB 宣称生产契约已生效。
4. 相同 Tenant + Key 的真重复不产生第二条业务记录；不同 Tenant 的相同 Key 互不影响；冲突体返回批准的冲突码（候选 409）。
5. 以 Trace ID 为幂等键的事件被拒。
6. 仅声明 `redaction.applied=true` 但服务端检测到未红化敏感数据时，请求被拒绝。
7. 限流触发时返回 429 且带 `Retry-After`，被限流请求未入库。数值以签批值为准。

**当前结论：** 候选方案已形成并与 `16b01d9` 源码对齐；**全部数值与细则均未签署**。实施阻塞。
