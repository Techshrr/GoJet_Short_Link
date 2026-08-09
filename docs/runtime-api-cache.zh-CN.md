# API 与公开设置缓存运行时控制

设置中心的“API 与缓存运行时”分组直接写入加密设置存储，并由每次请求读取，无需重启 Platform API。

- `api.enabled=false` 会暂停用户、工作区和业务 API，返回 `503` 与 `Retry-After`；健康检查、公开状态、公开设置和管理员恢复入口保持可用。
- `cache.enabled=true` 会把公开品牌与 SEO 设置缓存到 Redis 的 `gojet:cache:public-settings`。
- `cache.default_ttl_seconds` 接受 10–86400 秒；响应通过 `X-GoJet-Cache: MISS|HIT` 暴露缓存状态。
- 保存任意设置或上传、删除品牌资产都会立即删除公开设置缓存，下一次读取回源 MySQL 并重建缓存。
- 维护模式继续由需要填写原因和管理员二次验证的诊断入口控制，避免通过普通表单绕过审计。

关闭 API 不会关闭管理员入口，这是故障恢复的必要逃生通道；生产环境仍应配合网关限流和监控告警。
