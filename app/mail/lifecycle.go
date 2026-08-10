package mail

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

func publicBaseURL() string {
	value := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")), "/")
	if value == "" {
		return "http://localhost:8080"
	}
	return value
}

func moneyText(minor int64) string {
	return fmt.Sprintf("%d.%02d", minor/100, minor%100)
}

func localTimeText(value time.Time) string {
	return value.Local().Format("2006-01-02 15:04")
}

func fxDescription(sourceAmount int64, sourceCurrency string, settlementAmount int64, settlementCurrency, rate, provider string, markup int) string {
	if strings.EqualFold(sourceCurrency, settlementCurrency) || sourceCurrency == "" {
		return "计价币种与结算币种一致，本账单未进行货币换算。"
	}
	detail := fmt.Sprintf("原计价 %s %s；下单时锁定汇率 1 %s = %s %s；汇率来源 %s", moneyText(sourceAmount), sourceCurrency, sourceCurrency, rate, settlementCurrency, strings.ToUpper(provider))
	if markup != 0 {
		detail += fmt.Sprintf("；结算汇率调整 %d 个基点", markup)
	}
	detail += fmt.Sprintf("；最终结算 %s %s。", moneyText(settlementAmount), settlementCurrency)
	return detail
}

// QueueLifecycleNotifications discovers durable business-state transitions and
// enqueues each customer notification at most once through mail_messages.dedupe_key.
// It is deliberately safe to call repeatedly from mail-worker.
func (s *Service) QueueLifecycleNotifications(ctx context.Context) error {
	if err := s.queueInvoiceCreated(ctx); err != nil { return err }
	if err := s.queueInvoiceDueSoon(ctx); err != nil { return err }
	if err := s.queueInvoiceOverdue(ctx); err != nil { return err }
	if err := s.queueInvoicePaid(ctx); err != nil { return err }
	if err := s.queueInvoiceVoided(ctx); err != nil { return err }
	if err := s.queuePaymentLifecycle(ctx); err != nil { return err }
	if err := s.queueSubscriptionLifecycle(ctx); err != nil { return err }
	if err := s.queueFileQuarantine(ctx); err != nil { return err }
	return nil
}

func (s *Service) queueInvoiceCreated(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, `SELECT i.id,i.invoice_number,i.workspace_id,w.name,p.name,i.period_days,i.source_amount_cents,i.source_currency,i.amount_cents,i.currency,CAST(i.fx_rate AS CHAR),i.fx_provider,i.fx_markup_bps,i.due_at,u.email,COALESCE(u.display_name,'')
FROM billing_invoices i JOIN workspaces w ON w.id=i.workspace_id JOIN plans p ON p.id=i.plan_id JOIN users u ON u.id=i.requested_by
WHERE NOT EXISTS(SELECT 1 FROM mail_messages m WHERE m.dedupe_key=CONCAT('invoice_created:',i.id))
ORDER BY i.id LIMIT 50`)
	if err != nil { return err }
	defer rows.Close()
	base := publicBaseURL()
	for rows.Next() {
		var id, wid, srcAmount, amount int64; var period, markup int
		var number, workspace, plan, srcCurrency, currency, rate, provider, email, display string; var due time.Time
		if err = rows.Scan(&id,&number,&wid,&workspace,&plan,&period,&srcAmount,&srcCurrency,&amount,&currency,&rate,&provider,&markup,&due,&email,&display); err != nil { return err }
		if display == "" { display = email }
		_, err = s.QueueTemplateOnce(ctx,"invoice_created","invoice_created:"+strconv.FormatInt(id,10),email,map[string]string{
			"invoice_number":number,"workspace_name":workspace,"plan_name":plan,"period_days":strconv.Itoa(period),
			"settlement_amount":moneyText(amount),"settlement_currency":currency,"fx_detail":fxDescription(srcAmount,srcCurrency,amount,currency,rate,provider,markup),
			"due_at":localTimeText(due),"billing_url":base+"/app/billing",
		})
		if err != nil { return err }
	}
	return rows.Err()
}

func (s *Service) queueInvoiceDueSoon(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, `SELECT i.id,i.invoice_number,i.amount_cents,i.currency,i.due_at,u.email FROM billing_invoices i JOIN users u ON u.id=i.requested_by WHERE i.status='pending' AND i.due_at>UTC_TIMESTAMP() AND i.due_at<=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR) AND NOT EXISTS(SELECT 1 FROM mail_messages m WHERE m.dedupe_key=CONCAT('invoice_due:',i.id)) ORDER BY i.due_at LIMIT 50`)
	if err != nil { return err }; defer rows.Close(); base:=publicBaseURL()
	for rows.Next(){var id,amount int64;var number,currency,email string;var due time.Time;if err=rows.Scan(&id,&number,&amount,&currency,&due,&email);err!=nil{return err};if _,err=s.QueueTemplateOnce(ctx,"invoice_due_soon","invoice_due:"+strconv.FormatInt(id,10),email,map[string]string{"invoice_number":number,"settlement_amount":moneyText(amount),"settlement_currency":currency,"due_at":localTimeText(due),"billing_url":base+"/app/billing"});err!=nil{return err}}
	return rows.Err()
}

func (s *Service) queueInvoiceOverdue(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, `SELECT i.id,i.invoice_number,i.amount_cents,i.currency,i.due_at,u.email FROM billing_invoices i JOIN users u ON u.id=i.requested_by WHERE i.status IN ('pending','overdue') AND i.due_at<=UTC_TIMESTAMP() AND NOT EXISTS(SELECT 1 FROM mail_messages m WHERE m.dedupe_key=CONCAT('invoice_overdue:',i.id)) ORDER BY i.due_at LIMIT 50`)
	if err != nil { return err }; defer rows.Close(); base:=publicBaseURL()
	for rows.Next(){var id,amount int64;var number,currency,email string;var due time.Time;if err=rows.Scan(&id,&number,&amount,&currency,&due,&email);err!=nil{return err};if _,err=s.QueueTemplateOnce(ctx,"invoice_overdue","invoice_overdue:"+strconv.FormatInt(id,10),email,map[string]string{"invoice_number":number,"settlement_amount":moneyText(amount),"settlement_currency":currency,"due_at":localTimeText(due),"billing_url":base+"/app/billing"});err!=nil{return err}}
	return rows.Err()
}

func (s *Service) queueInvoicePaid(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, `SELECT i.id,i.invoice_number,i.workspace_id,w.name,p.name,i.invoice_type,i.amount_cents,i.currency,i.paid_via,i.payment_reference,i.paid_at,u.email,s.period_started_at,s.period_ends_at FROM billing_invoices i JOIN workspaces w ON w.id=i.workspace_id JOIN plans p ON p.id=i.plan_id JOIN users u ON u.id=i.requested_by LEFT JOIN workspace_subscriptions s ON s.workspace_id=i.workspace_id WHERE i.status='paid' AND i.paid_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mail_messages m WHERE m.dedupe_key=CONCAT('invoice_paid:',i.id)) ORDER BY i.paid_at LIMIT 50`)
	if err != nil { return err }; defer rows.Close(); base:=publicBaseURL()
	for rows.Next(){var id,wid,amount int64;var number,workspace,plan,kind,currency,via,reference,email string;var paid time.Time;var start,end sql.NullTime;if err=rows.Scan(&id,&number,&wid,&workspace,&plan,&kind,&amount,&currency,&via,&reference,&paid,&email,&start,&end);err!=nil{return err};periodStart,periodEnd:="—","—";if start.Valid{periodStart=localTimeText(start.Time)};if end.Valid{periodEnd=localTimeText(end.Time)}
		vals:=map[string]string{"invoice_number":number,"settlement_amount":moneyText(amount),"settlement_currency":currency,"payment_provider":paymentProviderName(via),"payment_reference":reference,"period_start":periodStart,"period_end":periodEnd,"invoice_pdf_url":fmt.Sprintf("%s/api/workspaces/%d/billing/invoices/%d/pdf",base,wid,id)}
		if _,err=s.QueueTemplateOnce(ctx,"invoice_paid","invoice_paid:"+strconv.FormatInt(id,10),email,vals);err!=nil{return err}
		templateKey:="subscription_changed";dedupe:="subscription_changed:"+strconv.FormatInt(id,10);subVals:=map[string]string{"workspace_name":workspace,"plan_name":plan,"period_start":periodStart,"period_end":periodEnd}
		if kind=="renewal"{templateKey="subscription_renewed";dedupe="subscription_renewed:"+strconv.FormatInt(id,10);subVals=map[string]string{"workspace_name":workspace,"plan_name":plan,"period_end":periodEnd}}
		if _,err=s.QueueTemplateOnce(ctx,templateKey,dedupe,email,subVals);err!=nil{return err}
	}
	return rows.Err()
}

func (s *Service) queueInvoiceVoided(ctx context.Context) error {
	rows,err:=s.db.QueryContext(ctx,`SELECT i.id,i.invoice_number,i.admin_note,u.email FROM billing_invoices i JOIN users u ON u.id=i.requested_by WHERE i.status='void' AND NOT EXISTS(SELECT 1 FROM mail_messages m WHERE m.dedupe_key=CONCAT('invoice_voided:',i.id)) ORDER BY i.id LIMIT 50`);if err!=nil{return err};defer rows.Close()
	for rows.Next(){var id int64;var number,note,email string;if err=rows.Scan(&id,&number,&note,&email);err!=nil{return err};if _,err=s.QueueTemplateOnce(ctx,"invoice_voided","invoice_voided:"+strconv.FormatInt(id,10),email,map[string]string{"invoice_number":number,"note":note});err!=nil{return err}}
	return rows.Err()
}

func (s *Service) queuePaymentLifecycle(ctx context.Context) error {
	base:=publicBaseURL()
	rows,err:=s.db.QueryContext(ctx,`SELECT pt.id,pt.status,pt.provider,pt.merchant_order_no,pt.amount_cents,pt.currency,pt.failure_reason,COALESCE(pt.provider_order_id,''),i.invoice_number,u.email FROM payment_transactions pt JOIN billing_invoices i ON i.id=pt.invoice_id JOIN users u ON u.id=i.requested_by WHERE pt.status IN ('pending','failed','refunded') ORDER BY pt.id LIMIT 200`);if err!=nil{return err};defer rows.Close()
	for rows.Next(){var id,amount int64;var status,provider,merchant,currency,reason,reference,number,email string;if err=rows.Scan(&id,&status,&provider,&merchant,&amount,&currency,&reason,&reference,&number,&email);err!=nil{return err};suffix:=strconv.FormatInt(id,10)
		switch status{
		case "pending":
			if _,err=s.QueueTemplateOnce(ctx,"payment_started","payment_started:"+suffix,email,map[string]string{"invoice_number":number,"payment_provider":paymentProviderName(provider),"settlement_amount":moneyText(amount),"settlement_currency":currency,"merchant_order":merchant});err!=nil{return err}
		case "failed":
			if reason==""{reason="支付渠道未能完成本次支付"};if _,err=s.QueueTemplateOnce(ctx,"payment_failed","payment_failed:"+suffix,email,map[string]string{"invoice_number":number,"payment_provider":paymentProviderName(provider),"settlement_amount":moneyText(amount),"settlement_currency":currency,"failure_reason":reason,"billing_url":base+"/app/billing"});err!=nil{return err}
		case "refunded":
			if _,err=s.QueueTemplateOnce(ctx,"payment_refunded","payment_refunded:"+suffix,email,map[string]string{"invoice_number":number,"payment_provider":paymentProviderName(provider),"settlement_amount":moneyText(amount),"settlement_currency":currency,"payment_reference":reference});err!=nil{return err}
		}
	}
	return rows.Err()
}

func (s *Service) queueSubscriptionLifecycle(ctx context.Context) error {
	base:=publicBaseURL()
	rows,err:=s.db.QueryContext(ctx,`SELECT se.id,se.event_type,w.name,u.email,s.period_ends_at FROM subscription_events se JOIN workspaces w ON w.id=se.workspace_id JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.role='owner' AND wm.status='active' JOIN users u ON u.id=wm.user_id LEFT JOIN workspace_subscriptions s ON s.workspace_id=w.id WHERE se.event_type IN ('subscription.cancellation_scheduled','subscription.cancellation_revoked') ORDER BY se.id LIMIT 200`);if err!=nil{return err};defer rows.Close()
	for rows.Next(){var id int64;var event,workspace,email string;var end sql.NullTime;if err=rows.Scan(&id,&event,&workspace,&email,&end);err!=nil{return err};periodEnd:="—";if end.Valid{periodEnd=localTimeText(end.Time)};key,dedupe:="subscription_cancellation_scheduled","subscription_cancel_scheduled:"+strconv.FormatInt(id,10);vals:=map[string]string{"workspace_name":workspace,"period_end":periodEnd};if event=="subscription.cancellation_revoked"{key="subscription_cancellation_revoked";dedupe="subscription_cancel_revoked:"+strconv.FormatInt(id,10);vals=map[string]string{"workspace_name":workspace}};if _,err=s.QueueTemplateOnce(ctx,key,dedupe,email,vals);err!=nil{return err}}
	if err=rows.Err();err!=nil{return err}
	expiring,err:=s.db.QueryContext(ctx,`SELECT s.workspace_id,w.name,s.period_ends_at,u.email FROM workspace_subscriptions s JOIN workspaces w ON w.id=s.workspace_id JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.role='owner' AND wm.status='active' JOIN users u ON u.id=wm.user_id WHERE s.status='active' AND s.period_ends_at>UTC_TIMESTAMP() AND s.period_ends_at<=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY)`);if err!=nil{return err};defer expiring.Close()
	for expiring.Next(){var wid int64;var workspace,email string;var end time.Time;if err=expiring.Scan(&wid,&workspace,&end,&email);err!=nil{return err};dedupe:="subscription_expiring:"+strconv.FormatInt(wid,10)+":"+end.UTC().Format("20060102150405");if _,err=s.QueueTemplateOnce(ctx,"subscription_expiring",dedupe,email,map[string]string{"workspace_name":workspace,"period_end":localTimeText(end),"billing_url":base+"/app/billing"});err!=nil{return err}}
	if err=expiring.Err();err!=nil{return err}
	cancelled,err:=s.db.QueryContext(ctx,`SELECT s.workspace_id,w.name,u.email FROM workspace_subscriptions s JOIN workspaces w ON w.id=s.workspace_id JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.role='owner' AND wm.status='active' JOIN users u ON u.id=wm.user_id WHERE s.status='cancelled'`);if err!=nil{return err};defer cancelled.Close()
	for cancelled.Next(){var wid int64;var workspace,email string;if err=cancelled.Scan(&wid,&workspace,&email);err!=nil{return err};if _,err=s.QueueTemplateOnce(ctx,"subscription_cancelled","subscription_cancelled:"+strconv.FormatInt(wid,10),email,map[string]string{"workspace_name":workspace,"billing_url":base+"/app/billing"});err!=nil{return err}}
	return cancelled.Err()
}

func (s *Service) queueFileQuarantine(ctx context.Context) error {
	rows,err:=s.db.QueryContext(ctx,`SELECT f.id,f.original_name,w.name,u.email FROM file_shares f JOIN workspaces w ON w.id=f.workspace_id JOIN users u ON u.id=f.created_by WHERE f.scan_status='infected' AND NOT EXISTS(SELECT 1 FROM mail_messages m WHERE m.dedupe_key=CONCAT('file_quarantined:',f.id)) ORDER BY f.id LIMIT 50`);if err!=nil{return err};defer rows.Close()
	for rows.Next(){var id int64;var file,workspace,email string;if err=rows.Scan(&id,&file,&workspace,&email);err!=nil{return err};if _,err=s.QueueTemplateOnce(ctx,"file_quarantined","file_quarantined:"+strconv.FormatInt(id,10),email,map[string]string{"file_name":file,"workspace_name":workspace});err!=nil{return err}}
	return rows.Err()
}

func paymentProviderName(code string) string {
	switch strings.ToLower(code){case "alipay":return "支付宝";case "wechat":return "微信支付";case "epay":return "易支付兼容协议";case "paypal":return "PayPal";case "stripe":return "Stripe";default:if code==""{return "人工确认"};return code}
}
