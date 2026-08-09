# Analytics Stream 恢复、对账与补偿

短链接请求以 Redis 原子计数为实时事实来源，并在同一 Lua 操作中把访问事件写入 Stream。Analytics Worker 负责异步持久化，但 Worker 停止不会让用户看到点击数回到零。

## Worker 自动恢复

- 每轮消费前使用 `XAUTOCLAIM` 认领超过空闲阈值的 Pending 事件，因此原 Consumer 崩溃后事件不会永久卡住。
- MySQL 事件写入和日汇总处于同一事务，并通过 `stream_id` 唯一键保持幂等。
- 数据库或网络错误保持 Pending 并持续自动重试，不会确认或删除事件。
- 无法解析的永久错误重试五次后进入死信；原事件仍保留在 Redis Stream，解析器修复后可原因化重新投递。
- 手工重新投递由 Redis Lua 同时检查幂等键和 `XADD`，API 重试不会制造重复 Stream 事件。

## Redis / MySQL 对账

独立 `analytics-reconciler` 按游标和有界批次遍历链接：

1. 对比 `gojet:clicks:{link_id}` 与 MySQL `analytics_events` 数量；
2. Redis 领先时记录 `worker_lag`，等待 Worker 从 Stream 自动补写；
3. MySQL 领先时使用 Lua 只增不减地修复 Redis，避免并发访问期间覆盖新点击；
4. 下一轮一致时自动记录恢复时间；
5. 管理后台展示差值、Pending、重试和死信，并允许原因化恢复。

## 真实 Redis 验收

`tests/integration/redis-analytics.sh` 启动真实 `redis-server`，验证崩溃 Consumer 的 Pending 自动认领、计数补偿不降低并发实时值，以及死信重新投递的 Redis 级幂等性。该测试不使用内存模拟 Redis。
