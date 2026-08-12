-- Built-in templates own content only. The mail service owns the single
-- GoJet brand/document shell so templates cannot drift into separate cards,
-- widths, backgrounds or nested HTML documents.
--
-- Keep every placeholder aligned with the durable variable contract emitted
-- by account_lifecycle.go, lifecycle.go, security_workspace_lifecycle.go and
-- support_tickets.go. renderTemplate intentionally fails closed when any
-- placeholder is left unresolved.
INSERT INTO mail_templates(template_key,name,subject_template,html_template,status) VALUES
('verification','邮箱验证','验证你的 {{site_name}} 邮箱','<h1>验证邮箱</h1><p>你好，{{display_name}}。</p><p>请完成邮箱验证后继续使用 {{site_name}}。</p><p><a class="button" href="{{verification_url}}">验证邮箱</a></p><p class="muted">验证链接：{{verification_url}}</p>','active'),
('account_welcome','账户欢迎','欢迎使用 {{site_name}}','<h1>账户已准备好</h1><p>你好，{{display_name}}。</p><p>你的 {{site_name}} 账户已经创建完成，可以开始管理链接、二维码和其他资源。</p><p><a class="button" href="{{console_url}}">进入工作区</a></p>','active'),
('password_reset','重置密码','重置你的 {{site_name}} 登录密码','<h1>重置密码</h1><p>我们收到了你的密码重置请求。</p><p><a class="button" href="{{reset_url}}">设置新密码</a></p><p class="muted">链接将在 {{expires_minutes}} 分钟后失效。如果这不是你的操作，可以忽略本邮件。</p>','active'),
('password_changed','密码已修改','你的 {{site_name}} 密码已修改','<h1>密码已修改</h1><p>你的账户密码已于 {{changed_at}} 完成修改。</p><p class="muted">如果这不是你的操作，请立即联系支持团队。</p>','active'),
('email_changed','邮箱已修改','你的 {{site_name}} 登录邮箱已修改','<h1>登录邮箱已修改</h1><p>账户登录邮箱已从 {{old_email}} 修改为 {{new_email}}。</p><p class="muted">操作时间：{{changed_at}}</p>','active'),
('workspace_invitation','工作区邀请','{{inviter}} 邀请你加入 {{workspace_name}}','<h1>工作区邀请</h1><p>{{inviter}} 邀请你以“{{role_name}}”身份加入工作区“{{workspace_name}}”。</p><p><a class="button" href="{{invitation_url}}">查看邀请</a></p><p class="muted">邀请有效期至 {{expires_at}}。</p>','active'),
('workspace_role_changed','工作区角色变更','你在 {{workspace_name}} 的角色已更新','<h1>工作区权限已更新</h1><p>你在“{{workspace_name}}”中的角色已调整为“{{new_role}}”。</p><p class="muted">操作人：{{actor}}</p>','active'),
('workspace_owner_transferred','工作区所有者变更','{{workspace_name}} 的所有者已变更','<h1>工作区所有者已变更</h1><p>“{{workspace_name}}”的所有权已由 {{old_owner}} 转移给 {{new_owner}}。</p><p class="muted">操作时间：{{changed_at}}</p>','active'),
('workspace_member_removed','已退出工作区','你已离开 {{workspace_name}}','<h1>工作区成员状态已更新</h1><p>你已不再是工作区“{{workspace_name}}”的成员，之后将无法继续访问该工作区资源。</p>','active'),
('invoice_created','新账单','账单 {{invoice_number}} 已生成','<h1>新账单已生成</h1><p>工作区：{{workspace_name}}</p><p>套餐：{{plan_name}} · 周期 {{period_days}} 天</p><p>应付金额：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p><p>{{fx_detail}}</p><p>请在 {{due_at}} 前完成支付。</p><p><a class="button" href="{{billing_url}}">查看并支付账单</a></p>','active'),
('invoice_due_soon','账单即将到期','账单 {{invoice_number}} 即将到期','<h1>账单即将到期</h1><p>账单 {{invoice_number}} 将于 {{due_at}} 到期。</p><p>待支付：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p><p><a class="button" href="{{billing_url}}">查看账单</a></p>','active'),
('invoice_overdue','账单已逾期','账单 {{invoice_number}} 已逾期','<h1>账单已逾期</h1><p>账单 {{invoice_number}} 已超过付款期限。</p><p>待支付：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p><p><a class="button" href="{{billing_url}}">处理账单</a></p>','active'),
('invoice_paid','账单已支付','账单 {{invoice_number}} 已支付','<h1>付款已确认</h1><p>账单 {{invoice_number}} 已完成支付。</p><p>实付：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p><p>支付方式：{{payment_provider}}</p><p>支付参考号：{{payment_reference}}</p><p>服务周期：{{period_start}} 至 {{period_end}}</p><p><a class="button" href="{{invoice_pdf_url}}">下载账单 PDF</a></p>','active'),
('invoice_voided','账单已作废','账单 {{invoice_number}} 已作废','<h1>账单已作废</h1><p>账单 {{invoice_number}} 已作废，无需继续付款。</p><p>处理说明：{{note}}</p>','active'),
('payment_started','付款已创建','账单 {{invoice_number}} 的付款已创建','<h1>付款已创建</h1><p>账单：{{invoice_number}}</p><p>支付方式：{{payment_provider}}</p><p>应付金额：{{settlement_amount}} {{settlement_currency}}</p><p class="muted">商户订单号：{{merchant_order}}</p>','active'),
('payment_failed','付款失败','账单 {{invoice_number}} 付款失败','<h1>付款未完成</h1><p>账单 {{invoice_number}} 的 {{payment_provider}} 付款没有成功完成。</p><p>金额：{{settlement_amount}} {{settlement_currency}}</p><p>原因：{{failure_reason}}</p><p><a class="button" href="{{billing_url}}">返回账单中心</a></p>','active'),
('payment_refunded','付款已退款','账单 {{invoice_number}} 的付款已退款','<h1>退款已处理</h1><p>账单：{{invoice_number}}</p><p>退款金额：{{settlement_amount}} {{settlement_currency}}</p><p>支付方式：{{payment_provider}}</p><p>参考号：{{payment_reference}}</p>','active'),
('subscription_changed','订阅已变更','{{workspace_name}} 的套餐已变更','<h1>套餐变更完成</h1><p>工作区“{{workspace_name}}”当前套餐为 {{plan_name}}。</p><p>服务周期：{{period_start}} 至 {{period_end}}</p>','active'),
('subscription_renewed','订阅已续期','{{workspace_name}} 已续费成功','<h1>续费成功</h1><p>工作区“{{workspace_name}}”的 {{plan_name}} 套餐已续费。</p><p>新的服务周期截止至 {{period_end}}。</p>','active'),
('subscription_cancellation_scheduled','已安排取消订阅','{{workspace_name}} 将在周期结束后停止续费','<h1>已安排周期结束后停止续费</h1><p>工作区“{{workspace_name}}”将在 {{period_end}} 当前周期结束后停止套餐服务。</p><p class="muted">在周期结束前仍可恢复续费。</p>','active'),
('subscription_cancellation_revoked','已撤销取消订阅','{{workspace_name}} 已恢复续费','<h1>已恢复续费</h1><p>工作区“{{workspace_name}}”已撤销周期结束停止计划，当前套餐将继续保持。</p>','active'),
('subscription_expiring','订阅即将结束','{{workspace_name}} 的服务周期即将结束','<h1>服务周期即将结束</h1><p>工作区“{{workspace_name}}”当前服务周期将在 {{period_end}} 结束。</p><p><a class="button" href="{{billing_url}}">查看套餐与账单</a></p>','active'),
('subscription_cancelled','订阅已结束','{{workspace_name}} 的套餐服务已结束','<h1>订阅已结束</h1><p>工作区“{{workspace_name}}”的当前付费服务周期已经结束。</p><p><a class="button" href="{{billing_url}}">查看套餐</a></p>','active'),
('file_quarantined','文件安全提醒','文件 {{file_name}} 已被隔离','<h1>文件未通过安全检查</h1><p>工作区：{{workspace_name}}</p><p>文件：<strong>{{file_name}}</strong></p><p>安全检查发现该文件存在风险，因此不会开放下载。</p>','active'),
('domain_verification_failed','域名验证失败','域名 {{domain_name}} 验证未通过','<h1>域名验证未通过</h1><p>域名 <strong>{{domain_name}}</strong> 当前未能完成验证。</p><p>原因：{{reason}}</p><p><a class="button" href="{{domains_url}}">查看域名设置</a></p>','active'),
('support_ticket_created','工单已创建','[{{site_name}} #{{ticket_number}}] 我们已收到你的工单','<h1>工单已创建</h1><p>你的工单 <strong>#{{ticket_number}}</strong> 已提交成功。</p><p>主题：{{subject}}</p><p>支持团队回复后会通过邮件通知你。</p>','active'),
('support_ticket_reply','工单有新回复','[{{site_name}} #{{ticket_number}}] 工单有新回复','<h1>工单有新回复</h1><p>你的工单 <strong>#{{ticket_number}}</strong> 收到新的支持回复。</p><p>主题：{{subject}}</p><p>请登录 {{site_name}} 客户中心查看完整会话并继续回复。</p>','active')
ON DUPLICATE KEY UPDATE
name=VALUES(name),subject_template=VALUES(subject_template),html_template=VALUES(html_template),status=VALUES(status);