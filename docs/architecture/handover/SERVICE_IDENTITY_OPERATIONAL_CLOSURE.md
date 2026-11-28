# SERVICE_IDENTITY_OPERATIONAL_CLOSURE.md

> Service Identity 技术与运维责任闭环审查（T2）。  
> 核验窗口：2026-11-28 20:12–20:18 CST（Asia/Shanghai）。  
> 源码 SHA：OpenBot `13763b2d85c6ca72d3bf5b10acb1825457776ff6`（相关身份/范围文件 blob 与 `f3558f2` 相同）；AI Optimization `16b01d99d33b386102bb9b2b248558eb5517e245`。  
> **没有可验证的签发、授权和撤销机制，不得宣布 D-03 已解除阻塞。**  
> 禁止编造责任人姓名或部门。未知项一律 `OWNER_DECISION_PENDING`。

---

## 1. 必须回答的八项

### 1.1 Service Identity 的签发主体及系统

**当前状态：`OWNER_DECISION_PENDING` / 源码未落地。**

本轮在三个仓库当前 `main`、PR #4–#9 评论与审查中，未发现已指定的生产签发方、IdP 产品名或签发工作流（`GITHUB_VERIFIED` 检索为空；生产配置未查，也不在本阶段授权范围内）。

现有实现只提供 JWT 验签接口：`verifyJwtAuth` 校验 Bearer、签名、exp/nbf、iss/aud，并要求 `sub` 与 `tenantId` 声明；`principalType` 仅当声明为 `"service"` 时视为服务，否则视为 `"user"`（`packages/shared-contracts/src/auth.ts` 36–122 行，`SOURCE_VERIFIED`）。这证明「如何校验一张已签发的票」，**不证明**谁有权签发。

**建议（`RECOMMENDATION`）：** 由 Owner 指定唯一签发主体及系统；非该签发方签发的身份一律拒绝。OpenBot 出站进程只持有运行所需凭证，不得把私钥写入遥测事件。

### 1.2 Identity 与 Tenant、Agent 的绑定方式

**当前状态：控制面未实现（`SOURCE_VERIFIED`），细则 `OWNER_DECISION_PENDING`。**

- 入库只校验 `event.tenantId === auth.tenantId`，不校验 Agent allowlist，不校验 Service Identity 与 Agent 的绑定（`services/telemetry-ingestion/src/index.ts` 18–27 行）。
- `disallowServiceImpersonation` 拒绝服务主体 `actAsUser`（`auth.ts` 103–105 行）。「Service Identity 代表某个 Agent」的授权对象在源码中不存在。
- `normalizeAgentId` 在空值或非法字符时回退到 `DEFAULT_AGENT_ID = "main"`（`src/routing/session-key.ts` 19、89–106 行）。官方出站若使用该回退冒充已授权 Agent，属于未授权绑定风险。
- 仓库中 `getChatInboundDepthAgentAllowlist`、技能演进相关 `agentAllowlist()` 等属于其他治理面，**不是** Telemetry Adapter 三方绑定表。

**建议（`RECOMMENDATION`）：** 绑定权威为「已验证 JWT 中的 `tenantId` + `sub`（Service Identity）+ 事件中的 `traceContext.agentId`」，并在入库当时查询当前 allowlist。禁止把非法或空 Agent id 规范化成 `"main"` 后出站或入库。

### 1.3 Agent allowlist 的创建、更新、审核、撤销责任人

**当前状态：`OWNER_DECISION_PENDING`。** 本轮未发现已指定的创建、更新、审核、撤销责任人。禁止编造。

在责任人被指定之前，该项保持阻塞。不得把「建议由平台安全团队负责」写成已指定。

### 1.4 Key/credential 的轮换和紧急撤销流程

**当前状态：`OWNER_DECISION_PENDING`。** 无已验证的轮换窗口、旧钥作废流程或紧急撤销演练记录。

**建议（`RECOMMENDATION`）：** 轮换须可在重叠窗口内完成，截止后旧钥立即失效；紧急撤销必须与 allowlist 撤销使用同一权威源或同步传播，并有可执行的值班路径。流程获批并落地之前，不得宣布 D-03 解除。

### 1.5 Allowlist 缓存 TTL、刷新策略和撤销传播时限

**当前状态：`OWNER_DECISION_PENDING`。** 无实现、无批准 TTL、无传播 SLA。

**建议（`RECOMMENDATION`，数字为候选而非批准值）：**

- 入库热路径若使用缓存，候选上限 TTL **30 秒**，撤销后必须主动失效缓存，而不是只等 TTL。
- 撤销传播候选时限：**60 秒内**全局拒绝新事件。最终数字须 Owner 确认。
- 缓存不可用或权威源不可达：按第 1.6 节 fail closed，不得视为「名单仍有效」。

### 1.6 身份服务不可用时的行为

**当前状态：实现与建议尚未对齐；对外细则 `OWNER_DECISION_PENDING`。**

事实（`SOURCE_VERIFIED`）：HTTP API 若未配置 `oidcClient` 或 `jwtConfig`，抛 `missing_token`，映射为 **401**（`services/http-api/src/server.ts` 47、113–121 行）。这是「未配置验签器」，不是「运行中 IdP/JWKS 暂时不可达」的完整模型。本轮未验证生产 IdP 超时或 JWKS 拉取失败的实际分支。

**建议（`RECOMMENDATION`）：**

- 必要授权依赖不可用、无法安全判定时：**503**，不得当作认证成功，也不得降级为匿名或放行。
- 出站侧将 503 视为可重试的对端/依赖故障，写入异步缓冲，**不得**同步失败 OpenBot 主执行链。
- 不得把依赖不可用记录成 200/202。

### 1.7 401、403、503 的区分

| 状态码 | 含义（建议，待签批） | 与当前实现的关系 |
| --- | --- | --- |
| **401** | 身份缺失或认证无效：缺 Bearer、格式错误、签名失败、过期、尚未生效 | 当前将 `missing_token` / `token_expired` / `invalid_signature` / `token_not_active` / `malformed_token` 映射为 401（`SOURCE_VERIFIED`） |
| **403** | 身份有效但无权访问：租户不匹配、角色不足、不在 allowlist、已被撤销、禁止冒充 | 当前将 `tenant_mismatch`、`missing_tenant_claim`、`insufficient_permissions`、`principal_impersonation_forbidden` 及 iss/aud 失败映射为 403。**尚无 allowlist 拒绝码**，因为控制面未落地 |
| **503** | 必要授权依赖不可用，无法安全判定 | **当前实现无此分支**。不得把依赖不可用当成成功 |

认证失败与授权失败均不得写入新事件。

### 1.8 新事件拒绝与已接收事件保留的边界

**建议（`RECOMMENDATION`，与 D-03 一并待签批）：**

- 撤销、过期、移出 allowlist、租户不匹配之后：**立即拒绝新事件**（建议 403）。
- **已接收且已成功入库的事件不自动删除**，也不因后续撤销而改写历史租户隔离。
- 审计必须记录拒绝原因；审计本身不得包含未红化载荷。
- 事件类型「撤销」（若指 `artifact.revoked` 等业务撤销）与「身份撤销」是两件事：前者是已接收业务对象的状态变化，后者是控制面禁止新事件。不得互相替代。

---

## 2. 闭环判定

| 判定条件 | 本轮结果 |
| --- | --- |
| 签发主体及系统是否明确 | 否，`OWNER_DECISION_PENDING` |
| 与 Tenant、Agent 的绑定是否可验证 | 否，控制面未落地 |
| allowlist 责任人是否指定 | 否，`OWNER_DECISION_PENDING` |
| 轮换与紧急撤销是否可执行 | 否 |
| 缓存 / 传播时限是否有批准值 | 否 |
| 依赖不可用是否 fail closed（含 503） | 建议已写，实现未对齐，未签批 |
| 新事件拒绝 / 已接收保留是否签批 | 否 |

**结论：** D-03 **未解除阻塞**。不得进入实施编码。
