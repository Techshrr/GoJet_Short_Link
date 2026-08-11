-- RC12: all built-in templates own content only. The mail service owns the
-- single GoJet brand/document shell so templates cannot drift into separate
-- cards, widths, backgrounds or nested HTML documents.
INSERT INTO mail_templates(template_key,name,subject_template,html_template,status) VALUES
('verification','邮箱验证','验证你的 {{site_name}} 邮箱','<h1>验证你的邮箱</h1><p>欢迎使用 {{site_name}}。请点击下面的按钮完成邮箱验证。</p><p><a class="button" href="{{verification_url}}">验证邮箱</a></p><p class="muted">如果按钮无法打开，请复制此地址：{{verification_url}}</p>','active'),
('account_welcome','账户欢迎','欢迎使用 {{site_name}}','<h1>欢迎来到 {{site_name}}</h1><p>你的账户已经创建完成，可以开始管理链接、二维码和其他资源。</p><p><a class="button" href="{{dashboard_url}}">进入工作区</a></p>','active'),
('password_reset','重置密码','重置你的 {{site_name}} 密码','<h1>重置密码</h1><p>我们收到了你的密码重置请求。请点击下面的按钮继续。</p><p><a class="button" href="{{reset_url}}">重置密码</a></p><p class="muted">如果这不是你的操作，可以忽略本邮件。</p>','active'),
('password_changed','密码已修改','你的 {{site_name}} 密码已修改','<h1>密码已修改</h1><p>你的 {{site_name}} 账户密码刚刚完成修改。</p><p class="muted">如果这不是你的操作，请立即联系支持团队。</p>','active'),
('email_changed','邮箱已修改','你的 {{site_name}} 登录邮箱已修改','<h1>邮箱已修改</h1><p>你的账户登录邮箱已更新为 {{new_email}}。</p><p class="muted">如果这不是你的操作，请立即联系支持团队。</p>','active'),
('workspace_invitation','工作区邀请','{{inviter_name}} 邀请你加入 {{workspace_name}}','<h1>你收到一个工作区邀请</h1><p>{{inviter_name}} 邀请你加入 <strong>{{workspace_name}}</strong>。</p><p><a class="button" href="{{invitation_url}}">查看邀请</a></p>','active'),
('workspace_role_changed','工作区角色变更','你在 {{workspace_name}} 的角色已更新','<h1>工作区角色已更新</h1><p>你在 <strong>{{workspace_name}}</strong> 的角色已调整为 {{role}}。</p>','active'),
('workspace_owner_transferred','工作区所有者变更','{{workspace_name}} 的所有者已变更','<h1>工作区所有者已变更</h1><p><strong>{{workspace_name}}</strong> 的所有者已变更为 {{owner_name}}。</p>','active'),
('workspace_member_removed','已退出工作区','你已离开 {{workspace_name}}','<h1>工作区成员状态已更新</h1><p>你已不再是 <strong>{{workspace_name}}</strong> 的成员。</p>','active'),
('invoice_created','新账单','新账单 {{invoice_number}} 已生成','<h1>新账单已生成</h1><p>账单号：<strong>{{invoice_number}}</strong></p><p>应付金额：<strong>{{invoice_total}}</strong></p><p><a class="button" href="{{invoice_url}}">查看账单</a></p>','active'),
('invoice_due_soon','账单即将到期','账单 {{invoice_number}} 即将到期','<h1>账单即将到期</h1><p>账单 {{invoice_number}} 将于 {{due_at}} 到期，应付金额为 <strong>{{invoice_total}}</strong>。</p><p><a class="button" href="{{invoice_url}}">查看账单</a></p>','active'),
('invoice_overdue','账单已逾期','账单 {{invoice_number}} 已逾期','<h1>账单已逾期</h1><p>账单 {{invoice_number}} 已超过付款期限，应付金额为 <strong>{{invoice_total}}</strong>。</p><p><a class="button" href="{{invoice_url}}">处理账单</a></p>','active'),
('invoice_paid','账单已支付','账单 {{invoice_number}} 已支付','<h1>付款已确认</h1><p>账单 {{invoice_number}} 已完成支付，金额为 <strong>{{invoice_total}}</strong>。</p><p><a class="button" href="{{invoice_url}}">查看账单</a></p>','active'),
('invoice_voided','账单已作废','账单 {{invoice_number}} 已作废','<h1>账单已作废</h1><p>账单 {{invoice_number}} 已作废，无需继续付款。</p>','active'),
('payment_started','付款已创建','账单 {{invoice_number}} 的付款已创建','<h1>付款已创建</h1><p>我们已经为账单 {{invoice_number}} 创建付款请求。</p><p><a class="button" href="{{payment_url}}">继续付款</a></p>','active'),
('payment_failed','付款失败','账单 {{invoice_number}} 付款失败','<h1>付款未完成</h1><p>账单 {{invoice_number}} 的付款没有成功完成。</p><p class="muted">原因：{{failure_reason}}</p><p><a class="button" href="{{invoice_url}}">重新查看账单</a></p>','active'),
('payment_refunded','付款已退款','账单 {{invoice_number}} 的付款已退款','<h1>退款已处理</h1><p>账单 {{invoice_number}} 的退款已经处理，退款金额为 <strong>{{refund_total}}</strong>。</p>','active'),
('subscription_changed','订阅已变更','你的 {{site_name}} 订阅已变更','<h1>订阅已变更</h1><p>当前套餐：<strong>{{plan_name}}</strong></p><p>生效时间：{{effective_at}}</p>','active'),
('subscription_renewed','订阅已续期','你的 {{site_name}} 订阅已续期','<h1>订阅续期成功</h1><p>套餐 <strong>{{plan_name}}</strong> 已续期，新的服务周期已开始。</p>','active'),
('subscription_cancellation_scheduled','已安排取消订阅','你的 {{site_name}} 订阅将在周期结束时取消','<h1>已安排取消订阅</h1><p>套餐 <strong>{{plan_name}}</strong> 将在 {{ends_at}} 结束，届时不再自动续期。</p>','active'),
('subscription_cancellation_revoked','已撤销取消订阅','你的 {{site_name}} 订阅将继续续期','<h1>取消计划已撤销</h1><p>套餐 <strong>{{plan_name}}</strong> 将继续保持有效并按当前规则续期。</p>','active'),
('subscription_expiring','订阅即将结束','你的 {{site_name}} 订阅即将结束','<h1>订阅即将结束</h1><p>套餐 <strong>{{plan_name}}</strong> 将于 {{ends_at}} 结束。</p>','active'),
('subscription_cancelled','订阅已结束','你的 {{site_name}} 订阅已结束','<h1>订阅已结束</h1><p>套餐 <strong>{{plan_name}}</strong> 已结束。你的账户仍可继续使用当前可用的基础功能。</p>','active'),
('file_quarantined','文件安全提醒','你分享的文件未通过安全检查','<h1>文件未通过安全检查</h1><p>文件 <strong>{{file_name}}</strong> 已被隔离，当前不会开放下载。</p><p class="muted">扫描结果：{{scan_result}}</p>','active'),
('domain_verification_failed','域名验证失败','自定义域名 {{domain}} 验证失败','<h1>域名验证未通过</h1><p>自定义域名 <strong>{{domain}}</strong> 暂未通过验证。</p><p class="muted">请检查 DNS 配置后重新验证。</p>','active'),
('support_ticket_created','工单已创建','工单 {{ticket_number}} 已创建','<h1>工单已创建</h1><p>我们已经收到你的工单 <strong>{{ticket_number}}</strong>：{{ticket_subject}}。</p><p>客服回复后，你可以在客户中心继续查看完整会话。</p>','active'),
('support_ticket_reply','工单有新回复','工单 {{ticket_number}} 有新回复','<h1>工单有新回复</h1><p>你的工单 <strong>{{ticket_number}}</strong> 收到新回复。</p><p>{{reply_excerpt}}</p><p>登录客户中心可查看完整会话并继续回复。</p>','active')
ON DUPLICATE KEY UPDATE
name=VALUES(name),subject_template=VALUES(subject_template),html_template=VALUES(html_template),status=VALUES(status);
