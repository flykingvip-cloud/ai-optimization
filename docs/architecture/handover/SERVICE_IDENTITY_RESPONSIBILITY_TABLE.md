# Service Identity 运维责任表

> 工作包 A2。只列出必须指定的职责与已知源码事实，**不编造**姓名、部门、服务名称或 SLA。  
> 核验窗口：2026-11-28 23:30–23:42 CST（Asia/Shanghai）。  
> 源码：AI Optimization `16b01d99d33b386102bb9b2b248558eb5517e245`；OpenBot 当前 `main` `73013587e3a5ccd96a0d0c284f7223199d39ed75`。身份 / TaskOutcome 相关路径 blob 与 `b10ad59` / `b4e106de` / `13763b2d` / `f3558f2` **相同**（`SOURCE_VERIFIED`，见主报告第 2 节）。  
> D-03 已批准原文：「Tenant、Service Identity、Agent 三方绑定；allowlist 与撤销责任须明确。」该原文**未**指定签发主体或部门。空白一律 `OWNER_DECISION_PENDING`。

没有可验证的签发、授权和撤销机制，不得宣布 D-03 的责任指定已解除阻塞。原则批准 ≠ 控制面已落地。

---

## 1. 责任指定表（待 Owner 填写）

| 职责项 | 必须指定的内容 | 当前指定值 | 正式状态 | 建议（`RECOMMENDATION`，与决定严格分开） |
| --- | --- | --- | --- | --- |
| 唯一签发主体及系统 | 唯一有权签发官方 Service Identity 的主体，以及签发所使用的系统 / IdP 名称（须为真实指定，不得用测试夹具顶替） | **未指定** | `OWNER_DECISION_PENDING` | 指定唯一签发方；非该签发方签发的身份一律拒绝。OpenBot 出站进程只持有运行所需凭证，不得把私钥写入遥测事件。测试夹具 `https://auth.openbot.love` / audience `ai-optimization` **不是**生产签发系统（`SOURCE_VERIFIED`，`tests/security/security-and-auth.test.ts` 19–20 行） |
| 密钥持有责任人 | 持有签发密钥或等价凭证材料的责任人（可写角色席位，但须是 Owner 指定的真实席位，本文件不得代填） | **未指定** | `OWNER_DECISION_PENDING` | 持有与使用分离；出站运行时不得兼负根签发密钥保管 |
| 密钥轮换责任人及周期 | 轮换执行责任人，以及周期 / 重叠窗口 | **未指定**；无已验证周期 | `OWNER_DECISION_PENDING` | 轮换须可在重叠窗口内完成，截止后旧钥立即失效。本文件不提出伪装成 SLA 的周期承诺，也不填写候选天数以免被误认为已批 |
| 紧急撤销责任人与值班路径 | 有权立即作废身份的责任人，以及可执行的值班联系路径 | **未指定** | `OWNER_DECISION_PENDING` | 紧急撤销必须与 allowlist 撤销使用同一权威源或同步传播。路径获批并演练之前，不得宣布撤销机制可用 |
| Agent allowlist 创建责任人 | 谁有权把 Agent 纳入官方出站 / 入库绑定表 | **未指定** | `OWNER_DECISION_PENDING` | 创建与审核不宜为同一未分离席位（建议，非指定） |
| Agent allowlist 更新责任人 | 谁有权变更绑定（Agent、租户、服务身份） | **未指定** | `OWNER_DECISION_PENDING` | 变更必须可审计 |
| Agent allowlist 审核责任人 | 谁有权批准变更生效 | **未指定** | `OWNER_DECISION_PENDING` | 与创建 / 更新分离有助于防止自批自用 |
| Agent allowlist 撤销责任人 | 谁有权将 Agent 或绑定立即移出名单 | **未指定** | `OWNER_DECISION_PENDING` | 与紧急身份撤销协同，但不能互相替代 |
| 缓存 TTL 与撤销传播时限 | 入库热路径缓存最长存活时间；撤销后全局拒绝新事件的时限 | **未指定**；无实现、无批准值、无 SLA | `OWNER_DECISION_PENDING` | 若使用缓存，候选上限 TTL **30 秒**，撤销后必须主动失效，而不是只等 TTL。撤销传播候选时限：**60 秒内**全局拒绝新事件。这些数字是候选，**不是** SLA，也 **不是** 批准值 |
| 身份服务不可用时的 fail-closed 行为 | 验签器 / JWKS / allowlist 权威源不可达时的对外行为 | 细则未签批。源码仅覆盖「未配置验签器」→ 401，不是「运行中依赖暂时不可达」的完整模型 | `OWNER_DECISION_PENDING` | 无法安全判定时：**503**，不得当作认证成功，不得降级为 anonymous / runner，不得 200/202。出站将 503 视为可重试依赖故障，写入异步缓冲，**不得**同步失败 OpenBot 主执行链 |

上表空白不得用「平台安全团队」「身份组」等空泛名称填入。

---

## 2. 已知源码事实（不得当成控制面已落地）

### 2.1 AI Optimization（`16b01d9`，`SOURCE_VERIFIED`）

- `verifyJwtAuth` 校验 Bearer、签名、exp/nbf、iss/aud，并要求 `sub` 与 `tenantId` 声明；`principalType` 仅当声明为 `"service"` 时视为服务，否则视为 `"user"`。`disallowServiceImpersonation` 拒绝服务主体 `actAsUser`（`packages/shared-contracts/src/auth.ts` 36–122 行）。这证明「如何校验一张已签发的票」，**不证明**谁有权签发。
- 入库只校验 `event.tenantId === auth.tenantId`，不校验 Agent allowlist，不校验 Service Identity 与 Agent 的绑定（`services/telemetry-ingestion/src/index.ts` 18–27 行）。
- HTTP API 若未配置 `oidcClient` 或 `jwtConfig`，抛 `missing_token`，映射为 401（`services/http-api/src/server.ts` 47、113–121 行）。这是「未配置验签器」，不是 JWKS / IdP 超时模型。本轮未验证生产 IdP 超时分支（本阶段也不得连接生产 IdP）。
- `origin/main` 无 `process.env` 形式的 issuer / audience / `allowedJwksHosts` 生产装配；`allowedJwksHosts` 默认空数组时不允许远程 IdP（`oidc-jwks.ts` 14、447 行）。
- 当前 iss/aud 失败、`missing_tenant_claim`、`insufficient_permissions`、`principal_impersonation_forbidden` 映射为 403；尚无 allowlist 拒绝码，因为控制面未落地。
- **无 503 依赖不可用分支**（`SOURCE_VERIFIED`）。

### 2.2 OpenBot（当前 `main` `73013587`，相关 blob 未变，`SOURCE_VERIFIED`）

- 个人 `TrustedScope` 只有 `personalDomainId` / `subjectRef` / `authzScopeRef`，**没有** `tenantId`；企业分支才有 `tenantId`（`src/task-outcome/types.ts` 63–71 行）。这与 AI Optimization `TelemetryEvent.tenantId` 必填构成跨仓契约冲突，支持 D-01「第一期仅企业遥测」。
- `scopeFromChatEntry`：存在非空 `tenantId` 则构建 enterprise，否则构建 personal；空 `subjectRef` 会填成 `"anonymous"`（`src/task-outcome/chat-entry.ts` 47–65 行）。这是内部账本回退，**不是**官方 Adapter 出站身份。D-02 已禁止 anonymous/runner 作为正式身份。
- runner 默认范围使用 `subjectRef: "runner"` / `authzScopeRef: "agent-runner"`，无 tenant 时 `personalDomainId: "personal:runner"`（`src/task-outcome/runtime-from-runner.ts` 1007–1023 行）。
- `normalizeAgentId` 在空值或非法字符时回退到 `DEFAULT_AGENT_ID = "main"`（`src/routing/session-key.ts` 19、89–106 行）。官方出站若使用该回退冒充已授权 Agent，属于未授权绑定风险。建议：禁止把非法或空 Agent id 规范化成 `"main"` 后出站或入库（`RECOMMENDATION`）。
- 本轮未在 OpenBot 或 AI Optimization 当前 `main` 发现 Telemetry Adapter 三方绑定表或生产签发工作流。仓库中其他 allowlist（如聊天入站深度、技能演进）**不是**本控制面。

---

## 3. 401 / 403 / 503 区分（建议，待签批）

| 状态码 | 建议含义（`RECOMMENDATION`） | 与当前实现的关系（`SOURCE_VERIFIED`） |
| --- | --- | --- |
| **401** | 身份缺失或认证无效：缺 Bearer、格式错误、签名失败、过期、尚未生效 | 当前将 `missing_token` / `token_expired` / `invalid_signature` / `token_not_active` / `malformed_token` 映射为 401 |
| **403** | 身份有效但无权：租户不匹配、角色不足、不在 allowlist、已被撤销、禁止冒充 | 部分已实现；**尚无 allowlist / 撤销拒绝码** |
| **503** | 必要授权依赖不可用，无法安全判定 | **当前实现无此分支** |

认证失败与授权失败均不得写入新事件，也不得降级为匿名。新事件在撤销、过期、移出 allowlist 或租户不匹配之后应立即拒绝；**已接收且已成功入库的事件不自动删除**。业务对象撤销（如 `artifact.revoked`）与身份撤销是两件事，不得互相替代。以上边界建议待与 D-03 责任指定一并签批（`OWNER_DECISION_PENDING`）。

---

## 4. 闭环判定

| 判定条件 | 本轮结果 |
| --- | --- |
| 签发主体及系统是否明确 | 否，`OWNER_DECISION_PENDING` |
| 与 Tenant、Agent 的绑定是否可验证 | 否，控制面未落地（`SOURCE_VERIFIED`） |
| allowlist 四类责任人是否指定 | 否，`OWNER_DECISION_PENDING` |
| 密钥持有 / 轮换 / 紧急撤销是否可执行 | 否，`OWNER_DECISION_PENDING` |
| 缓存 / 传播时限是否有批准值 | 否，`OWNER_DECISION_PENDING` |
| 依赖不可用是否 fail closed（含 503） | 建议已写，实现未对齐，未签批 |
| 不得用测试 Issuer 冒充生产 IdP | 已复核夹具不是活 IdP（`SOURCE_VERIFIED`） |

**结论：** D-03 原则已批准，但责任指定与控制面 **未解除阻塞**。不得进入实施编码。
