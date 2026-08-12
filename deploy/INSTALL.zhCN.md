# GoJet 全新安装指南

> 当前生产发行包仅支持**全新安装**。不要覆盖现有站点目录，也不要把已有业务数据库直接作为新安装目标。

## 1. 安装原则

建议同时使用：

- 全新的站点目录；
- 全新的 MySQL 8 数据库；
- 全新的数据库普通用户；
- aaPanel / 宝塔新建网站；
- Web 运行目录固定为 `/public`。

现有环境可以独立保留用于数据备份和对照，但新安装程序不得连接其生产数据库。

## 2. 主要环境

原生 aaPanel / 宝塔安装优先支持：

- Debian 12 / Ubuntu；
- aaPanel / 宝塔；
- Nginx；
- PHP 8.3 CLI + PHP-FPM；
- `pdo_mysql`；
- OpenSSL；
- MySQL 8.x；
- Redis；
- systemd。

PHP 只负责标准 Web 安装器，GoJet 业务后端由独立 Go 服务运行。

## 3. ClamAV

文件分享支持 ClamAV 扫描。原生安装推荐使用：

```text
unix:///run/clamav/clamd.ctl
```

如果安装时没有检测到 ClamAV，主系统安装可以继续，但文件安全功能会显示警告；未完成安全扫描的文件不得被当作安全文件公开下载。

## 4. 在 aaPanel / 宝塔创建网站

示例域名：

```text
gojet.example.com
```

站点目录：

```text
/www/wwwroot/gojet.example.com
```

运行目录：

```text
/public
```

因此公开 Web Root 为：

```text
/www/wwwroot/gojet.example.com/public
```

PHP 选择 **8.3**，并为网站配置 HTTPS/SSL。

## 5. 创建全新数据库

在数据库管理页面创建一个普通 MySQL 数据库和普通数据库用户，例如：

```text
数据库：gojet
用户：gojet
主机：127.0.0.1
```

数据库密码使用高强度随机值。Web 安装器不会要求 MySQL root 密码，也不会要求管理员级数据库账号。

## 6. 上传生产发行包

先校验发行包：

```sh
sha256sum -c gojet-<版本>-linux-production.zip.sha256
unzip -tq gojet-<版本>-linux-production.zip
```

解压后，把发行包顶层目录中的内容直接放到站点目录。正确结构示例：

```text
/www/wwwroot/gojet.example.com/install.sh
/www/wwwroot/gojet.example.com/bin/
/www/wwwroot/gojet.example.com/database/
/www/wwwroot/gojet.example.com/deploy/
/www/wwwroot/gojet.example.com/public/
/www/wwwroot/gojet.example.com/scripts/
```

不要再额外套一层版本目录，否则 aaPanel / 宝塔设置的 `/public` 运行目录会指向错误位置。

## 7. 准备标准 Web 安装器

SSH 执行：

```sh
cd /www/wwwroot/gojet.example.com
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

该步骤不要求临时 Token，也不会开放额外的公网安装端口。

## 8. 浏览器完成安装

访问：

```text
https://gojet.example.com/install/
```

安装流程包括：

1. 环境检查；
2. MySQL / Redis 配置；
3. 站点与首个超级管理员；
4. 最终安装与健康检查。

MySQL Host 使用：

```text
127.0.0.1
```

填写普通数据库的数据库名、用户名和密码。内部设置加密密钥、访客哈希密钥、二维码密钥和日志令牌由安装器自动生成。

## 9. 安装器执行的生产动作

最终安装会：

- 对全新数据库依次执行 `database/migrations/*.sql`；
- 创建首个超级管理员；
- 生成 root-only 环境文件；
- 创建受限的 `gojet` 系统用户；
- 配置 aaPanel / 宝塔 Nginx rewrite；
- 注册并启动 8 个 systemd 服务；
- 检查服务状态；
- 检查 Redirect Engine、Platform API、Log Receiver 的 HTTP health；
- 写入安装锁；
- 关闭 Web 安装入口。

首个超级管理员拥有完整管理员权限。

## 10. 生产目录与公开地址

生产 Web Root 固定为 `public/`：

```text
public/                  官网与公开页面
public/app/              客户中心
public/admin/            管理后台
public/assets/images/    品牌图片
public/generated/qr/     生成的二维码图片
```

主要地址：

```text
https://gojet.example.com/
https://gojet.example.com/login
https://gojet.example.com/register
https://gojet.example.com/forgotpassword
https://gojet.example.com/app/dashboard
https://gojet.example.com/admin/
```

未登录访问客户中心会跳转到 `/login`。登录后官网导航应切换为已登录状态，不再显示访客态的“登录 / 免费开始”。

## 11. 管理员登录安全

管理员可以启用 TOTP 双因素认证。TOTP 用于管理员登录；登录后具体操作能力由管理员角色和显式权限控制，不对普通保存操作重复要求验证码。

超级管理员始终拥有完整权限。

## 12. 品牌与运行时资源

后台上传的 Logo 等品牌图片统一发布到：

```text
/assets/images/...
```

系统生成的二维码统一发布到：

```text
/generated/qr/...
```

这两个命名空间必须同时满足：API 写入目录、持久化挂载目录和 Nginx 公开目录一致。安装完成后应实际上传 Logo、创建二维码并从公开 URL 验证能够读取。

## 13. 全新安装验收

用户侧至少验证：

```text
首页 → 注册 → 邮箱验证 → 登录 → 客户中心
→ 创建短链 → 访问短链 → 分析数据
→ 创建二维码 → 显示/下载二维码
→ 文本分享 → 文件分享 → 找回密码 → 重置密码
→ 创建工单 → 查看支持回复
```

管理员侧至少验证：

```text
登录 → 创建/编辑/封禁用户 → 管理管理员权限
→ 系统设置保存与读回 → 品牌资源上传
→ SMTP → 测试邮件 → 邮件模板
→ 公告 → 链接管理 → 文件安全 → 域名管理
→ 套餐账单 → Turnstile 场景开关 → 工单队列
→ 平台对账 → 清缓存 → 维护模式 → 审计日志
```

并验证：

- 账单浏览器下载；
- 中文/英文账单 PDF 真渲染；
- PDF 中真实嵌入品牌 Logo；
- 邮件中品牌 Logo、按钮、正文与页脚完整；
- ClamAV EICAR 测试能够隔离风险文件；
- 8 个服务重启后恢复；
- 服务器重启后 systemd 自动恢复。

原生安装可检查：

```sh
systemctl status 'gojet@*.service' --no-pager -l
```

## 14. 版本切换原则

生产发行包包含 `FRESH_INSTALL_ONLY=1`，不提供原地升级、数据库覆盖或自动回滚入口。需要测试或上线新版本时，应建立新的站点目录和新的数据库完成完整验收，再安排数据迁移或流量切换。