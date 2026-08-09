# 基础设施真实集成验收

GoJet 不把只使用内存仓库或 SQL mock 的测试计为生产依赖验收。仓库提供以下可重复执行的真实协议测试：

| 命令 | 真实依赖 | 验收内容 |
| --- | --- | --- |
| `tests/integration/redis-analytics.sh` | `redis-server` | Stream Pending 自动认领、死信重投、并发安全计数与只增不减对账 |
| `tests/integration/mysql-platform.sh` | MariaDB/MySQL 兼容服务 | 从空数据库依次执行全部迁移，核对关键表，并在事务中创建用户、工作区、成员和短链接 |
| `tests/integration/smtp-protocol.sh` | 真实 TCP SMTP 会话 | EHLO、NOOP、MAIL、RCPT、DATA、QUIT，以及 Message-ID、标题和正文的实际投递内容 |
| `tests/integration/clamav-eicar.sh` | `clamd` 与最新病毒库 | 使用 INSTREAM 扫描，确认 EICAR 被识别为 `FOUND`，普通文件返回 `OK` |

执行全部基础设施验收：

```bash
make test-integration
```

## 环境说明

- MySQL 脚本启动隔离的临时实例、创建临时数据库并在结束时删除数据目录，不连接开发或生产数据库。
- SMTP 测试启动可控但使用真实 TCP/SMTP 状态机的收件服务，不会向互联网发送邮件。
- ClamAV 测试需要先执行 `freshclam`；EICAR 是行业标准的无害反恶意软件测试字符串。
- 所有脚本使用临时目录和退出清理器，测试失败也会停止子进程。
- 生产部署仍必须用组织自己的域名、SMTP 凭据、对象存储和 Secret 完成上线前验收。
