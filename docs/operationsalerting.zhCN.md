# 运行告警闭环

`operationsmonitor` 每分钟读取真实 MySQL 队列与恢复记录，不使用演示数据。当前规则覆盖：邮件达到最大重试次数、Analytics 死信、持续 Worker 落后和文件扫描最终失败。

告警生命周期：

1. 指标越过阈值时创建或重新打开唯一告警；
2. 配置 `ALERT_RECIPIENT` 后，将告警写入现有 `mail_messages` 队列，只有 Mail Worker 实际成功投递后才会产生 Message-ID；
3. 管理员在“系统诊断”查看当前值、阈值、首次/最近出现时间和通知时间，并填写处理说明进行确认；
4. 指标恢复后 Monitor 自动将告警标记为“已恢复”；同一故障持续期间不会重复发送邮件；
5. 确认操作写入 `system_job_runs`，邮件失败仍由邮件中心保留错误与重试次数。

生产配置：

```env
ALERT_RECIPIENT=ops@example.com
OPERATIONS_MONITOR_INTERVAL_SECONDS=60
```

如果不配置收件人，告警仍会持久化并显示在后台，但不会伪装成已经发送通知。
