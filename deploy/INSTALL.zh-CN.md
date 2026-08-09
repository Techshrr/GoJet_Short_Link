# GoJet V4 Linux 生产安装手册

本手册适用于 `gojet-4.0.0-rc.5-linux-production.zip` 及后续采用标准 Web 安装器的版本。

> RC4 的临时 Token、`18088` 安装端口以及 MySQL root/管理员密码安装方式已经停用。

## 1. 当前优先支持的 Native 环境

GoJet RC5 首要验收环境：

- Debian 12 / Ubuntu 24.04，64 位；
- 宝塔面板（aaPanel/BT）管理 Nginx 网站；
- PHP 8.3，仅用于 `/install/` Web 安装向导；
- MySQL 8.x；
- Redis；
- systemd；
- ClamAV daemon（文件分享安全扫描；未安装时允许安装主系统，但文件分享暂不可用）。

GoJet 的业务后端仍然是 Go。PHP 不承担短链跳转、API、Analytics、邮件 Worker 或文件 Worker，只承担标准安装入口。

发行 ZIP 已包含 Linux amd64 的 8 个 GoJet 二进制文件，Native 部署不要求服务器安装 Go、Node 或 Docker。

## 2. 宝塔网站创建方式

在宝塔中创建 **PHP 项目/普通 PHP 网站**，不要使用“Go 项目”来托管整个 GoJet。

例如测试站：

```text
网站目录：/www/wwwroot/test.san6.cn
运行目录：/public
PHP：8.3
HTTPS：启用
```

GoJet 的发行目录结构包含标准 Web Root：

```text
GoJet/
├── public/                 # 宝塔运行目录
│   ├── index.html          # 公开站
│   ├── app/                # 用户控制台
│   ├── admin/              # 管理后台
│   └── install/            # PHP 安装向导
├── bin/                    # 8 个 Go 服务二进制
├── app/
├── database/
├── deploy/
├── installer/
├── scripts/
└── storage/
```

只有 `public/` 应作为网站根目录暴露到公网。

## 3. 先准备 MySQL、Redis 与 ClamAV

### MySQL

请先在宝塔中创建空数据库和普通数据库用户，例如：

```text
数据库地址：127.0.0.1
端口：3306
数据库：gojet
用户：gojet
密码：高强度随机密码
```

安装器 **不会要求 MySQL root 密码**，也不会自行创建数据库管理员账号。安装器使用所填普通数据库用户测试连接、检查 MySQL 8.x、创建表并执行迁移。

### Redis

默认：

```text
127.0.0.1:6379
```

Redis 设置了密码时在安装页填写；未设置密码时可留空。

### ClamAV

Debian/Ubuntu 推荐：

```bash
sudo apt update
sudo apt install -y clamav clamav-daemon
sudo systemctl restart clamav-daemon
sudo systemctl status clamav-daemon --no-pager
ls -l /run/clamav/clamd.ctl
```

Native 模式使用 Debian 默认 Unix Socket：

```text
unix:///run/clamav/clamd.ctl
```

不需要开放 `3310/tcp`。如果 ClamAV 没有安装或 daemon 未运行，GoJet 主系统仍可安装，但 File Worker 会保持运行并暂停病毒扫描，上传文件继续处于隔离状态，文件分享暂不可用。

## 4. 校验并解压发行包

将 ZIP 和 `.sha256` 上传到服务器后：

```bash
sha256sum -c gojet-4.0.0-rc.5-linux-production.zip.sha256
unzip gojet-4.0.0-rc.5-linux-production.zip
```

将解压后的 **目录内容** 放到宝塔网站目录，例如：

```text
/www/wwwroot/test.san6.cn
```

确认：

```bash
cd /www/wwwroot/test.san6.cn
ls public/install/index.php
ls bin/platform-api
ls bin/redirect-engine
```

## 5. 一次 Root 准备

进入 GoJet 根目录执行：

```bash
cd /www/wwwroot/test.san6.cn
sudo ./install.sh
```

这一步不会启动临时 HTTP 服务器，不生成浏览器 Token，也不会使用 `18088`。

Root 准备程序只负责：

1. 检查 Nginx、PHP 8.3、PDO MySQL、OpenSSL、MySQL Client、Redis CLI、systemd、curl 和 8 个 GoJet 二进制；
2. 创建受控的安装状态目录；
3. 安装 root-only 的 `gojet-installer.service` 与 `gojet-installer.path`；
4. 检测本机 ClamAV Unix Socket；
5. 输出宝塔网站目录、运行目录与 Web 安装地址。

PHP-FPM 不会获得 sudo/root 权限。Web 安装页只能写入白名单安装请求，特权操作由 root systemd Helper 执行。

## 6. 浏览器安装

先确认宝塔：

```text
网站目录 = GoJet 根目录
运行目录 = /public
PHP = 8.3
HTTPS = 已开启
```

然后访问：

```text
https://你的域名/install/
```

安装向导分为：

1. **环境检查**：PHP、扩展、64 位、8 个 GoJet 二进制、安装 Helper、ClamAV；
2. **MySQL / Redis**：MySQL 地址固定 `127.0.0.1`，填写端口、数据库名、普通用户名和密码；Redis 地址固定 `127.0.0.1`；
3. **站点 / 管理员**：HTTPS 根地址、管理员邮箱、管理员密码、告警邮箱；
4. **确认并安装**。

以下内部安全值由安装器通过 CSPRNG 自动生成，不要求人工填写：

- Settings Encryption Key；
- Visitor Hash Key；
- QR Tracking Key；
- Log Ingest/Webhook Token。

## 7. 后台安装阶段

点击“开始安装”后，root Helper 会：

1. 再次验证所有 Web 输入，拒绝未知字段与控制字符；
2. 使用普通 MySQL 用户连接 `127.0.0.1`；
3. 检查 MySQL 8.x 并执行数据库迁移；
4. 验证 Redis；
5. 自动生成内部安全密钥；
6. 检测 `/run/clamav/clamd.ctl`；
7. 创建受限的 `gojet` 系统用户和数据目录；
8. 注册 8 个 `gojet@*.service` systemd 服务；
9. 在不覆盖宝塔 SSL/PHP 主配置的前提下写入 GoJet rewrite 路由；
10. 执行 `nginx -t` 后 reload；
11. 启动并检查全部 8 个 GoJet 服务；
12. 检查 Redirect Engine、Platform API 和 Log Receiver 的真实 `/health`；
13. 写入 `deploy/native/installed.lock` 并锁定安装入口。

安装成功后 `/install/` 不再作为重新安装入口开放。

## 8. Native 运行结构

```text
Internet
   ↓
宝塔 Nginx / TLS
   ├── /              → public 静态站 / Redirect Engine
   ├── /app/          → 用户控制台
   ├── /admin/        → 管理后台
   ├── /api/          → Platform API 127.0.0.1:18090
   └── 短码请求       → Redirect Engine 127.0.0.1:18080

systemd
   ├── gojet@redirect-engine
   ├── gojet@platform-api
   ├── gojet@analytics-worker
   ├── gojet@analytics-reconciler
   ├── gojet@mail-worker
   ├── gojet@file-worker
   ├── gojet@operations-monitor
   └── gojet@log-receiver

ClamAV
   └── /run/clamav/clamd.ctl
```

内部服务端口只监听 `127.0.0.1`，不要加入公网安全组。

## 9. 安装后检查

```bash
sudo systemctl status 'gojet@*.service' --no-pager
sudo journalctl -u gojet@platform-api -u gojet@redirect-engine -n 200 --no-pager
curl -fsS http://127.0.0.1:18080/health
curl -fsS http://127.0.0.1:18090/health
curl -fsS http://127.0.0.1:18092/health
sudo /www/server/nginx/sbin/nginx -t
```

浏览器检查：

```text
https://你的域名/
https://你的域名/app/
https://你的域名/admin/
```

文件分享验收必须至少包含一次真实安全扫描。可以在测试环境使用 EICAR 标准测试文件确认恶意文件被 ClamAV 检出并保持隔离。

## 10. Docker 模式

Docker 部署仍然保留，但不与宝塔 Native 安装混用。需要 Docker 模式时显式执行：

```bash
sudo ./install.sh --docker
```

Docker 模式继续使用 Compose 管理 MySQL、Redis、ClamAV 和 GoJet 服务；Native `/install/` 流程不会修改 Docker 部署逻辑。

## 11. RC5 验收原则

RC5 只有在以下条件全部满足后才允许升级为 Final：

- GitHub Actions：PHP/Shell/Go tests/vet 全绿；
- 8 个 Linux 生产二进制全部可构建；
- Production ZIP 构建与内部 SHA-256 Manifest 校验通过；
- Debian 12 + 宝塔 + PHP 8.3 + MySQL 8.x + Redis + ClamAV **空目录真实安装通过**；
- `/`、`/app/`、`/admin/`、短链、API、Analytics、邮件、文件上传/ClamAV/下载均完成真机验收；
- 重启服务器后全部 systemd 服务可自动恢复；
- 安装失败可明确显示原因并允许安全重试。

在上述真机验收完成前，版本保持 RC，不标记为 GoJet V4.0.0 Final。
