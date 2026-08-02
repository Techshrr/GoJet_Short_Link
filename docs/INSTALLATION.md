# GoJet V4 安装入口

请选择一种完整部署方式，不要混用容器路径和宿主机路径。

## Docker Compose

适用于希望由 Compose 管理 Nginx、Laravel、Go 跳转面、Worker、Scheduler、MySQL 和 Redis 的环境：

- [`INSTALLATION_DOCKER.md`](INSTALLATION_DOCKER.md)
- 环境模板：`.env.docker.example`
- 编排文件：`compose.yaml`

## 传统 Nginx / PHP-FPM

适用于 Debian、Ubuntu、宝塔或 aaPanel：

- [`INSTALLATION_TRADITIONAL.md`](INSTALLATION_TRADITIONAL.md)
- 宝塔中文说明：[`INSTALLATION_BAOTA_ZH_CN.md`](INSTALLATION_BAOTA_ZH_CN.md)
- Nginx：`deploy/nginx/gojet.conf`
- Go 服务：`deploy/systemd/gojet-redirector.service`
- Scheduler：`deploy/systemd/gojet-scheduler.service`
- Worker：`deploy/supervisor/gojet-worker.conf`

生产部署包已经包含 Composer 生产依赖、编译前端资源和 Linux amd64 静态 Go 二进制；普通安装不需要 Node.js、npm 或 Go 编译器。

## 安装后的必需进程

- PHP-FPM
- Go redirector
- Laravel scheduler
- Laravel `default` 队列 worker
- MySQL
- Redis
- Nginx

短链接核心统计不依赖 `analytics` 队列。默认队列仍用于邮件、Webhook 或其他可重试任务。

## 共同验收

部署后必须：

1. 在后台设置中心修改网站名称、SEO、Logo 和邮件配置并确认前台生效。
2. 发送 SMTP 测试邮件，再启用强制邮箱验证。
3. 创建短链接并通过真实浏览器访问，确认点击和来源维度更新。
4. 停止 Laravel 默认队列 Worker 后再次访问短链接，确认核心点击仍会记录。
5. 检查 Go `/healthz`、spool 目录权限和待处理事件数。
6. 完成 [`ACCEPTANCE_CHECKLIST.md`](ACCEPTANCE_CHECKLIST.md)。
