-- Give invoice-created mail a compact summary card and separated action area.
-- The global mail shell remains owned by app/mail; this only structures the
-- invoice-specific content inside that shell.
UPDATE mail_templates
SET html_template = '<p class="muted">账单通知</p><h1>新账单已生成</h1><div style="padding:0 8px 18px"><div style="padding:18px;border:1px solid #e5ebe8;border-radius:12px;background:#f8faf9"><p>工作区：<strong>{{workspace_name}}</strong></p><p>套餐：{{plan_name}} · {{period_days}} 天</p><p>应付金额：<strong>{{settlement_amount}} {{settlement_currency}}</strong></p><p>{{fx_detail}}</p><p class="muted">支付期限：{{due_at}}</p></div></div><div style="padding:18px 8px 0"><p><a class="button" href="{{billing_url}}">查看并支付账单</a></p></div>'
WHERE template_key = 'invoice_created';
