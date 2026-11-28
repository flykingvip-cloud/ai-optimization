# IMPLEMENTATION_PLAN_DRAFT.md

> **草案 / 未批准。**  
> 配套于 `IMPLEMENTATION_ADMISSION_REPORT.md` 附录。  
> 核验窗口：2026-11-28 21:43–21:50 CST（Asia/Shanghai）。  
> 当前正式准入状态仍是 `BLOCKED_PENDING_BOTH`（21:43–21:50 CST 刷新后未改变）。本文件在 Owner 签署与单独实施授权之前 **全部无效**，不得开 PR、不得编码、不得部署。工作流表相对 20:12–20:18 CST 草案无授权变化，仅重印新窗口。

若——且仅若——D-01–D-07、身份责任人、API 批准数字、Version Snapshot 纳入/排除清单、PR #4 处置以及跨仓最小 L2 集均已书面批准，并另有「开始实施」授权，建议按下列工作流推进。顺序可在获批后调整，但不得跳过身份与隔离。

| 序号 | 工作流 | 主要仓库 | 依赖的已批准决策 | 明确不做什么 |
| --- | --- | --- | --- | --- |
| 0 | 将签署结果录入决策记录 | `ai-optimization`（仅文档，仍须单独 PR 授权） | D-01–D-07 及配套项 | 不把草案本身当签署 |
| 1 | 身份签发对接、三方绑定、撤销、503 | `ai-optimization` | D-02、D-03 | 不接生产 IdP，除非另有生产变更授权 |
| 2 | API 硬化：POST-only 契约、未知字段、体上限、限流、服务端红化、幂等 TTL | `ai-optimization` | D-06 | 不信任客户端 `redaction.applied`；不截断 payload |
| 3 | OpenBot 本地异步缓冲 | `openbot-vp` | D-07 及 PR #4 处置 | 不依赖未授权合并的 PR #4；不宣称断电安全；不阻塞主链 |
| 4 | OpenBot Telemetry Adapter 出站 | `openbot-vp` | D-01、D-04、D-05 | 不虚构 Tenant ID；不用 latest/`rule-v2` 回填；不绕过 Evolution Control |
| 5 | 跨仓 L2 验收（14 项） | 三仓 | 全部相关签署 + 本矩阵 | 单仓 CI ≠ 跨仓通过；不用纯 Mock 替代第 10–13 项 |
| 6 | OpenBot CI 失败另案排障 | `openbot-vp` | 不作为 Adapter 开工前提，但是生产声明的前提 | 不削弱测试换绿 |

生产准入在本草案中仍然 **关闭**。L2 通过也不自动打开生产。
