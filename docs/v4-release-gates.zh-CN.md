# GoJet V4 发布门槛

本文件定义 `rebuild/v4-product` 进入候选安装包和最终 V4.0.0 前必须满足的验收条件。

## G0：安装模型

- 只支持全新安装。
- 使用全新站点目录。
- 使用全新 MySQL 8 数据库。
- 生产包不包含 `upgrade.sh`、`upgrade-native.sh`、`rollback.sh`。
- 不声明兼容 RC1–RC7 数据库或站点目录原地升级。

## G1：代码与构建

GitHub Actions `V4 product rebuild validation` 必须全部通过：

- PHP installer syntax；
- Shell syntax；
- 管理员、用户、公开站点 JavaScript syntax；
- 权限模型静态回归；
- 不存在 operation-level step-up；
- `go test ./...`；
- `go vet ./...`；
- 8 个生产 Go 服务全部成功编译。

任何一项失败都不得生成候选安装包。

## G2：浏览器产品验收

GitHub Actions `V4 product browser acceptance` 必须通过，至少验证：

- `/login` 是独立登录页；
- `/register` 是独立注册页；
- `/forgot-password` 与 `/reset-password` 存在；
- 未登录访问 `/app/*` 会去 `/login`；
- 首页核心短链输入是真实产品入口；
- 管理员用户页存在创建、编辑、封禁、密码重置、会话和删除操作；
- 管理员权限页存在明确权限矩阵；
- 公告使用 Markdown 编辑与预览；
- 平台对账、清缓存、维护模式不要求填写无意义的执行原因；
- 邮件模板普通保存不出现操作级二次验证。

## G3：真实 MySQL / Redis API 验收

GitHub Actions `V4 product full-stack acceptance` 必须使用真实 MySQL 8 和 Redis，执行全套数据库迁移，并启动真实 `platform-api`。

至少验证：

1. 超级管理员可以登录；
2. 超级管理员无需操作级二次验证即可保存普通后台配置；
3. 管理员可以创建用户；
4. 管理员可以封禁和解封用户；
5. 封禁后旧用户会话立即失效；
6. 用户可以修改资料；
7. 用户修改密码后全部旧会话失效；
8. 用户可以退出登录；
9. 自定义管理员权限会被后端真正隔离；
10. 用户可以公开注册；
11. 找回密码请求会真实进入邮件队列；
12. Markdown 公告可以创建、发布并从公开 API 读取；
13. 清缓存和维护模式可以直接执行；
14. 用户删除采用安全匿名化并失效会话；
15. 管理员操作存在真实审计记录。

## G4：生产包验收

只有 G1–G3 全绿后才允许构建新的候选生产包。

生产包必须通过 `scripts/verify-release.sh`，并确认：

- `FRESH_INSTALL_ONLY=1`；
- 独立登录/注册/找回密码页面存在；
- 用户控制台和管理员后台新代码存在；
- 8 个生产二进制存在并可执行；
- 新权限 schema 存在；
- 旧 RC7 step-up migration 不存在；
- 旧 `admin-settings-fix.js` 不存在；
- upgrade/rollback 入口不存在；
- Nginx `/uploads/` 不使用错误的 `alias + try_files $uri`；
- SHA-256 / ZIP CRC / MANIFEST 全部通过。

## G5：真实 aaPanel 全新安装

候选包必须在真实 Debian 12 + aaPanel 环境进行一次从零安装：

```text
新网站目录
+ 新 MySQL 8 数据库
+ PHP 8.3
+ Nginx
+ Redis
+ systemd
+ ClamAV Unix Socket
```

安装后必须人工验证：

- 8 个服务全部 active；
- `/health` 正常；
- `/login`、`/register`、`/forgot-password` 正常；
- 管理员登录和权限正常；
- SMTP 保存/回显/测试发送正常；
- Logo 上传和回显正常；
- 创建用户、封禁、解封、删除正常；
- 创建短链并真实跳转；
- Analytics 出现真实访问；
- Markdown 公告发布正常；
- 文件上传并经过真实 ClamAV 扫描；
- 清缓存和维护模式正常；
- 重启服务器后 systemd 自动恢复。

## G6：最终版

只有在至少一次真实 aaPanel 全新安装完整通过，并修复测试中发现的问题后，才允许将版本标记为 `V4.0.0 Final`。

自动化测试通过只代表候选版本具备进入真实主机验收的资格，不代表最终生产验证已经完成。
