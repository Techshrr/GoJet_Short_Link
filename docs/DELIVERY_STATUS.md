# GoJet V4 Delivery Status

## 交付范围

V4 是对旧版的整套重构，不是补丁主题：

1. 公开网站页面级重写
2. 用户 SaaS 控制台重写
3. 独立管理后台
4. 正规设置中心
5. 非队列依赖的点击与分析闭环
6. 可诊断、可恢复邮件系统
7. 新设计体系与响应式规则
8. 真实数据验收标准

## 代码状态

- 仓库：`Techshrr/GoJet_Short_Link`
- 开发分支：`rebuild/v4-foundation`
- Laravel 控制面：已实现
- Go 跳转二进制：生产包已提供 Linux amd64 构建；对应源码未包含在收到的生产包中，待恢复后方可认定可复现
- 持久化点击 spool：已从公开的 Laravel 内部接口、Redis 缓存键和部署契约独立重建；待 CI 完成 Go race/vet/build 验证
- 同步统计与对账：已实现
- 邮件日志与重试：已实现
- 工作区邀请生命周期：已实现
- 公开站、控制台、后台和设置 UI：已完成第一轮重写，仍按任务基线逐页补齐
- Docker 与传统部署模板：已更新
- 源码包和生产安装包：由 `scripts/package-release.sh` 生成；发布前必须确保测试、CI 与 Go 源码均进入可验收交付物

## 完成规则

以下三类证据必须分开：

- **本地可验证**：语法、路由、Blade、Go 测试/race/vet/build、静态资源和发布包完整性。
- **GitHub CI**：完整 PHP 数据库测试、Pint、Node 锁定依赖构建和 Go 门禁。
- **生产环境人工验收**：真实 SMTP、DNS、Cloudflare、浏览器、系统服务、备份和恢复。

任何尚未在对应环境执行的项目不得写成“已通过”。详细结果记录在 [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md)。
