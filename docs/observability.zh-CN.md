# 结构化日志与关联 ID

Platform API 和 Redirect Engine 为每个 HTTP 请求生成 `X-Request-ID`。客户端提供的 ID 只有符合 16–64 位字母、数字、下划线或连字符时才会被采用；其他值会被替换，避免日志注入。

响应始终返回同一个 ID。Redirect Engine 将其写入 Redis Stream，Analytics Worker 再保存到 MySQL `analytics_events.request_id`。管理员请求审计也保存同一字段，因此可以从一次 API 请求追踪到跳转事件、Worker 持久化和管理员操作。

日志按 NDJSON 输出，固定包含：

- UTC 纳秒时间；
- 服务名、级别和事件名；
- request ID；
- HTTP 方法、路径、状态码、响应字节和耗时；
- Worker 错误分类、Stream ID 与 Consumer。

默认输出到容器标准输出。配置 `LOG_WEBHOOK_URL` 后，同一条 NDJSON 还会 POST 到外部日志接收器；外部接收器异常不会改变业务 HTTP 响应。后台接口 `GET /api/admin/logs/correlation/{request_id}` 可查询相关分析事件和管理员审计。
