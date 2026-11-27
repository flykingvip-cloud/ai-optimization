# Failure Handling & Telemetry Resilience

- **OpenBot 主链路隔离**：Telemetry 客户端采用纯异步有界内存队列 + 有界磁盘 WAL（默认 `maxQueueItems=10000`, `maxDiskBytes=64MiB`, `retentionTtlMs=24h`）。
- **过载与断网降级**：远端不可用或超时（默认 3000ms）时进入指数退避重试；队列满时按 `drop-oldest` 策略丢弃低价值事件并递增 `telemetry.dropped_count`，**绝不抛出异常到 Agent 主执行路径**。
- **幂等与死信**：服务端按 `(tenantId, idempotencyKey)` 去重；超过最大重试次数的事件进入已脱敏死信存储供排查。
