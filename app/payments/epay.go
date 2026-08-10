package payments

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"net/url"
	"sort"
	"strings"
)

func (s *Service) createEPay(ctx context.Context, payment invoicePayment) (createResult, error) {
	if !strings.EqualFold(payment.Invoice.Currency, "CNY") {
		return createResult{}, errors.New("易支付兼容协议当前仅支持人民币账单")
	}
	gateway := strings.TrimRight(strings.TrimSpace(s.setting(ctx, "payments.epay.gateway", "")), "/")
	pid := strings.TrimSpace(s.setting(ctx, "payments.epay.pid", ""))
	key := s.setting(ctx, "payments.epay.key", "")
	if gateway == "" || pid == "" || key == "" {
		return createResult{}, errors.New("易支付兼容协议尚未配置")
	}
	paymentType := strings.TrimSpace(s.setting(ctx, "payments.epay.default_type", "alipay"))
	params := url.Values{}
	params.Set("pid", pid)
	params.Set("type", paymentType)
	params.Set("out_trade_no", payment.OrderNo)
	params.Set("notify_url", s.baseURL+"/api/payments/epay/notify")
	params.Set("return_url", s.baseURL+"/app/billing?payment=return")
	params.Set("name", "GoJet "+payment.Invoice.PlanName)
	params.Set("money", moneyDecimal(payment.Invoice.AmountCents))
	params.Set("sign_type", "MD5")
	params.Set("sign", epaySign(params, key))
	endpoint := gateway
	if !strings.HasSuffix(strings.ToLower(endpoint), ".php") {
		endpoint += "/submit.php"
	}
	return createResult{RedirectURL: endpoint + "?" + params.Encode(), Payload: map[string]string{"out_trade_no": payment.OrderNo, "type": paymentType}}, nil
}

func (s *Service) HandleEPayNotification(ctx context.Context, form url.Values) error {
	pid := s.setting(ctx, "payments.epay.pid", "")
	key := s.setting(ctx, "payments.epay.key", "")
	if pid == "" || key == "" || form.Get("pid") != pid {
		return errors.New("易支付商户编号不匹配")
	}
	provided := strings.ToLower(strings.TrimSpace(form.Get("sign")))
	expected := strings.ToLower(epaySign(form, key))
	if provided == "" || provided != expected {
		return errors.New("易支付通知签名验证失败")
	}
	if form.Get("trade_status") != "TRADE_SUCCESS" {
		return nil
	}
	amount, err := decimalToCents(form.Get("money"))
	if err != nil {
		return err
	}
	return s.Complete(ctx, Notification{Provider: "epay", MerchantOrder: form.Get("out_trade_no"), ProviderReference: form.Get("trade_no"), AmountCents: amount, Currency: "CNY"})
}

func epaySign(values url.Values, key string) string {
	keys := make([]string, 0, len(values))
	for name := range values {
		if name == "sign" || name == "sign_type" || values.Get(name) == "" {
			continue
		}
		keys = append(keys, name)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, name := range keys {
		parts = append(parts, name+"="+values.Get(name))
	}
	sum := md5.Sum([]byte(strings.Join(parts, "&") + key))
	return hex.EncodeToString(sum[:])
}
