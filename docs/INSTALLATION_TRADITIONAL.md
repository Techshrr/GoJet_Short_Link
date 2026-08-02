# 传统 Nginx / PHP-FPM 安装

适用于 Debian 12、Ubuntu 24.04、宝塔和 aaPanel。推荐目录：

```text
/var/www/gojet/current
```

## 1. 依赖

- PHP 8.3–8.5 与 [`SERVER_REQUIREMENTS.md`](SERVER_REQUIREMENTS.md) 中的扩展
- Nginx 1.24+
- MySQL 8.0+
- Redis 7+
- Supervisor
- systemd

生产安装包已包含 `vendor/`、`public/build/`、`public/assets/gojet-v4.css` 和 `bin/gojet-redirector`，因此无需在服务器安装 Composer、Node.js 或 Go。

## 2. 数据库

```sql
CREATE DATABASE gojet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gojet'@'127.0.0.1' IDENTIFIED BY 'LONG_UNIQUE_PASSWORD';
GRANT ALL PRIVILEGES ON gojet.* TO 'gojet'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Redis 必须设置密码并只监听本机或私网。

## 3. 解压与配置

```bash
sudo mkdir -p /var/www/gojet/current
sudo unzip GOJET-V4-PRODUCTION.zip -d /var/www/gojet/current
cd /var/www/gojet/current
sudo cp .env.example .env
sudo nano .env
```

至少填写数据库、Redis、站点 URL、默认 Host、SMTP、管理员、后台路径及随机密钥。传统部署保持：

```dotenv
GOJET_REDIRECT_INTERNAL_URL=http://127.0.0.1
GOJET_CONTROL_PLANE_URL=http://127.0.0.1
GOJET_REDIRECT_SPOOL_DIR=/var/lib/gojet/spool
```

## 4. 执行安装器

```bash
sudo APP_DIR=/var/www/gojet/current bash scripts/install.sh
```

安装器会：

- 验证 PHP 和扩展
- 使用包内生产依赖与前端资产
- 生成缺失密钥
- 设置 `storage`、`bootstrap/cache` 和 spool 权限
- 执行迁移和 Laravel 优化
- 安装并启动 Go redirector、Scheduler 和 Supervisor Worker（检测到对应服务时）
- 运行 `gojet:check`

只安装应用而不改服务：

```bash
sudo INSTALL_SERVICES=0 APP_DIR=/var/www/gojet/current bash scripts/install.sh
```

## 5. Nginx

复制 [`deploy/nginx/gojet.conf`](../deploy/nginx/gojet.conf)，修改：

- `server_name`
- SSL 证书路径
- `/var/www/gojet/current`
- PHP-FPM socket

模板会把根级短码转发到 `127.0.0.1:8081`，并在 Go 返回 404 或 503 时回退 Laravel。不要把所有路径都代理给 Go。

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. 服务验证

```bash
sudo systemctl status gojet-redirector gojet-scheduler
sudo supervisorctl status gojet-worker:*
curl -fsS http://127.0.0.1:8081/healthz
sudo -u www-data php /var/www/gojet/current/artisan gojet:check
sudo -u www-data php /var/www/gojet/current/artisan gojet:analytics:reconcile --dry-run
```

确认 `/var/lib/gojet/spool` 所有者为 `www-data`，且未处理 JSON 文件不会持续增加。

## 7. 后台初始设置

登录自定义后台路径后，依次完成：

1. 基础信息
2. 品牌资产与 Logo
3. SEO
4. SMTP 测试
5. 注册与邮箱验证策略
6. 默认链接策略
7. 统计与隐私
8. 存储和维护模式

SMTP 测试未成功前不要开启强制邮箱验证。
