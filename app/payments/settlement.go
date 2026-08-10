package payments

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

type Notification struct {
	Provider          string
	MerchantOrder     string
	ProviderReference string
	AmountCents       int64
	Currency          string
}

func (s *Service) Complete(ctx context.Context, notice Notification) error {
	notice.Provider = strings.ToLower(strings.TrimSpace(notice.Provider))
	notice.MerchantOrder = strings.TrimSpace(notice.MerchantOrder)
	notice.ProviderReference = strings.TrimSpace(notice.ProviderReference)
	notice.Currency = strings.ToUpper(strings.TrimSpace(notice.Currency))
	if notice.Provider == "" || notice.MerchantOrder == "" || notice.AmountCents < 0 || len(notice.Currency) != 3 {
		return errors.New("支付通知信息无效")
	}
	var invoiceID int64
	var provider string
	err := s.db.QueryRowContext(ctx, `SELECT invoice_id,provider FROM payment_transactions WHERE merchant_order_no=?`, notice.MerchantOrder).Scan(&invoiceID, &provider)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("支付订单不存在")
	}
	if err != nil {
		return err
	}
	if provider != notice.Provider {
		return errors.New("支付渠道不匹配")
	}
	return s.billing.ApplyPayment(ctx, invoiceID, notice.Provider, notice.MerchantOrder, notice.ProviderReference, notice.AmountCents, notice.Currency)
}

func (s *Service) MarkFailed(ctx context.Context, provider, merchantOrder, reason string) {
	_, _ = s.db.ExecContext(ctx, `UPDATE payment_transactions SET status='failed',failure_reason=? WHERE provider=? AND merchant_order_no=? AND status IN ('created','pending')`, trimFailure(reason), provider, merchantOrder)
}
