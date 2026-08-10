package payments

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"sort"
	"strings"
	"time"
)

func (s *Service) createAlipay(ctx context.Context, payment invoicePayment) (createResult, error) {
	if !strings.EqualFold(payment.Invoice.Currency, "CNY") {
		return createResult{}, errors.New("支付宝当前仅支持人民币账单")
	}
	appID := s.setting(ctx, "payments.alipay.app_id", "")
	privateKey, err := parseRSAPrivateKey(s.setting(ctx, "payments.alipay.private_key", ""))
	if err != nil || appID == "" {
		return createResult{}, errors.New("支付宝尚未正确配置")
	}
	gateway := strings.TrimSpace(s.setting(ctx, "payments.alipay.gateway", "https://openapi.alipay.com/gateway.do"))
	biz, _ := json.Marshal(map[string]any{
		"out_trade_no": payment.OrderNo,
		"product_code": "FAST_INSTANT_TRADE_PAY",
		"total_amount": moneyDecimal(payment.Invoice.AmountCents),
		"subject": "GoJet " + payment.Invoice.PlanName,
		"body": "账单 " + payment.Invoice.InvoiceNumber,
	})
	china := time.FixedZone("CST", 8*60*60)
	params := url.Values{}
	params.Set("app_id", appID)
	params.Set("method", "alipay.trade.page.pay")
	params.Set("format", "JSON")
	params.Set("charset", "utf-8")
	params.Set("sign_type", "RSA2")
	params.Set("timestamp", time.Now().In(china).Format("2006-01-02 15:04:05"))
	params.Set("version", "1.0")
	params.Set("notify_url", s.baseURL+"/api/payments/alipay/notify")
	params.Set("return_url", s.baseURL+"/app/billing?payment=return")
	params.Set("biz_content", string(biz))
	signature, err := rsaSHA256Sign(privateKey, canonicalValues(params, nil))
	if err != nil {
		return createResult{}, err
	}
	params.Set("sign", signature)
	separator := "?"
	if strings.Contains(gateway, "?") {
		separator = "&"
	}
	return createResult{RedirectURL: gateway + separator + params.Encode(), Payload: map[string]string{"out_trade_no": payment.OrderNo}}, nil
}

func (s *Service) HandleAlipayNotification(ctx context.Context, form url.Values) error {
	publicKey, err := parseRSAPublicKey(s.setting(ctx, "payments.alipay.public_key", ""))
	if err != nil {
		return errors.New("支付宝公钥配置无效")
	}
	signature := form.Get("sign")
	if signature == "" || rsaSHA256Verify(publicKey, canonicalValues(form, map[string]bool{"sign": true, "sign_type": true}), signature) != nil {
		return errors.New("支付宝通知签名验证失败")
	}
	appID := s.setting(ctx, "payments.alipay.app_id", "")
	if form.Get("app_id") != "" && form.Get("app_id") != appID {
		return errors.New("支付宝应用编号不匹配")
	}
	status := form.Get("trade_status")
	if status != "TRADE_SUCCESS" && status != "TRADE_FINISHED" {
		return nil
	}
	amount, err := decimalToCents(form.Get("total_amount"))
	if err != nil {
		return err
	}
	orderNo := form.Get("out_trade_no")
	tradeNo := form.Get("trade_no")
	return s.Complete(ctx, Notification{Provider: "alipay", MerchantOrder: orderNo, ProviderReference: tradeNo, AmountCents: amount, Currency: "CNY"})
}

func canonicalValues(values url.Values, exclude map[string]bool) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		if exclude != nil && exclude[key] {
			continue
		}
		if values.Get(key) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+values.Get(key))
	}
	return strings.Join(parts, "&")
}
