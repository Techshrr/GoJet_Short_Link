# GoJet V4 宝塔面板安装指南

本指南面向宝塔 Nginx、PHP-FPM、MySQL 和 Redis 环境。V4 生产包包含 Composer 依赖、编译前端资源和 Linux amd64 Go 跳转二进制，正常安装不需要 Node.js、npm、Composer 或 Go 编译器。

## 1. 软件

- Nginx 1.24+
- PHP 8.3 / 8.4，扩展见 [`SERVER_REQUIREMENTS.md`](SERVER_REQUIREMENTS.md)
- MySQL 8.0+
- Redis 7+
- Supervisor 管理器
- systemd 可用

## 2. 创建站点和数据库

在宝塔中创建站点、MySQL 数据库和数据库用户。站点目录建议：

```text
/www/wwwroot/gojet/current
```

上传 `GOJET-V4-PRODUCTION-*.zip` 并解压。网站运行目录必须选择：

```text
/www/wwwroot/gojet/current/public
```

## 3. 配置环境

```bash
cd /www/wwwroot/gojet/current
cp .env.example .env
nano .env
```

填写站点、数据库、Redis、SMTP、默认域名、管理员和后台路径。传统部署使用：

```dotenv
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
GOJET_REDIRECT_INTERNAL_URL=http://127.0.0.1
GOJET_CONTROL_PLANE_URL=http://127.0.0.1
GOJET_REDIRECT_SPOOL_DIR=/var/lib/gojet/spool
```

## 4. 执行安装

宝塔 PHP 8.4 示例：

```bash
sudo APP_DIR=/www/wwwroot/gojet/current \
PHP_BIN=/www/server/php/84/bin/php \
bash scripts/install.sh
```

若宝塔的 PHP 命令不在 PATH，可先创建软链接或把 `PHP_BIN` 改为实际路径。安装器会迁移数据库、设置权限、安装 Go 服务和 Scheduler；检测到 Supervisor 时安装默认队列 Worker。

## 5. Nginx

不要只使用普通 Laravel 伪静态。V4 需要将根级短码交给 Go 跳转面，并在 404/503 时回退 Laravel。以 [`deploy/nginx/gojet.conf`](../deploy/nginx/gojet.conf) 为基础，修改：

- 域名
- 证书路径
- 项目路径为 `/www/wwwroot/gojet/current/public`
- PHP socket 为宝塔实际 socket

在宝塔保存配置前先测试：

```bash
nginx -t
```

## 6. Supervisor

如果安装器没有自动安装，在宝塔 Supervisor 管理器添加进程：

```text
名称：gojet-worker
目录：/www/wwwroot/gojet/current
用户：www
命令：/www/server/php/84/bin/php artisan queue:work redis --queue=default --sleep=1 --tries=3 --timeout=60 --max-time=3600
```

短链接核心点击统计同步写入或由 Go durable spool 投递，不依赖 `analytics` 队列。

## 7. Go 和 Scheduler

```bash
systemctl status gojet-redirector gojet-scheduler
curl -fsS http://127.0.0.1:8081/healthz
```

宝塔 PHP-FPM 用户通常是 `www` 而不是 `www-data`。这种情况下复制 systemd 和 Supervisor 模板后，把 `User`、`Group` 改为 `www`，并确保 `/var/lib/gojet/spool` 属于该用户。

## 8. 后台设置顺序

1. 基础信息
2. Logo 与品牌资产
3. SEO
4. SMTP 配置和测试
5. 注册与邮箱验证
6. 链接策略
7. 统计与隐私
8. 存储与维护模式

SMTP 测试成功前不要开启强制邮箱验证。

## 9. 验收

- 创建短链并访问，点击数立即增加
- 从另一个页面点击短链，来源出现在分析中
- 停止 Worker 后核心点击仍记录
- SMTP 失败不出现 500，后台有失败日志和重试入口
- Logo、站点名称、描述和关键词保存后前台生效
- 公开站、用户控制台、管理后台在手机和桌面端无横向溢出

完整清单见 [`ACCEPTANCE_CHECKLIST.md`](ACCEPTANCE_CHECKLIST.md)。
