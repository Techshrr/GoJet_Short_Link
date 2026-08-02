# GoJet V4 Architecture

## 1. 三个产品表面

GoJet V4 不再用一套侧边栏承载全部功能。

1. **公开网站**：产品、解决方案、定价、开发者、状态、更新日志、关于与合规页面。
2. **用户控制台**：链接、活动、标签、文件夹、域名、分析、工作区、成员、Token、Webhook 和个人资源。
3. **管理后台**：平台运营、用户和工作区、资源治理、风险、账单、邮件、诊断及系统设置。

三者共享设计令牌，但使用独立布局、导航和信息密度。

## 2. 控制面

Laravel 是系统事实控制面，负责：

- 身份、认证、邮箱验证与密码恢复
- 工作区、成员、邀请和角色
- 链接、域名、路由规则和配额
- 管理后台、运营治理和审计
- 系统设置、邮件日志与重试
- 事件落库、报表、导出和对账

MySQL 是业务数据和统计事件的最终事实来源。

## 3. 跳转面

### Laravel 兜底路径

需要会话或复杂判定的链接，例如密码保护、最大点击限制和复杂智能路由，由 Laravel 处理。点击事件和计数同步写入数据库，不依赖后台队列。

### Go 快速路径

Nginx 仅把根级短码交给 `gojet-redirector`：

1. 从 Redis 缓存读取解析结果；未命中时请求 Laravel 内部解析端点。Go 与 Laravel 必须使用相同的 `REDIS_PREFIX`（默认 `gojet-database-`）和 `REDIS_DB`。
2. 合并目标参数、存储 UTM 和访问者查询参数。
3. 生成事件 UUID。
4. 写入临时文件，`fsync` 文件，原子重命名并 `fsync` 目录。
5. 只有持久化磁盘队列成功后才返回跳转。
6. 后台投递器批量把事件发送到 Laravel 内部点击端点。
7. 在 HTTP 2xx 或幂等冲突 409 后删除事件文件；Laravel 明确返回 400、404 或 422 的永久无效事件移入 `spool/failed` 隔离目录，其余错误继续重试。

如果磁盘队列不可写，Go 返回 503，Nginx 自动回退 Laravel；系统不会用“成功跳转但永久丢统计”换取表面可用。

## 4. 统计一致性

`AnalyticsRecorder` 在一个数据库事务中完成：

- 事件 UUID 幂等校验
- 链接行锁与最大点击校验
- 隐私哈希访客标识
- 每日独立访客判断
- 机器人、设备、浏览器、操作系统识别
- Direct、Unknown、站内、搜索、社交、活动和普通引荐分类
- 点击事件、链接总数和日聚合写入

Redis 的 `gojet:realtime:{link}` 仅用于展示 Go 已接收但尚未落库的待处理数量。定时命令 `gojet:analytics:reconcile` 对链接计数、日聚合和失败事件进行核对，不会因为事件保留策略而错误降低历史总点击。

## 5. 邮件可靠性

`MailDeliveryService` 统一处理验证、密码恢复、工作区邀请、测试和重试：

- 投递前检查配置和 SMTP 验证状态
- 捕获传输异常
- 保存收件人、类型、状态、尝试次数、上下文和错误摘要
- 支持后台重试失败记录
- 日志落库失败不得再次遮蔽原始邮件错误

强制邮箱验证只能在 SMTP 测试成功后开启。

## 6. 数据存储

- **MySQL**：用户、工作区、链接、域名、访问事件、聚合、邮件日志、审计与运营数据。
- **Redis**：缓存、会话、限流、默认队列和 Go 待持久化可见计数。
- **持久化磁盘卷**：Go 访问事件队列 `/var/lib/gojet/spool`。
- **私有存储**：上传文件、导出、日志和框架缓存。

## 7. 部署拓扑

### Docker

Nginx、Laravel App、默认队列 Worker、Scheduler、Go Redirector、MySQL 和 Redis 均为独立服务。Go spool 使用专用持久化卷。

### 传统 Linux

- Nginx：公网入口与 Go/Laravel 路由
- PHP-FPM：Laravel 控制面
- systemd：Go redirector、Laravel scheduler
- Supervisor：Laravel 默认队列 worker
- MySQL / Redis：本机回环或私网

## 8. 故障模型

- Redis 故障：Go 缓存降级；Laravel/MySQL 可继续解析。
- Laravel 暂时不可用：已进入 Go spool 的事件保留并重试。
- 点击事件永久无效：事件移入 `spool/failed` 留待诊断，不堵塞正常投递队列。
- Go spool 不可写：Nginx 回退 Laravel，不静默丢事件。
- SMTP 故障：业务页面返回可理解错误，后台保留诊断和重试入口。
- Worker 停止：邮件等默认队列任务延迟；短链接核心统计不依赖该 Worker。
