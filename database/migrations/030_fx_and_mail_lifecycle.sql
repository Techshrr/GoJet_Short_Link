ALTER TABLE billing_invoices
    ADD COLUMN source_amount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER invoice_type,
    ADD COLUMN source_currency CHAR(3) NOT NULL DEFAULT '' AFTER source_amount_cents,
    ADD COLUMN fx_rate DECIMAL(24,12) NOT NULL DEFAULT 1.000000000000 AFTER currency,
    ADD COLUMN fx_provider VARCHAR(32) NOT NULL DEFAULT 'identity' AFTER fx_rate,
    ADD COLUMN fx_markup_bps INT NOT NULL DEFAULT 0 AFTER fx_provider,
    ADD COLUMN fx_quoted_at DATETIME NULL AFTER fx_markup_bps;

UPDATE billing_invoices
SET source_amount_cents=amount_cents,
    source_currency=currency,
    fx_rate=1.000000000000,
    fx_provider='identity',
    fx_markup_bps=0,
    fx_quoted_at=COALESCE(created_at,UTC_TIMESTAMP())
WHERE source_amount_cents=0 OR source_currency='';

CREATE TABLE fx_rate_cache (
    base_currency CHAR(3) NOT NULL,
    quote_currency CHAR(3) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    rate DECIMAL(24,12) NOT NULL,
    observed_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(base_currency,quote_currency,provider),
    KEY fx_rate_expiry_idx(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE mail_messages
    ADD COLUMN dedupe_key VARCHAR(190) NULL AFTER message_type,
    ADD UNIQUE KEY mail_messages_dedupe_unique(dedupe_key);

INSERT INTO system_settings(setting_key,setting_value,is_encrypted) VALUES
('billing.settlement_currency','',FALSE),
('billing.fx.provider','ecb',FALSE),
('billing.fx.markup_bps','0',FALSE),
('billing.fx.cache_hours','24',FALSE),
('billing.fx.manual_rates','{}',FALSE)
ON DUPLICATE KEY UPDATE setting_key=VALUES(setting_key);

DROP TRIGGER IF EXISTS billing_invoice_active_payment_guard;
DELIMITER $$
CREATE TRIGGER billing_invoice_active_payment_guard
BEFORE UPDATE ON billing_invoices
FOR EACH ROW
BEGIN
    IF OLD.status IN ('pending','overdue')
       AND NEW.status IN ('paid','void')
       AND EXISTS(
           SELECT 1 FROM payment_transactions p
           WHERE p.invoice_id=OLD.id AND p.status IN ('created','pending')
       ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='账单存在进行中的在线支付，请先等待支付结果';
    END IF;
END$$
DELIMITER ;

INSERT INTO mail_templates(template_key,name,subject_template,html_template,status) VALUES
('verification','邮箱验证','验证您的 {{site_name}} 邮箱','<h1>验证邮箱</h1><p>您好，{{display_name}}。</p><p>感谢注册 {{site_name}}。请完成邮箱验证后继续使用账户。</p><p><a class="button" href="{{verification_url}}">验证邮箱</a></p><p class="muted">验证链接：{{verification_url}}</p>','active'),
('account_welcome','注册完成','欢迎使用 {{site_name}}','<h1>账户已准备好</h1><p>您好，{{display_name}}。</p><p>您的 {{site_name}} 账户已经完成注册，可以开始创建和管理工作区。</p><p><a class="button" href="{{console_url}}">进入控制台</a></p>','active'),
('password_reset','密码重置','重置您的 {{site_name}} 登录密码','<h1>重置密码</h1><p>我们收到了您的密码重置请求。</p><p><a class="button" href="{{reset_url}}">设置新密码</a></p><p class="muted">链接将在 {{expires_minutes}} 分钟后失效。如果不是您发起的请求，可以忽略此邮件。</p>','active'),
('password_changed','密码已修改','您的 {{site_name}} 密码已修改','<h1>密码已修改</h1><p>您的账户密码已于 {{changed_at}} 成功修改，其他旧登录会话已失效。</p><p class="muted">如果这不是您的操作，请立即联系支持团队。</p>','active'),
('email_changed','邮箱已修改','您的 {{site_name}} 登录邮箱已修改','<h1>登录邮箱已修改</h1><p>账户登录邮箱已从 {{old_email}} 修改为 {{new_email}}。</p><p class="muted">操作时间：{{changed_at}}</p>','active'),
('workspace_invitation','工作区邀请','{{inviter}} 邀请您加入 {{workspace_name}}','<h1>工作区邀请</h1><p>{{inviter}} 邀请您以“{{role_name}}”身份加入工作区“{{workspace_name}}”。</p><p><a class="button" href="{{invitation_url}}">查看邀请</a></p><p class="muted">邀请有效期至 {{expires_at}}。</p>','active'),
('workspace_role_changed','成员角色变更','您在 {{workspace_name}} 的角色已变更','<h1>工作区权限已更新</h1><p>您在“{{workspace_name}}”中的角色已由“{{old_role}}”调整为“{{new_role}}”。</p><p class="muted">操作人：{{actor}}</p>','active'),
('workspace_owner_transferred','工作区所有权变更','{{workspace_name}} 的所有权已转移','<h1>工作区所有权已转移</h1><p>“{{workspace_name}}”的所有权已由 {{old_owner}} 转移给 {{new_owner}}。</p><p class="muted">操作时间：{{changed_at}}</p>','active'),
('workspace_member_removed','工作区成员移除','您已离开 {{workspace_name}}','<h1>工作区成员关系已变更</h1><p>您已被从工作区“{{workspace_name}}”移除，之后将无法继续访问该工作区资源。</p>','active'),
('invoice_created','账单已生成','账单 {{invoice_number}} 已生成','<h1>新账单已生成</h1><p>工作区：{{workspace_name}}</p><p>套餐：{{plan_name}} · 周期 {{period_days}} 天</p><p>应付金额：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p>{{fx_detail}}<p>请在 {{due_at}} 前完成支付。</p><p><a class="button" href="{{billing_url}}">查看并支付账单</a></p>','active'),
('invoice_due_soon','账单即将到期','账单 {{invoice_number}} 即将到期','<h1>账单即将到期</h1><p>账单 {{invoice_number}} 将于 {{due_at}} 到期。</p><p>待支付：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p><p><a class="button" href="{{billing_url}}">立即查看账单</a></p>','active'),
('invoice_overdue','账单已逾期','账单 {{invoice_number}} 已逾期','<h1>账单已逾期</h1><p>账单 {{invoice_number}} 已超过支付期限。</p><p>待支付：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p><p><a class="button" href="{{billing_url}}">处理账单</a></p>','active'),
('invoice_paid','账单支付成功','账单 {{invoice_number}} 已支付','<h1>支付成功</h1><p>账单 {{invoice_number}} 已完成支付。</p><p>实付：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p><p>支付方式：{{payment_provider}}</p><p>支付参考号：{{payment_reference}}</p><p>服务周期：{{period_start}} 至 {{period_end}}</p><p><a class="button" href="{{invoice_pdf_url}}">下载账单 PDF</a></p>','active'),
('invoice_voided','账单已作废','账单 {{invoice_number}} 已作废','<h1>账单已作废</h1><p>账单 {{invoice_number}} 已由管理员作废。</p><p>处理说明：{{note}}</p>','active'),
('payment_started','支付已创建','账单 {{invoice_number}} 的支付订单已创建','<h1>支付订单已创建</h1><p>账单：{{invoice_number}}</p><p>支付方式：{{payment_provider}}</p><p>应付金额：{{settlement_amount}} {{settlement_currency}}</p><p class="muted">商户订单号：{{merchant_order}}</p>','active'),
('payment_failed','支付未完成','账单 {{invoice_number}} 的支付未完成','<h1>支付未完成</h1><p>账单 {{invoice_number}} 的 {{payment_provider}} 支付未能完成。</p><p>金额：{{settlement_amount}} {{settlement_currency}}</p><p>说明：{{failure_reason}}</p><p><a class="button" href="{{billing_url}}">返回账单中心</a></p>','active'),
('payment_refunded','支付已退款','账单 {{invoice_number}} 的款项已退款','<h1>款项已退款</h1><p>账单：{{invoice_number}}</p><p>退款金额：{{settlement_amount}} {{settlement_currency}}</p><p>支付方式：{{payment_provider}}</p><p>参考号：{{payment_reference}}</p>','active'),
('subscription_changed','套餐已变更','{{workspace_name}} 的套餐已变更','<h1>套餐变更完成</h1><p>工作区“{{workspace_name}}”当前套餐为 {{plan_name}}。</p><p>服务周期：{{period_start}} 至 {{period_end}}</p>','active'),
('subscription_renewed','续费成功','{{workspace_name}} 已续费成功','<h1>续费成功</h1><p>工作区“{{workspace_name}}”的 {{plan_name}} 套餐已续费。</p><p>新的服务周期截止至 {{period_end}}。</p>','active'),
('subscription_cancellation_scheduled','取消续费已设置','{{workspace_name}} 将在周期结束后停止续费','<h1>已设置周期结束后停止</h1><p>工作区“{{workspace_name}}”将在 {{period_end}} 当前周期结束后停止套餐服务。</p><p class="muted">在周期结束前仍可恢复续费。</p>','active'),
('subscription_cancellation_revoked','已恢复续费','{{workspace_name}} 已恢复续费','<h1>已恢复续费</h1><p>工作区“{{workspace_name}}”已取消周期结束停止计划，当前套餐将继续保持。</p>','active'),
('subscription_expiring','服务周期即将结束','{{workspace_name}} 的服务周期即将结束','<h1>服务周期即将结束</h1><p>工作区“{{workspace_name}}”当前服务周期将在 {{period_end}} 结束。</p><p><a class="button" href="{{billing_url}}">查看套餐与账单</a></p>','active'),
('subscription_cancelled','套餐服务已结束','{{workspace_name}} 的套餐服务已结束','<h1>套餐服务已结束</h1><p>工作区“{{workspace_name}}”的当前付费服务周期已经结束。</p><p><a class="button" href="{{billing_url}}">查看套餐</a></p>','active'),
('file_quarantined','文件安全提醒','文件 {{file_name}} 已被隔离','<h1>文件已被安全隔离</h1><p>工作区：{{workspace_name}}</p><p>文件：{{file_name}}</p><p>安全检查发现该文件存在风险，因此不会生成公开下载地址。</p>','active'),
('domain_verification_failed','域名验证异常','域名 {{domain_name}} 验证未通过','<h1>域名验证未通过</h1><p>域名 {{domain_name}} 当前未能完成验证。</p><p>原因：{{reason}}</p><p><a class="button" href="{{domains_url}}">查看域名设置</a></p>','active')
ON DUPLICATE KEY UPDATE
    name=VALUES(name),
    subject_template=VALUES(subject_template),
    html_template=VALUES(html_template),
    status=VALUES(status);
