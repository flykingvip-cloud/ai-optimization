# SERVICE_IDENTITY_AND_AGENT_AUTHORITY.md

> 身份签发、授权、撤销及责任归属（决策收口，不实施）。  
> 本文件中的规则是**架构建议**或**本阶段指令要求固化的原则**，**不是**正式 `APPROVED`。  
> 源码中尚未落地的控制面标为 `PENDING_OWNER` / `UNVERIFIED`。不得猜测具体人名或部门名。  
> 关联总报：`OWNER_DECISION_CLOSURE_REPORT.md`。核验窗口：2026-11-28 19:19–19:23 CST（Asia/Shanghai）。

---

## 1. 证据分类与基线

| 类别 | 本文件用法 |
| --- | --- |
| GitHub 已验证事实 | 仓库 SHA 与 PR 状态，见总报第 1 节。 |
| 源码验证事实 | 下列路径与行号，OpenBot `@13763b2d85c6ca72d3bf5b10acb1825457776ff6`（相关文件与 `f3558f2` blob 相同），AI Optimization `@16b01d99d33b386102bb9b2b248558eb5517e245`。 |
| 用户提供记录 | t20u：禁止 anonymous/runner 作为正式 Adapter 身份；认证失败 fail closed；三方绑定；撤销后禁止新事件、已接收事件不自动删除。 |
| 架构建议 | 责任矩阵、403/503 区分、撤销传播。 |
| 待 Owner 决策 | 所有责任人指定、缓存 TTL、对外状态码细则的最终确认。 |
| 尚未验证的假设 | 生产 IdP 产品名、签发工作流、缓存实现。本轮未接入真实 IdP。 |

---

## 2. 已验证的源码事实

### 2.1 OpenBot 身份与范围

- `TrustedScope` 个人分支字段为 `personalDomainId`、`subjectRef`、`authzScopeRef`，**没有** `tenantId`；企业分支才有 `tenantId`（`src/task-outcome/types.ts` 63–71 行）。
- `scopeFromChatEntry`：存在非空 `tenantId` 则构建 enterprise（`enterpriseDomainId = enterprise:${tid}`）；否则构建 personal（`personalDomainId = personal:${subject}`）。空 `subjectRef` 会被填成 `"anonymous"`（`src/task-outcome/chat-entry.ts` 47–65 行）。这是内部账本回退，**不是**已存在的官方 Adapter 出站身份。
- runner 默认范围：有 tenant 则为 enterprise 且 `subjectRef: "runner"`、`authzScopeRef: "agent-runner"`；否则 personal，`personalDomainId: "personal:runner"`，同样 `subjectRef: "runner"`（`src/task-outcome/runtime-from-runner.ts` 1007–1023 行）。
- `callerOwnsTaskOutcome`：企业任务要求调用方 `tenantId` 与 `scope.tenantId` 完全相等；个人任务只比 `subjectRef`（`src/task-outcome/reject-result.ts` 39–51 行）。
- `normalizeAgentId` 在空值或非法字符时回退到 `DEFAULT_AGENT_ID = "main"`（`src/routing/session-key.ts` 19、89–106 行）。官方出站若使用该回退冒充 Agent，属于未授权绑定风险。
- 仓库中存在的 `getChatInboundDepthAgentAllowlist`、`skill-auto-evolution` 的 `agentAllowlist()` 属于入站深度标志或技能演进治理，**不是** Telemetry Adapter 的 Tenant + Service Identity + Agent 绑定表。不得把它们写成已有遥测 allowlist。

### 2.2 AI Optimization 认证与入库

- `AuthContext` 只有 `subjectId`、`tenantId`、`roles`（`owner|operator|approver|service`），无 anonymous / runner 主体类型（`packages/shared-contracts/src/index.ts` 16–20 行）。
- `TelemetryEvent.tenantId` 为必填（同文件 22–28 行）。这与 OpenBot 个人 TrustedScope 无 `tenantId` 构成跨仓契约冲突，支持第一期仅企业出站、禁止虚构 Tenant ID。
- `verifyJwtAuth`：缺少 Bearer、格式错误、签名失败、过期、nbf、iss/aud 不匹配会抛 `AuthError`；`sub` 或 `tenantId` 缺失抛 `missing_tenant_claim`；`principalType` 仅识别 `"service"` 否则视为 `"user"`（`packages/shared-contracts/src/auth.ts` 36–122 行，关键 41–48、98–121 行）。
- HTTP API 在处理路由前先 `authenticate`；无 verifier 时抛 `missing_token`。`AuthError`：`missing_token` / `token_expired` / `invalid_signature` / `token_not_active` / `malformed_token` → **401**；其余（含 `missing_tenant_claim`、`insufficient_permissions`、`principal_impersonation_forbidden`、issuer/audience）→ **403**。认证失败路径不会调用 `ingest`（`services/http-api/src/server.ts` 33–48、51–64、113–124 行）。**已验证：当前实现没有「认证失败降级为 anonymous 后继续写入」的分支。**
- `ingest`：`event.tenantId !== auth.tenantId` → `tenant_mismatch` → HTTP **403**。不检查 `traceContext.agentId` 是否在名单中，不检查 Service Identity 与 Agent 绑定（`services/telemetry-ingestion/src/index.ts` 18–27 行）。**三方绑定控制面未落地（UNVERIFIED / 未实现）。**
- 服务身份「代表用户」：`disallowServiceImpersonation` 在 `actAsUser` 时拒绝（auth.ts 103–105 行）。「Service Identity 代表 Agent」的授权对象在源码中不存在。

### 2.3 事件类型（用于白名单建议的事实基础）

`TelemetryEventType` 包括运行时 `runtime.run.*`、`runtime.model.called`、`runtime.tool.called`、`runtime.task_outcome.recorded`、`runtime.feedback.recorded`，以及评价 / 实验 / 产物 / 部署类事件（`packages/shared-contracts/src/index.ts` 1–14 行）。源码未规定 User 与 Service 的发送白名单。

---

## 3. 本阶段指令要求固化的原则（非 APPROVED）

1. 第一期官方出站仅 Enterprise Scope，且必须带已验证的真实 `tenantId`。个人 TrustedScope 允许且应当没有 Tenant ID，不得虚构 Personal Tenant，不得用 `personalDomainId` 或 `personal:${subject}` 冒充 `tenantId`。
2. Personal 的反馈、日志、引用、附件和会话内容不得改写后写入 Enterprise 租户桶，也不得作为企业事件的 payload 字段间接带出。
3. `anonymous` 与 `runner` 禁止作为正式 Adapter 出站或入库身份。内部账本回退不得变成官方入口。
4. 认证失败、身份缺失、租户不匹配必须 fail closed，禁止降级后继续发送或写入。
5. 运行时事件由已认证 Service Identity 发送；已认证 User 仅可在授权后发送反馈类事件（建议白名单见第 5 节，待签批）。
6. 授权为 Tenant + Service Identity + Agent 三方绑定；入库当时查当前名单；撤销后立即拒绝新事件；已接收事件不自动删除。
7. 授权服务不可用不得误判为授权成功。

---

## 4. 责任矩阵（待 Owner 指定，禁止编造人名）

| 项目 | 必须明确的内容 | 当前状态 | 架构建议（待批） |
| --- | --- | --- | --- |
| Service Identity 签发方 | 谁签发生产与非生产凭证 | **PENDING_OWNER / 源码未落地** | 由架构负责人指定唯一签发方；非该签发方签发的身份一律拒绝 |
| 密钥持有方 | 私钥 / 客户端凭证存放与访问名单 | **PENDING_OWNER** | 与运行主机分离的密钥托管；OpenBot 出站进程只持有运行所需凭证，不得把私钥写入遥测事件 |
| 轮换方 | 谁执行轮换、重叠窗口、作废旧钥 | **PENDING_OWNER** | 轮换必须可在不中断已配置出站的前提下使旧钥在截止后立即失效 |
| 撤销方 | 谁能立即作废一个 Service Identity | **PENDING_OWNER** | 撤销必须与 Allowlist 撤销使用同一权威源或同步传播 |
| Allowlist 创建 | 谁可以把某 Agent 绑定到某 Identity + Tenant | **PENDING_OWNER** | 仅指定角色可写；变更必须审计 |
| Allowlist 修改 | 谁能改绑定 | **PENDING_OWNER** | 同上 |
| Allowlist 撤销 | 谁能删除或禁用绑定 | **PENDING_OWNER** | 撤销立即生效，见第 6 节 |
| 授权校验实现 | 哪个服务在 ingest 时执行三方绑定查询 | **未落地** | AI Optimization 入库路径在接受事件前同步校验；校验失败不得写入 |

在责任人被指定之前，该项保持 `PENDING_OWNER` 且 **IMPLEMENTATION_BLOCKED**。不得把「建议由平台安全团队负责」写成已指定。

---

## 5. 身份与事件范围（建议，待签批）

| 身份 | 是否允许官方发送 | 是否需要 Tenant | 是否允许跨租户 | 是否允许关联 Agent | 建议允许的事件范围 | 审计要求 |
| --- | --- | --- | --- | --- | --- | --- |
| anonymous | **No** | 不适用 | 拒绝 | No | 无 | 若出现，记为安全事件并拒绝 |
| runner（内部 subjectRef） | **No** | 不得用其作为官方出站身份 | 拒绝 | No | 无 | 若出现，拒绝 |
| 已认证 User | 仅反馈类，且须授权 | 第一期必须是企业 Tenant，且 token `tenantId` 与事件 `tenantId` 一致 | 默认拒绝 | 仅当该 User 对目标 Agent / 任务有授权，且不得冒充 Service Identity | 建议仅 `runtime.feedback.recorded`；禁止 `runtime.run.*` / `runtime.model.called` / `runtime.tool.called` / `runtime.task_outcome.recorded` | 记录 `subjectId`、`tenantId`、`principalType=user` |
| 已认证 Service Identity | Yes（第一期企业） | 必须 | 默认拒绝 | 仅当三方绑定当前有效 | 运行时事件：`runtime.run.*`、`runtime.model.called`、`runtime.tool.called`、`runtime.task_outcome.recorded`；是否允许反馈类待批（建议默认否，避免服务冒充用户反馈） | 记录签发身份、`tenantId`、`agentId`、来源组件 |
| Service Identity「代表 Agent」 | 仅通过三方绑定表达，不另造 impersonation 声明 | 必须 | 拒绝 | 必须在当前 allowlist 内 | 同上 | 禁止只凭 token 内自报 `agentId` 而跳过名单查询 |

跨租户请求（事件 `tenantId` ≠ 已验证 token `tenantId`，或试图把个人数据写入企业桶）必须拒绝。第一期个人范围：不出站、不入库。

---

## 6. 三方绑定、撤销传播与校验失败

### 6.1 绑定规则（建议）

校验逻辑顺序必须是：

1. 验证凭证（签名、有效期、iss/aud、`principalType`、`sub`、`tenantId`）。失败 → 不进入授权查询。
2. 校验事件 `tenantId` 与已验证 `auth.tenantId` 一致。
3. 对运行时事件：用 **当前** Allowlist 查询 `(tenantId, serviceIdentity, agentId)` 是否存在且未撤销、未禁用。Agent 缺失、未知或仅为 `normalizeAgentId` 回退得到的 `"main"` 而名单中无对应项 → 拒绝。
4. 通过后才写入。不得先写后查。

名单查询必须以入库当时的权威状态为准，不得只信事件自描述。

### 6.2 撤销传播（建议，TTL 为待批项）

| 项 | 建议 | 状态 |
| --- | --- | --- |
| 权威源 | Allowlist 的禁用 / 删除 / 迁移立即成为权威「当前状态」 | 待批；控制面未落地 |
| 缓存 | 若为减轻查询负载而引入只读缓存，必须有 TTL 与主动失效 | **TTL 数值 PENDING_OWNER**，不得用默认值假装已定 |
| 主动失效 | 撤销操作应使缓存条目立即失效；至少在 TTL 到期前不得把已撤销绑定判为成功 | 待批 |
| 失效期间行为 | 缓存不可用或过期必须回源；回源失败按第 6.3 节失败封闭，不得用过期「允许」缓存放行 | 待批 |
| 已接收事件 | 撤销后禁止新事件；已成功接收并持久化的事件不自动删除、不重写抹去 | 本阶段指令要求固化，待签批 |
| Agent 迁移 | 旧绑定必须先撤销或同时切换；迁移过程中旧 Identity 不得继续写旧或新 Agent，除非名单已显式包含新绑定 | 待批 |

### 6.3 校验失败与 401 / 403 / 503（建议）

| 条件 | 建议 HTTP 状态 | 不得出现的行为 |
| --- | --- | --- |
| 缺少或非法凭证、签名失败、过期、iss/aud 不匹配 | **401**（与当前 `server.ts` 对部分 `AuthError` 的映射一致） | 不得降级 anonymous 后 202 |
| `tenantId` / `sub` 缺失、权限不足、禁止 impersonation、跨租户、不在 allowlist、Agent 已禁用 / 删除 / 未绑定 | **403** | 不得写成 200/202；不得因「稍后可能授权」而接受 |
| Allowlist 或授权服务不可用、查询超时、内部错误导致**无法证明当前已授权** | **503**（当前实现尚无该分支，属建议契约变更） | **不得把不可用误判为授权成功**；也建议不要把「查不到名单服务」直接变成 403 以致调用方误以为是永久无权限，但 403/503 的最终选择待 Owner 确认。无论 403 还是 503，都必须 fail closed，不得 202 |
| 请求体过大、未知字段策略拒绝、限流 | 见 API 文档；建议 413 / 400 / 429 | 不得截断后部分入库 |

当前源码在授权服务不可用方面没有独立 503，因为绑定查询尚未实现。引入查询后必须补上失败封闭，禁止默认允许。

---

## 7. Personal / Enterprise 隔离细则（D-01，建议）

- 官方出站过滤器：仅 `scope.kind === "enterprise"` 且 `tenantId` 非空并与凭证一致的事件可发送。
- 不得为满足对端必填 `tenantId` 而编造值。
- 企业事件 payload 不得包含个人空间文档正文、个人附件、个人会话引用、个人反馈原文。
- 企业员工的 Personal Space 与独立个人用户同一策略：第一期均不出站到企业桶。
- 管理员权限不能成为读取或出站个人内容到企业遥测的理由。
- 日志与追踪字段若可能带出个人内容，必须按红化策略处理；无法红化则省略该字段，不得改挂到企业 Tenant。

---

## 8. 验收条件

1. 以 anonymous 或 runner 作为官方出站 / 入库身份的请求被拒绝，且无事件落库。
2. 故意提供无效、过期或错误签名的凭证时，服务端不调用成功入库路径，不出现 `principalType` 被改写为匿名后 202。
3. 跨租户事件返回 403（或等效失败），目标租户桶无新记录。
4. 未绑定或已撤销的 `(tenant, identity, agent)` 组合被拒绝；撤销前已接收事件仍在，且内容不被自动删除。
5. 模拟授权查询失败（超时 / 5xx / 连接拒绝）时，事件被拒绝；无「查询失败仍 accepted」路径。
6. 个人 TrustedScope 事件在第一期不出站；测试中不出现虚构 `tenantId`。
7. 责任矩阵中的签发方与运维责任人已由 Owner 书面指定——该条在指定前视为未满足，阻塞实施。

**当前结论：** 原则可审议，责任人未指定，控制面未落地。状态 = 原则由本阶段指令要求固化 + `PENDING_OWNER` + `IMPLEMENTATION_BLOCKED`。
