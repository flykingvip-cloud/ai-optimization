# TELEMETRY_API_SECURITY_LIMITS.md

> 正式 Adapter API 安全与容量约束（决策收口，不实施）。  
> 「正式 Adapter 不提供 GET；未知字段不得持久化」是本阶段指令要求固化的原则，**不是**正式 `APPROVED`。  
> **64 KiB 体上限与限流数值仅为候选，Owner 确认前不得标记为最终批准值。**  
> 禁止通过截断事件内容来满足容量限制。  
> 核验窗口：2026-11-28 19:19–19:23 CST。源码 SHA：AI Optimization `16b01d99d33b386102bb9b2b248558eb5517e245`。

---

## 1. 证据分类

| 类别 | 内容 |
| --- | --- |
| 源码验证事实 | `services/http-api/src/server.ts`、`services/telemetry-ingestion/src/index.ts`、`packages/shared-contracts/src/db.ts`、`contracts/openapi/ai-optimization-v1.yaml` |
| 用户提供记录 | t20u：正式 Adapter 不开放 GET；未知字段不持久化；64 KiB 仅候选；禁止截断事件 |
| 架构建议 | 状态码、审计指标、幂等键生成方、限流维度 |
| 待 Owner 决策 | Body 上限字节数、每 Tenant / Service Identity 的 QPS 或并发、429 重试约定的具体数字与窗口 |
| 尚未验证的假设 | 生产网关或网格是否已有另一层限流（本轮未查生产配置） |

---

## 2. 当前实现事实（不得当成已满足本阶段契约）

| 项 | 源码事实 | 路径 |
| --- | --- | --- |
| POST `/v1/telemetry/events` | 存在；先认证再 `ingest`；`tenant_mismatch` → 403，其他拒绝 → 400；成功 → 202 | `server.ts` 56–64 行 |
| GET `/v1/telemetry/events` | **实现存在**：认证后 `listForTenant(auth)` 返回该租户全部事件，**无分页、无角色门槛、无 OpenAPI 条目** | `server.ts` 67–69 行；`ingest` `listForTenant` 54–61 行 |
| OpenAPI | 仅声明该路径的 **post**：202 / 400 / 403。无 GET | `contracts/openapi/ai-optimization-v1.yaml` 7–14 行 |
| 读体 | `readJsonBody` 循环读取全部 chunk，**无字节上限** | `server.ts` 19–26 行 |
| 未知字段 | `ingest` 在使用 DB 时 `JSON.stringify(event)` 写入 `payload_json`；内存路径 `events.push(event)`。没有剥除未声明字段的步骤，因此请求中的额外属性会随整份对象持久化 | `telemetry-ingestion/src/index.ts` 29–51 行 |
| 必填校验 | 仅检查 `eventId`、`idempotencyKey`、`traceContext.runId`、`tenantId` 与 auth 一致、`redaction.applied`。不校验 W3C `traceId` 格式，不校验 agent 绑定，不校验未知字段 | 同文件 18–27 行 |
| 幂等 | DB：`UNIQUE (tenant_id, idempotency_key)`，`INSERT OR IGNORE`；内存：`${auth.tenantId}::${event.idempotencyKey}`。重复返回 `accepted` + `duplicate: true` | `db.ts` 15–22 行；ingest 45–47 行 |
| 限流 / 429 / 413 | **不存在** | `server.ts` 全文无 429、413、rate limit |
| 认证失败 | 401 或 403，不入库 | `server.ts` 113–124 行 |

这些事实支持「需要在正式 Adapter 契约中补齐限制」，而不是证明限制已经落地。

---

## 3. 正式 API 安全约束表（建议；带数值的行均为候选）

| 约束 | 建议规则 | 批准状态 |
| --- | --- | --- |
| 官方路由 | 正式 Adapter 契约只包含 **POST** `/v1/telemetry/events`。GET 不纳入官方 Adapter 契约。若过渡期代码路径仍暂留 GET，必须另审角色门槛、分页与审计，且不得写入正式集成验收 | 原则由本阶段指令要求固化；**非 APPROVED** |
| HTTP Body 最大字节数 | **候选初始值：64 KiB（65536 字节）**，按未解码的原始请求体计量。超限拒绝整个请求，**禁止截断事件内容后部分解析或入库** | **PENDING_OWNER**。确认前不得标为最终批准值 |
| 超限响应 | 建议 **413**（或 Owner 指定的等效状态），响应中不回显完整超大体，记录审计与指标 | 状态码待批 |
| 未知字段 | **丢弃且不持久化**。不得因「前向兼容」把未声明字段写入 `payload_json`。若采用「显式扩展袋」方案，须另审，本阶段不默认采用 | 原则要求固化；**非 APPROVED** |
| 已知字段校验失败 | 400；不入库 | 与现有 400 部分一致，仍待与新规则一并签批 |
| 限流维度 | **按 Tenant + Service Identity**（建议以已验证的 `auth.tenantId` + `auth.subjectId` 且 `principalType=service` 计）。User 反馈通道如获批，应有独立且更严的预算 | **策略方向为建议；数值 PENDING_OWNER** |
| 限流数值 | 无本轮批准值。不得把任何 QPS、突发令牌或窗口写成已定 | **PENDING_OWNER** |
| 429 | 被限流时返回 429，建议带 `Retry-After`；不入库。出站侧将 429 视为可重试，但不得在 OpenBot 主执行链上同步阻塞（见 WAL 文档） | 待与数值一并确认 |
| 幂等键生成 | 由 OpenBot **出站侧**生成稳定键，推荐派生自内部事件身份（例如 `evt_…` 或 `source.system + eventId`），**禁止用 Trace ID**（D-04） | 原则建议；待签批 |
| 去重范围 | 接收端 **Tenant + Idempotency Key** 唯一。跨租户相同键不得互相去重或串桶 | 与现有 UNIQUE 事实对齐，待作为正式契约签批 |
| 重复投递 | 同一键重复 POST 返回已接受的幂等成功（当前为 202 + duplicate），不创建第二条业务记录 | 建议保持 at-least-once 友好 |
| 审计与指标 | 至少计数并审计：接受、幂等命中、400/401/403/413/429/503、认证失败、跨租户拒绝、超限拒绝、未知字段拒绝（若可观测）、授权查询失败。审计记录不得包含未红化载荷 | 待批 |
| 认证 | 无有效凭证不得进入业务校验；fail closed | 与 D-02 一并签批 |

---

## 4. 出站侧配合（建议）

- 超出已批准（或候选待批）的体上限时，出站不得截断 payload 再发送；应记失败、保留在缓冲中按 WAL 规则处理或进入死信 / 拒绝审计，具体见 WAL 文档。
- 429 / 5xx / 网络中断：由异步缓冲重试；主执行链不等待。
- 400 / 401 / 403 中「契约永久拒绝」类错误不得无限重试同一非法体；须可观测。分类规则待实施计划细化，但不得为重试而改写租户或身份。

---

## 5. 验收条件

1. GET `/v1/telemetry/events` 不出现在正式 Adapter 契约与跨仓官方测试的成功路径中；若服务端仍实现该路由，正式验收不得依赖它，且须有独立的权限审查结论。
2. 在请求中加入未声明字段后，持久化记录中不出现该字段。
3. 超过 Owner 批准的 body 上限（未批准前不得用 64 KiB 作为「已批准上限」去宣称生产契约，但可用候选值做待批试验设计）的请求被整体拒绝，数据库无部分记录，响应不是 202。
4. 截断后的「看起来合法」的半截 JSON 不得被当成成功事件。
5. 相同 Tenant + Idempotency Key 的重复 POST 不产生第二条事件；不同 Tenant 的相同 Key 互不影响。
6. 以 Trace ID 为幂等键的事件被拒。
7. 限流触发时返回 429，且被限流请求未入库。限流数值以签批值为准。

**当前结论：** GET 与未知字段原则由本阶段指令要求固化；64 KiB 与限流数字 **PENDING_OWNER**；整体 **非 APPROVED**、**IMPLEMENTATION_BLOCKED**。
