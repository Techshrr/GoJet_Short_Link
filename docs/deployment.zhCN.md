# GoJet 生产部署

GoJet 正式交付使用 `gojet-<版本>-linux-production.zip`。生产服务器只应使用经过发布门禁校验的发行包，不使用 Git 工作区、源码目录或开发环境配置。

发行包根目录包含 `INSTALL.md`、8 个生产二进制、数据库迁移、已构建的 `public/` Web 目录、部署配置、安装脚本、运行文档和完整性清单。

## 发行包校验

收到发行包后，先校验同目录 SHA-256 文件：

```sh
sha256sum -c gojet-<版本>-linux-production.zip.sha256
unzip -tq gojet-<版本>-linux-production.zip
```

解压后可以再次执行包内校验器：

```sh
./scripts/verifyrelease.sh ../gojet-<版本>-linux-production.zip
```

发行包内部的 `MANIFEST.sha256` 用于验证所有已发布文件。生产包不包含应用源码树、测试目录、CI 配置、开发依赖或开发 Compose。

## 全新安装原则

当前生产包标记为 `FRESH_INSTALL_ONLY=1`，只用于全新安装：

- 使用新的站点目录；
- 使用新的 MySQL 8 数据库和普通数据库用户；
- 不覆盖现有 GoJet 安装目录；
- 不把现有业务数据库直接作为新安装目标；
- 安装前保留旧环境独立备份，直到新环境验收完成。

发行包不提供原地升级或回滚脚本。需要部署新版时，应建立独立目录和数据库完成全新安装与验收，再进行流量切换。

## aaPanel / 宝塔安装

站点目录示例：

```text
/www/wwwroot/gojet.example.com
```

Web 运行目录设置为：

```text
/public
```

解压发行包后，应保证 `install.sh`、`bin/`、`database/`、`deploy/`、`public/` 和 `scripts/` 直接位于站点根目录。

准备环境后执行：

```sh
cd /www/wwwroot/gojet.example.com
sudo ./install.sh
```

随后访问：

```text
https://gojet.example.com/install/
```

Web 安装器使用普通 MySQL 数据库账号完成环境检查、数据库迁移、首个超级管理员创建、运行密钥生成和服务注册。安装完成后会写入安装锁并关闭安装入口。

完整 aaPanel / 宝塔流程以发行包根目录的 `INSTALL.md` 为准。

## 主机 Nginx 模式

如果服务器已经由 aaPanel / 宝塔管理 Nginx，应使用主机 Nginx 安装方式，不要直接复制容器版 Nginx 配置：

```sh
sudo ./installhostnginx.sh
```

安装器会使用当前绝对安装路径生成配置，在 reload 前执行 `nginx -t`。Platform API 和 Redirect Engine 只绑定回环地址，由系统 Nginx 对外提供统一入口。

## 原生 Linux 安装

需要原生 LEMP / systemd 部署时使用：

```sh
sudo ./installnativelemp.sh
```

安装流程会校验运行环境、创建受限系统用户、写入 root-only 环境文件、执行全新数据库迁移、注册服务并完成健康检查。

## 生产 Web 目录

生产 Web Root 固定为 `public/`：

```text
public/                  官网与公开页面
public/app/              客户中心
public/admin/            管理后台
public/assets/images/    后台管理的品牌图片
public/generated/qr/     系统生成的二维码图片
```

品牌图片和二维码属于运行时持久数据。API 写入路径、部署挂载和 Nginx 公开路径必须保持同一契约，不能各自使用不同目录。

## 生产服务

发行包包含并运行以下 8 个 GoJet 服务：

```text
redirectengine
analyticsworker
analyticsreconciler
platformapi
mailworker
fileworker
operationsmonitor
logreceiver
```

Docker 模式还会使用 MySQL、Redis、ClamAV 和 Nginx。原生模式由 systemd 管理 8 个 GoJet 服务。

## 安装后验收

至少检查：

- 官网、登录、注册、找回密码；
- 客户中心和管理后台登录态；
- 创建并访问短链接；
- 二维码生成、显示和下载；
- 文本分享和文件分享；
- 访问分析；
- 品牌 Logo 上传后官网、客户中心、后台、邮件和账单的读取链路；
- SMTP 测试邮件和事务邮件；
- 账单下载与 PDF；
- 工单创建、回复和后台处理；
- Turnstile 全局及各场景开关；
- ClamAV 文件扫描；
- 8 个服务重启后恢复。

原生部署可检查：

```sh
systemctl status 'gojet@*.service' --no-pager -l
```

Docker 部署应检查生产 Compose 中全部服务健康状态。

## 数据安全

生产环境文件、数据库密码、SMTP 密钥、Turnstile Secret、支付密钥和其他敏感信息不得进入公开目录或发行包。任何环境变更前先备份数据库和持久化目录，不要使用会删除数据卷的清理命令。