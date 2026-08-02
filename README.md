# GoJet V4

GoJet 是一套可自托管的品牌短链接与链接运营平台。V4 不再把“页面能打开”当作完成标准：公开网站、用户控制台和管理后台使用独立的信息架构；系统设置、邮件、工作区邀请、跳转和统计均按真实可恢复闭环实现。

## 技术栈

- Laravel 13 / PHP 8.3–8.5
- MySQL 8.0+ / Redis 7+
- Blade / Tailwind CSS / Alpine.js / ECharts / Vite
- 独立 Go 1.23 跳转面
- Nginx / PHP-FPM / Supervisor / systemd
- Docker Compose 或传统 Linux 部署

## V4 核心变化

### 公开网站

- 产品、解决方案、定价、开发者、状态、更新日志、关于和合规页面全部拥有独立内容结构。
- 视觉体系参考 S.EE 的页面层级、信息密度和产品演示方式，但使用 GoJet 自有品牌、文案与资产。
- 删除虚构客户、虚构评分、虚构访问量等无法验证的营销数字。

### 用户控制台

- 工作区切换、成员和邀请生命周期、链接管理、活动、标签、文件夹、域名、Token、Webhook 与资源管理采用 SaaS 控制台结构。
- 单链接分析包含点击、独立访客、机器人、二维码、来源、渠道、设备、浏览器、系统、地域、语言、UTM、目标分流和最近事件。

### 独立管理后台

- 与用户控制台分离的后台布局。
- 平台概览、用户与工作区、资源运营、风险治理、邮件日志、系统诊断和设置中心。
- 站点名称、描述、关键词、Logo、Favicon、分享图、邮件、认证、链接策略、统计、存储、维护模式及后台路径均可配置。

### 跳转与统计可靠性

- 普通 Laravel 跳转同步写入事件和计数，不依赖队列才能显示数据。
- Go 跳转面先把事件 `fsync` 到持久化磁盘队列，再返回跳转；控制面恢复后自动重试。
- 事件 UUID 保证幂等；Redis 只承担缓存和待持久化可见计数，不作为唯一数据源。
- 每日对账命令：`php artisan gojet:analytics:reconcile`。

### 邮件可诊断与恢复

- SMTP 测试成功后才可启用强制邮箱验证。
- 验证邮件、密码重置、测试邮件和工作区邀请均记录投递日志、错误和重试次数。
- 邮件故障返回用户可理解的结果，不再把底层异常直接显示为 HTTP 500。

## 部署包快速安装

### Docker Compose

```bash
cp .env.docker.example .env
# 修改 APP_URL、数据库、Redis、SMTP、后台路径及随机密钥
docker compose up -d --build
docker compose exec --user www-data app php artisan migrate --force
docker compose exec --user www-data app php artisan optimize
docker compose exec --user www-data app php artisan gojet:check
```

完整步骤见 [`docs/INSTALLATION_DOCKER.md`](docs/INSTALLATION_DOCKER.md)。

### Debian / Ubuntu / 宝塔传统部署

生产安装包已包含 `vendor/`、编译后的前端资源和静态 Go 二进制。上传到 `/var/www/gojet/current`，填写 `.env` 后执行：

```bash
sudo APP_DIR=/var/www/gojet/current bash scripts/install.sh
```

随后根据 [`deploy/nginx/gojet.conf`](deploy/nginx/gojet.conf) 配置域名、证书和 PHP-FPM socket。完整步骤见 [`docs/INSTALLATION_TRADITIONAL.md`](docs/INSTALLATION_TRADITIONAL.md)。

## 验证

```bash
bash scripts/validate-release.sh
```

GitHub CI 另外执行完整 PHP 数据库测试、Pint、前端锁定依赖构建、Go race test 和 vet。发布前还必须完成 [`docs/ACCEPTANCE_CHECKLIST.md`](docs/ACCEPTANCE_CHECKLIST.md) 中依赖真实 SMTP、DNS、浏览器和生产服务器的人工验收。

## 分支

- `main`：稳定发布
- `rebuild/v4-foundation`：V4 整套重构与验收分支

## 安全

Web 根目录必须指向 `public/`。生产环境必须关闭调试、限制 `.env` 权限、只在内网开放 MySQL/Redis，并使用 HTTPS。Go 跳转面只监听本机或容器网络，不直接暴露公网。

## License

仓库所有者未授予开源许可。All rights reserved.
