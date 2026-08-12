# 注册到统计全链路验收

`tests/integration/fullstackanalytics.sh` 会在临时目录启动独立的 MariaDB、Redis、Platform API、Redirect Engine 与 Analytics Worker，并执行所有数据库迁移。验收不会使用内存替身或预置业务数据。

验证路径包括：

1. 通过公开 API 注册用户，确认个人工作区自动获得 Starter 订阅；
2. 使用登录令牌在个人工作区创建短链，并确认运行时记录同步到 Redis；
3. 连续访问短链 10 次，确认 Redis 点击数为 10、独立访客为 1，且 MySQL 收到 10 条幂等分析事件；
4. 停止 Analytics Worker 后再访问 3 次，确认 Redis 实时计数继续增长而 MySQL 暂时保持不变；
5. 重启 Worker，确认 MySQL 自动追平至 13 条事件；
6. 确认显式传入的 10 个 `X-Request-ID` 均持久化到分析事件，能够跨服务追踪。

运行方式：

```bash
./tests/integration/fullstackanalytics.sh
```

脚本使用独立高位端口并在退出时清理进程和临时数据，适合作为本地或 CI 的真实依赖验收门禁。
