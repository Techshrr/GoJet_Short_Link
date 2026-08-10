package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func (s *Service) createStripe(ctx context.Context, payment invoicePayment) (createResult, error) {
	secret := s.setting(ctx, "payments.stripe.secret_key", "")
	if secret == "" {
		return createResult{}, errors.New("Stripe 尚未配置")
	}
	currency := strings.ToLower(payment.Invoice.Currency)
	returnURL := s.baseURL + "/app/billing?payment=success"
	cancelURL := s.baseURL + "/app/billing?payment=cancelled"
	form := url.Values{}
	form.Set("mode", "payment")
	form.Set("client_reference_id", payment.OrderNo)
	form.Set("success_url", returnURL)
	form.Set("cancel_url", cancelURL)
	form.Set("line_items[0][price_data][currency]", currency)
	form.Set("line_items[0][price_data][unit_amount]", strconv.FormatInt(payment.Invoice.AmountCents, 10))
	form.Set("line_items[0][price_data][product_data][name]", "GoJet "+payment.Invoice.PlanName)
	form.Set("line_items[0][price_data][product_data][description]", "账单 "+payment.Invoice.InvoiceNumber)
	form.Set("line_items[0][quantity]", "1")
	form.Set("metadata[merchant_order_no]", payment.OrderNo)
	form.Set("metadata[invoice_number]", payment.Invoice.InvoiceNumber)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.stripe.com/v1/checkout/sessions", strings.NewReader(form.Encode()))
	if err != nil {
		return createResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+secret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := s.client.Do(req)
	if err != nil {
		return createResult{}, err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return createResult{}, fmt.Errorf("Stripe 创建支付失败 (%d)", response.StatusCode)
	}
	var result struct {
		ID  string `json:"id"`
		URL string `json:"url"`
	}
	if json.Unmarshal(body, &result) != nil || result.ID == "" || result.URL == "" {
		return createResult{}, errors.New("Stripe 返回了无效的支付会话")
	}
	return createResult{ProviderOrderID: result.ID, RedirectURL: result.URL, Payload: map[string]string{"session_id": result.ID}}, nil
}

func (s *Service) HandleStripeWebhook(ctx context.Context, body []byte, signatureHeader string, now time.Time) error {
	secret := s.setting(ctx, "payments.stripe.webhook_secret", "")
	if secret == "" {
		return errors.New("Stripe Webhook 尚未配置")
	}
	timestamp, signatures, err := parseStripeSignature(signatureHeader)
	if err != nil {
		return err
	}
	if delta := now.Unix() - timestamp; delta > 300 || delta < -300 {
		return errors.New("Stripe 通知时间戳超出允许范围")
	}
	message := strconv.FormatInt(timestamp, 10) + "." + string(body)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(message))
	expected := mac.Sum(nil)
	verified := false
	for _, candidate := range signatures {
		decoded, err := hex.DecodeString(candidate)
		if err == nil && hmac.Equal(decoded, expected) {
			verified = true
			break
		}
	}
	if !verified {
		return errors.New("Stripe 通知签名验证失败")
	}
	var event struct {
		Type string `json:"type"`
		Data struct {
			Object struct {
				ID                string `json:"id"`
				ClientReferenceID string `json:"client_reference_id"`
				PaymentStatus     string `json:"payment_status"`
				AmountTotal       int64  `json:"amount_total"`
				Currency          string `json:"currency"`
				Metadata          map[string]string `json:"metadata"`
			} `json:"object"`
		} `json:"data"`
	}
	if err = json.Unmarshal(body, &event); err != nil {
		return errors.New("Stripe 通知内容无效")
	}
	if event.Type != "checkout.session.completed" && event.Type != "checkout.session.async_payment_succeeded" {
		return nil
	}
	object := event.Data.Object
	if object.PaymentStatus != "paid" {
		return nil
	}
	orderNo := object.ClientReferenceID
	if orderNo == "" {
		orderNo = object.Metadata["merchant_order_no"]
	}
	return s.Complete(ctx, Notification{Provider: "stripe", MerchantOrder: orderNo, ProviderReference: object.ID, AmountCents: object.AmountTotal, Currency: strings.ToUpper(object.Currency)})
}

func parseStripeSignature(header string) (int64, []string, error) {
	var timestamp int64
	var signatures []string
	for _, part := range strings.Split(header, ",") {
		pair := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(pair) != 2 {
			continue
		}
		switch pair[0] {
		case "t":
			timestamp, _ = strconv.ParseInt(pair[1], 10, 64)
		case "v1":
			signatures = append(signatures, pair[1])
		}
	}
	if timestamp == 0 || len(signatures) == 0 {
		return 0, nil, errors.New("Stripe 通知签名格式无效")
	}
	return timestamp, signatures, nil
}
