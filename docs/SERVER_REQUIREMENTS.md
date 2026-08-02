# Server Requirements

## 支持环境

- Ubuntu Server 24.04 LTS
- Debian 12+
- 使用等价 Linux、Nginx 和 PHP-FPM 的宝塔 / aaPanel

## 资源

最低：2 vCPU、4 GB RAM、40 GB SSD。建议起步：4 vCPU、8 GB RAM、80 GB SSD。高访问量环境应使用独立 MySQL、Redis 与监控。

## Runtime

- PHP 8.3–8.5
- Nginx 1.24+
- MySQL 8.0+
- Redis 7+
- Supervisor
- systemd

传统生产包包含 Linux amd64 静态 Go 跳转二进制、Composer 生产依赖和前端构建产物。只有从源码重新构建时才需要 Composer 2.7+、Node.js 22+、npm 10+ 和 Go 1.23+。

## PHP 扩展

`bcmath`, `ctype`, `curl`, `dom`, `fileinfo`, `filter`, `gd`, `hash`, `intl`, `mbstring`, `openssl`, `pcntl`, `pdo`, `pdo_mysql`, `redis`, `tokenizer`, `xml`, `zip`。

## 存储与权限

PHP-FPM 用户必须可写：

- `storage/`
- `bootstrap/cache/`
- `/var/lib/gojet/spool`

`.env` 建议为 `root:www-data`、权限 `640`。`bin/gojet-redirector` 建议为 `root:www-data`、权限 `750`。

## 网络

- 公网只开放 80/443。
- Go redirector 的 8081 端口仅监听本机或容器网络。
- MySQL 和 Redis 只监听回环或私网。
- 生产环境必须启用 HTTPS。
- Cloudflare 环境使用 Full (strict)，并正确传递真实 IP 和地域请求头。
