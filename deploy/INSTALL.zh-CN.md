# GoJet V4 全新安装指南

> 本版本是产品级重构版本，**只支持全新安装**。不要把 RC1–RC7 的站点目录或数据库作为升级目标。

## 1. 安装原则

建议同时使用：

- 全新的站点目录；
- 全新的 MySQL 8 数据库；
- 全新的数据库普通用户；
- aaPanel / 宝塔新建 PHP 网站；
- 运行目录固定为 `/public`。

旧 RC 站点可以暂时保留用于对照，但不要把新包覆盖到旧目录，也不要让新安装程序连接旧 RC 数据库。

## 2. 主要环境

原生 aaPanel 安装路径优先支持：

- Debian 12 / Ubuntu；
- aaPanel / 宝塔；
- Nginx；
- PHP 8.3 CLI + PHP-FPM；
- `pdo_mysql`；
- OpenSSL；
- MySQL 8.x；
- Redis；
- systemd。

PHP 只负责标准 Web 安装器。GoJet 的业务后端仍由 Go 服务运行。

## 3. ClamAV

文件分享支持 ClamAV 扫描。

原生安装推荐：

```text
unix:///run/clamav/clamd.ctl
```

如果安装时没有检测到 ClamAV，主系统安装仍可继续，但文件分享的安全扫描能力会显示警告；未完成安全扫描的文件不能被当作已安全文件处理。

## 4. 在宝塔创建网站

示例域名：

```text
test.example.com
```

站点目录：

```text
/www/wwwroot/test.example.com
```

运行目录：

```text
/public
```

因此公开 Web Root 实际为：

```text
/www/wwwroot/test.example.com/public
```

PHP 选择 **8.3**，并为网站启用 HTTPS/SSL。

## 5. 创建全新数据库

在宝塔数据库页面创建一个**普通 MySQL 数据库和普通数据库用户**。

例如：

```text
数据库：gojet
用户：gojet
主机：127.0.0.1
```

密码使用高强度随机密码。

Web 安装器不会要求 MySQL root 密码，也不会要求管理员数据库账号。

## 6. 上传生产安装包

将生产 ZIP 解压后，把 ZIP 顶层目录里的内容直接放到站点目录。

正确结构示例：

```text
/www/wwwroot/test.example.com/install.sh
/www/wwwroot/test.example.com/bin/
/www/wwwroot/test.example.com/database/
/www/wwwroot/test.example.com/deploy/
/www/wwwroot/test.example.com/public/
/www/wwwroot/test.example.com/scripts/
```

不要形成：

```text
/www/wwwroot/test.example.com/gojet-版本号-linux-production/install.sh
```

## 7. 准备标准 Web 安装器

SSH 执行：

```bash
cd /www/wwwroot/test.example.com
sudo ./install.sh
```

脚本会：

- 检查 PHP 8.3 CLI；
- 检查 `pdo_mysql` / OpenSSL；
- 检查 Nginx、MySQL、Redis；
- 检查 8 个 GoJet 生产二进制；
- 创建受控的 root 安装辅助服务；
- 检查 ClamAV；
- 准备 `/install/` Web 安装入口。

该步骤不会要求临时 token，也不会开放 18088 端口。

## 8. 浏览器完成安装

访问：

```text
https://test.example.com/install/
```

安装流程包括：

1. 环境检查；
2. MySQL / Redis；
3. 站点与超级管理员；
4. 最终安装。

MySQL Host 固定使用：

```text
127.0.0.1
```

填写普通数据库：

- 数据库名；
- 数据库用户名；
- 数据库密码。

内部密钥由安装器自动生成，包括设置加密密钥、访客哈希密钥、二维码密钥和日志令牌。

## 9. 安装器执行的生产动作

最终安装会：

- 对全新数据库依次执行 `database/migrations/*.sql`；
- 创建首个超级管理员；
- 生成 root-only 环境文件；
- 创建 `gojet` 系统用户；
- 配置 aaPanel Nginx rewrite；
- 注册并启动 8 个 systemd 服务；
- 检查服务状态；
- 检查 redirect-engine、platform-api、log-receiver HTTP health；
- 写入安装锁；
- 关闭 Web 安装入口。

首个超级管理员默认拥有**全部管理员权限**。

## 10. 安装成功后的主要地址

公开首页：

```text
https://test.example.com/
```

用户认证：

```text
/login
/register
/forgot-password
/reset-password
/verify-email
```

用户控制台：

```text
/app/dashboard
/app/links
/app/text
/app/files
/app/bio
/app/domains
/app/analytics
/app/settings
```

管理员后台：

```text
/admin/
```

`/app` 不再承担登录页面职责。未登录访问用户控制台会跳转 `/login`。

## 11. 管理员登录安全

管理员可以选择启用 TOTP 双因素认证。

TOTP **只用于管理员登录**。

登录成功后，是否允许执行用户管理、邮件、设置、公告、运维、账务等操作由管理员权限决定，不再对每次后台保存重复要求二次验证码。

超级管理员始终拥有完整权限。

## 12. 全新安装验收

发布候选版本必须至少验证：

```text
首页 → 注册 → 邮箱验证 → 登录 → /app/dashboard
→ 创建短链 → 访问短链 → 分析数据
→ 文本分享 → 文件分享 → 找回密码 → 重置密码
```

管理员至少验证：

```text
登录 → 创建用户 → 编辑用户 → 封禁/解封
→ 管理管理员权限 → SMTP → 测试邮件 → 邮件模板
→ Markdown 公告 → 链接管理 → 文件安全 → 域名管理
→ 套餐账单 → 平台对账 → 清缓存 → 维护模式 → 审计日志
```

并验证：

```bash
systemctl status 'gojet@*.service' --no-pager -l
```

以及重启服务器后的 systemd 自动恢复。

## 13. 旧 RC 说明

本产品重构版本不提供 RC1–RC7 原地升级保证。

生产包不会提供 `upgrade.sh`、`upgrade-native.sh` 或 `rollback.sh` 作为迁移入口。需要测试新版时，请建立全新站点目录和数据库进行安装。
