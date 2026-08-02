# 邮件中心

邮件设置由 Platform API 管理，SMTP 密码使用 AES-256-GCM 加密后保存。管理员请求必须携带
`Authorization: Bearer <ADMIN_API_TOKEN>`，API 永远只返回密码掩码。

## 配置与测试

1. `PUT /api/admin/settings/mail` 保存 SMTP Host、端口、用户名、可选新密码、TLS 模式、EHLO、
   发件邮箱、发件人和回复邮箱。
2. `POST /api/admin/mail/test` 使用 `{"recipient":"admin@example.com"}` 执行连接、TLS、认证和
   实际投递测试。
3. 只有实际测试邮件成功后 `mail_health` 才为 `connected`，验证邮件才能进入队列。

SMTP 密码不会在 API 中回显；留空密码表示保留已有密文。认证信息禁止通过明文 SMTP 发送。

## 队列、日志和恢复

`POST /api/mail/verification` 只把验证邮件加入 MySQL 队列。独立 `mail-worker` 锁定一封可用邮件、
递增尝试次数并发送；成功保存 Message-ID，失败保存脱敏后的传输异常并指数式延迟重试，最多五次。
管理员通过 `GET /api/admin/mail/logs` 查看最近 100 条记录，并通过
`POST /api/admin/mail/{id}/retry` 重新发送失败邮件。

SMTP 未配置或健康检查失败时，用户只收到“验证邮件暂时无法发送，请稍后重试或联系管理员。”，
详细的认证、连接超时或 TLS 协商异常仅出现在管理员日志中。
