package billing

import (
	"context"
	"errors"
	"strings"
)

// ApplyPayment is the only automatic payment settlement path. Provider callbacks
// must reach this method after their own signature and payload validation.
func (s *Service) ApplyPayment(ctx context.Context, invoiceID int64, provider, merchantOrder, providerReference string, amountCents int64, currency string) error {
	provider = strings.TrimSpace(provider)
	merchantOrder = strings.TrimSpace(merchantOrder)
	providerReference = strings.TrimSpace(providerReference)
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if invoiceID < 1 || provider == "" || merchantOrder == "" || amountCents < 0 || len(currency) != 3 {
		return errors.New("支付信息无效")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var workspaceID, planID int64
	var invoiceType, invoiceStatus, invoiceCurrency string
	var invoiceAmount int64
	var periodMonths int
	if err = tx.QueryRowContext(ctx, `SELECT workspace_id,plan_id,invoice_type,status,amount_cents,currency,period_months FROM billing_invoices WHERE id=? FOR UPDATE`, invoiceID).Scan(&workspaceID, &planID, &invoiceType, &invoiceStatus, &invoiceAmount, &invoiceCurrency, &periodMonths); err != nil {
		return err
	}
	if invoiceAmount != amountCents || !strings.EqualFold(invoiceCurrency, currency) {
		return errors.New("支付金额或币种与账单不一致")
	}

	var transactionID int64
	var transactionStatus, transactionProvider string
	var transactionAmount int64
	var transactionCurrency string
	if err = tx.QueryRowContext(ctx, `SELECT id,provider,status,amount_cents,currency FROM payment_transactions WHERE invoice_id=? AND merchant_order_no=? FOR UPDATE`, invoiceID, merchantOrder).Scan(&transactionID, &transactionProvider, &transactionStatus, &transactionAmount, &transactionCurrency); err != nil {
		return err
	}
	if transactionProvider != provider || transactionAmount != amountCents || !strings.EqualFold(transactionCurrency, currency) {
		return errors.New("支付交易与账单不一致")
	}
	if invoiceStatus == "paid" {
		if transactionStatus == "paid" {
			return tx.Commit()
		}
		return errors.New("账单已经通过其他交易完成支付")
	}
	if invoiceStatus != "pending" && invoiceStatus != "overdue" {
		return errors.New("当前账单不能支付")
	}
	if transactionStatus == "paid" {
		return errors.New("支付交易状态与账单状态不一致")
	}

	res, err := tx.ExecContext(ctx, `UPDATE payment_transactions SET status='paid',provider_order_id=CASE WHEN ?<>'' THEN ? ELSE provider_order_id END,paid_at=NOW(),failure_reason='' WHERE id=? AND status<>'paid'`, providerReference, providerReference, transactionID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return errors.New("支付交易已经处理")
	}
	if _, err = tx.ExecContext(ctx, `UPDATE billing_invoices SET status='paid',paid_at=NOW(),paid_via=?,payment_reference=? WHERE id=?`, provider, providerReference, invoiceID); err != nil {
		return err
	}
	if periodMonths < 1 {
		periodMonths = 1
	}
	if invoiceType == "renewal" {
		_, err = tx.ExecContext(ctx, `UPDATE workspace_subscriptions SET status='active',period_ends_at=DATE_ADD(GREATEST(COALESCE(period_ends_at,NOW()),NOW()),INTERVAL ? MONTH),cancel_at_period_end=FALSE WHERE workspace_id=?`, periodMonths, workspaceID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE workspace_subscriptions SET plan_id=?,status='active',period_started_at=NOW(),period_ends_at=DATE_ADD(NOW(),INTERVAL ? MONTH),cancel_at_period_end=FALSE WHERE workspace_id=?`, planID, periodMonths, workspaceID)
	}
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO subscription_events(workspace_id,invoice_id,actor_type,actor_id,event_type,to_plan_id,metadata) VALUES(?,?,'system',NULL,'invoice.paid',?,JSON_OBJECT('provider',?,'reference',?,'merchant_order',?,'period_months',?))`, workspaceID, invoiceID, planID, provider, providerReference, merchantOrder, periodMonths)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) InvoiceForPayment(ctx context.Context, userID, workspaceID, invoiceID int64) (Invoice, error) {
	var role string
	if err := s.db.QueryRowContext(ctx, `SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=? AND status='active'`, workspaceID, userID).Scan(&role); err != nil || !canManage(role) {
		return Invoice{}, errors.New("只有工作区所有者或管理员可以支付账单")
	}
	var out Invoice
	row := s.db.QueryRowContext(ctx, `SELECT `+invoiceSelect+` FROM billing_invoices i JOIN plans p ON p.id=i.plan_id WHERE i.id=? AND i.workspace_id=?`, invoiceID, workspaceID)
	if err := scanInvoice(row, &out); err != nil {
		return Invoice{}, err
	}
	return out, nil
}
