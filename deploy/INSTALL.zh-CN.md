# GoJet Linux 生产安装手册

本文件适用于 `gojet-<版本>-linux-production.zip`。安装包是可直接构建的生产发行目录，不包含
Git 历史、Node 依赖、Playwright、测试报告或开发 Compose 文件。

## 0. 已有 Nginx 1.28.1 + PHP 8.3.31 + MySQL 8.0（原生安装）

这正是安装包支持的“传统 LEMP 主机”模式。需要说明：GoJet 后端是 Go 可执行程序，**不是 PHP
应用**，因此不会复制到 PHP 项目的 `public/` 目录，也不经过 PHP-FPM。PHP 8.3.31 与现有 PHP
站点保持不变；systemd 在本机启动 GoJet，Nginx 1.28.1 同时提供静态页面并反向代理本机端口。

除现有 Nginx、PHP-FPM 和 MySQL 8.0 外，还必须安装 Redis 7.x；启用文件分享时必须运行 ClamAV
daemon。发行 ZIP 已包含 Linux amd64 的 8 个生产二进制文件，不需要 Go、Node、Docker 或在生产机
编译源码。

解压后只需要启动一次安装向导，不需要手工编辑 `.env`：

```bash
unzip gojet-v4.0.0-rc.4-linux-production.zip
cd gojet-v4.0.0-rc.4-linux-production
sudo ./launch-web-installer.sh
```

命令会显示一个带一次性随机令牌的安装网址，例如
`http://服务器IP:18088/?token=...`。在浏览器中依次填写 MySQL 管理员连接、GoJet 数据库账号、
Redis、正式域名、管理员账号与安全密钥；页面会即时验证 PHP 扩展、MySQL 版本、数据库登录和 Redis
密码。点击“验证配置并开始安装”后，保持启动器窗口运行，后续数据库迁移、systemd 注册、Nginx
配置和健康检查会自动完成。

安装页只在安装期间临时启用，使用 192-bit 随机令牌；成功、失败或 30 分钟超时后都会删除临时
Nginx 配置和令牌。宝塔环境会自动使用 `/www/server/panel/vhost/nginx` 和 PHP 8.3 FPM socket；
标准 Debian 软件包环境使用 `/etc/nginx/conf.d`。如果服务器安全组拦截 18088，仅需在安装期间允许
管理员 IP 访问该端口，安装完成后立即关闭。

后台安装器会验证 Nginx >= 1.28、PHP >= 8.3，连接现有 MySQL/Redis，按顺序登记迁移，创建受限的
`gojet` 系统用户和 systemd 服务，并在 `nginx -t` 成功后 reload。Go 服务仅监听
`127.0.0.1:18080/18090/18092`。生成的 Nginx server block 只匹配 `PUBLIC_BASE_URL` 中的域名，
不会删除默认站点或覆盖已有 PHP 站点。证书仍由现有 Certbot/面板管理；可在生成的
`/etc/nginx/conf.d/gojet.conf` 上追加现有的 443/TLS 配置。

原生服务状态与日志：

```bash
sudo systemctl status 'gojet@*.service'
sudo journalctl -u gojet@platform-api -u gojet@redirect-engine -n 200
sudo nginx -t
curl -fsS http://127.0.0.1:18080/health
curl -fsS http://127.0.0.1:18090/health
```

如果希望数据库、Redis、ClamAV 也由安装包隔离管理，才选择下文 Docker Compose 模式；两种
模式不要在同一发行目录混用。

## 1. 主机与网络准备

最低建议：64 位 Linux、2 vCPU、4 GB RAM、20 GB 可用磁盘。正式文件分享和分析数据量较大时，
应使用独立数据盘或外部 S3。开放 `80/tcp`；TLS 在 Cloudflare、负载均衡器、Caddy 或 Certbot
代理处终止时还应开放 `443/tcp`。不要把 MySQL、Redis、ClamAV 或内部服务端口暴露到公网。

Ubuntu 24.04 / Debian 12 安装 Docker：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl unzip openssl
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
# 重新登录后继续，或者后续命令使用 sudo
```

RHEL / Rocky Linux 9 可使用 Docker 官方仓库安装 `docker-ce` 与
`docker-compose-plugin`。安装后确认：

```bash
docker version
docker compose version
```

## 2. 校验并解压发行包

把 ZIP 与同名 `.sha256` 上传到服务器，例如 `/opt/gojet/releases`：

```bash
cd /opt/gojet/releases
sha256sum -c gojet-v4.0.0-linux-production.zip.sha256
unzip gojet-v4.0.0-linux-production.zip
cd gojet-v4.0.0-linux-production
./scripts/verify-release.sh ../gojet-v4.0.0-linux-production.zip
```

`verify-release.sh` 会检查 ZIP 完整性、内部文件清单、逐文件 SHA-256、生产服务集合和是否误带开发
文件。发行目录建议保持只读；运行数据位于 Docker volumes，密钥仅位于
`deploy/.env.production`。

## 3. 创建生产配置

```bash
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
```

生成密钥（每一项必须分别生成，不能复用）：

```bash
openssl rand -base64 36   # MYSQL_PASSWORD
openssl rand -base64 36   # MYSQL_ROOT_PASSWORD
openssl rand -base64 36   # REDIS_PASSWORD
openssl rand -hex 32      # VISITOR_HASH_KEY
openssl rand -hex 32      # QR_TRACKING_KEY
openssl rand -base64 32   # SETTINGS_ENCRYPTION_KEY，必须解码为 32 字节
openssl rand -hex 32      # LOG_INGEST_TOKEN 与 LOG_WEBHOOK_TOKEN 使用同一个值
openssl rand -base64 36   # ADMIN_BOOTSTRAP_PASSWORD
```

编辑 `deploy/.env.production`，至少确认：

- `PUBLIC_BASE_URL=https://你的正式域名`；DNS 已指向当前主机；
- `ADMIN_BOOTSTRAP_EMAIL` 和高强度初始密码；
- 两个日志 Token 完全相同；
- `FILE_STORAGE_DRIVER=filesystem` 时无需填写 S3；生产对象存储使用 `s3` 时必须填写 endpoint、
  access key、secret key、bucket、region 和 TLS 开关；
- `HTTP_PORT` 没有被其他服务占用；告警邮箱 `ALERT_RECIPIENT` 可正常接收邮件；
- 使用安装包内置 Nginx 时设置 `NGINX_MODE=container`；使用系统 Nginx 时设置 `NGINX_MODE=host`；
- 文件中不存在 `replace-with-`，也没有把示例域名或空密码保留下来。

## 4. 安装并启动

```bash
sudo ./install.sh
```

安装器将依次执行：环境与 Compose 校验、拉取基础镜像、构建 GoJet 镜像、启动 MySQL/Redis、逐项
登记数据库迁移、启动全部服务，并轮询真实 `/health`。首次拉取 ClamAV 特征库可能需要几分钟。

### 使用主机已有的 Nginx

如果服务器已经由系统软件包安装了 Nginx，不要手工复制容器版 `gojet.conf`。容器版配置中的
`redirect-engine`、`platform-api` 是 Docker DNS 名称，主机 Nginx 无法解析。请改用：

```bash
sudo ./install-host-nginx.sh
```

该安装器使用 `compose.host-nginx.yaml` 禁用内置 Nginx，只把跳转引擎和 Platform API 分别绑定到
`127.0.0.1:18080`、`127.0.0.1:18090`，渲染绝对静态目录到系统 Nginx 配置，执行 `nginx -t`
后才 reload。MySQL、Redis、ClamAV 和 Worker 仍不开放主机端口。安装目录不能含空格。

查看状态：

```bash
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml ps
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml logs --tail=200
docker compose --env-file deploy/.env.production -f deploy/compose.production.yaml logs -f platform-api redirect-engine
curl -fsS http://127.0.0.1:${HTTP_PORT:-80}/health
```

访问入口：

- 公开站：`https://你的域名/`
- 用户控制台：`https://你的域名/app/`
- 管理后台：`https://你的域名/admin/`

## 5. 首次上线检查

1. 使用 bootstrap 管理员登录，立即修改密码并启用 TOTP；保存恢复码到离线密码库。
2. 在设置中心上传最终 Logo/Favicon，配置站点名称、SEO、邮件 SMTP 并发送真实测试邮件。
3. 创建普通用户、工作区和短链接，访问短链接后确认实时点击与历史分析均增长。
4. 上传一个允许类型的小文件，确认状态从 quarantine/pending 变为 clean 后才能下载。
5. 检查“系统诊断”中的 MySQL、Redis、邮件、文件扫描、Analytics 和日志趋势。
6. 在 Cloudflare 或外部代理启用 TLS Full (strict)，再启用 HSTS；不要在纯 HTTP 下录入生产密钥。

## 6. 备份与升级

升级前保留当前解压目录。解压新版本后复制旧配置，再执行：

```bash
cp /opt/gojet/releases/gojet-旧版本-linux-production/deploy/.env.production deploy/.env.production
sudo ./upgrade.sh
```

升级器先在当前新版本目录的 `backups/` 创建一致性 MySQL 压缩备份和版本记录，再构建、迁移并健康
检查。额外建议对 `gojet_mysql-data`、`gojet_redis-data`、`gojet_uploads` 和 `gojet_files` volumes
创建基础设施快照。

## 7. 回滚

进入保留的旧版本发行目录，复制生产配置并传入升级前备份：

```bash
cd /opt/gojet/releases/gojet-旧版本-linux-production
cp ../gojet-新版本-linux-production/deploy/.env.production deploy/.env.production
sudo ./rollback.sh ../gojet-新版本-linux-production/backups/gojet-20260809T120000Z.sql.gz
```

回滚会使用旧版本镜像定义重建服务、恢复 MySQL 并执行健康检查。数据库恢复会覆盖当前 GoJet 数据，
执行前必须保留一次当前快照。

## 8. 常见故障

- **环境校验失败**：检查占位值、密钥长度、重复密码、S3 必填字段和 `PUBLIC_BASE_URL`。
- **MySQL 不健康**：运行 `docker compose ... logs mysql`，检查磁盘空间及 volume 权限。
- **Platform API 不健康**：确认 MySQL/Redis 已健康，检查设置加密密钥是否仍为安装时原值。
- **文件一直等待扫描**：ClamAV 首次下载病毒库较慢；检查 `clamav` 与 `file-worker` 日志。
- **502**：先检查 `platform-api` 和 `redirect-engine` health，再检查 Nginx 日志。
- **误关 API/维护模式**：管理员入口仍保留，从 `/admin/` 的系统诊断或设置中心恢复。

不要执行 `docker compose down -v`，该命令会删除数据库、Redis、上传和文件 volumes。
