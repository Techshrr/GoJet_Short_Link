package payments

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func (s *Service) paypalBase(ctx context.Context) string {
	if strings.EqualFold(s.setting(ctx, "payments.paypal.environment", "sandbox"), "live") {
		return "https://api-m.paypal.com"
	}
	return "https://api-m.sandbox.paypal.com"
}

func (s *Service) paypalToken(ctx context.Context) (string, error) {
	clientID := s.setting(ctx, "payments.paypal.client_id", "")
	secret := s.setting(ctx, "payments.paypal.client_secret", "")
	if clientID == "" || secret == "" {
		return "", errors.New("PayPal 尚未配置")
	}
	form := url.Values{"grant_type": {"client_credentials"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.paypalBase(ctx)+"/v1/oauth2/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(clientID, secret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("PayPal 授权失败 (%d)", response.StatusCode)
	}
	var result struct{ AccessToken string `json:"access_token"` }
	if json.Unmarshal(body, &result) != nil || result.AccessToken == "" {
		return "", errors.New("PayPal 返回了无效的授权信息")
	}
	return result.AccessToken, nil
}

func (s *Service) createPayPal(ctx context.Context, payment invoicePayment) (createResult, error) {
	token, err := s.paypalToken(ctx)
	if err != nil {
		return createResult{}, err
	}
	returnURL := s.baseURL + "/api/payments/paypal/return?merchant_order=" + url.QueryEscape(payment.OrderNo)
	cancelURL := s.baseURL + "/app/billing?payment=cancelled"
	payload := map[string]any{
		"intent": "CAPTURE",
		"purchase_units": []any{map[string]any{
			"reference_id": payment.OrderNo,
			"custom_id": payment.OrderNo,
			"description": "GoJet " + payment.Invoice.PlanName + " · " + payment.Invoice.InvoiceNumber,
			"amount": map[string]string{"currency_code": strings.ToUpper(payment.Invoice.Currency), "value": moneyDecimal(payment.Invoice.AmountCents)},
		}},
		"application_context": map[string]any{"brand_name": "GoJet", "shipping_preference": "NO_SHIPPING", "user_action": "PAY_NOW", "return_url": returnURL, "cancel_url": cancelURL},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.paypalBase(ctx)+"/v2/checkout/orders", bytes.NewReader(body))
	if err != nil {
		return createResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("PayPal-Request-Id", payment.OrderNo)
	response, err := s.client.Do(req)
	if err != nil {
		return createResult{}, err
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return createResult{}, fmt.Errorf("PayPal 创建支付失败 (%d)", response.StatusCode)
	}
	var result struct {
		ID    string `json:"id"`
		Links []struct{ Href, Rel string } `json:"links"`
	}
	if json.Unmarshal(responseBody, &result) != nil || result.ID == "" {
		return createResult{}, errors.New("PayPal 返回了无效订单")
	}
	approve := ""
	for _, link := range result.Links {
		if link.Rel == "approve" || link.Rel == "payer-action" {
			approve = link.Href
			break
		}
	}
	if approve == "" {
		return createResult{}, errors.New("PayPal 未返回付款地址")
	}
	return createResult{ProviderOrderID: result.ID, RedirectURL: approve, Payload: map[string]string{"order_id": result.ID}}, nil
}

func (s *Service) CompletePayPalReturn(ctx context.Context, merchantOrder, orderID string) error {
	merchantOrder = strings.TrimSpace(merchantOrder)
	orderID = strings.TrimSpace(orderID)
	if merchantOrder == "" || orderID == "" {
		return errors.New("PayPal 返回参数不完整")
	}
	var expectedOrder string
	if err := s.db.QueryRowContext(ctx, `SELECT COALESCE(provider_order_id,'') FROM payment_transactions WHERE provider='paypal' AND merchant_order_no=?`, merchantOrder).Scan(&expectedOrder); err != nil || expectedOrder != orderID {
		return errors.New("PayPal 订单不匹配")
	}
	token, err := s.paypalToken(ctx)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.paypalBase(ctx)+"/v2/checkout/orders/"+url.PathEscape(orderID)+"/capture", bytes.NewReader([]byte(`{}`)))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("PayPal-Request-Id", merchantOrder+"-capture")
	response, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("PayPal 确认支付失败 (%d)", response.StatusCode)
	}
	var result struct {
		ID string `json:"id"`
		Status string `json:"status"`
		PurchaseUnits []struct {
			ReferenceID string `json:"reference_id"`
			Payments struct {
				Captures []struct {
					ID string `json:"id"`
					Status string `json:"status"`
					Amount struct{ CurrencyCode, Value string } `json:"amount"`
				} `json:"captures"`
			} `json:"payments"`
		} `json:"purchase_units"`
	}
	if json.Unmarshal(body, &result) != nil || len(result.PurchaseUnits) == 0 || len(result.PurchaseUnits[0].Payments.Captures) == 0 {
		return errors.New("PayPal 支付结果无效")
	}
	capture := result.PurchaseUnits[0].Payments.Captures[0]
	if capture.Status != "COMPLETED" || result.PurchaseUnits[0].ReferenceID != merchantOrder {
		return errors.New("PayPal 支付尚未完成")
	}
	cents, err := decimalToCents(capture.Amount.Value)
	if err != nil {
		return err
	}
	return s.Complete(ctx, Notification{Provider: "paypal", MerchantOrder: merchantOrder, ProviderReference: capture.ID, AmountCents: cents, Currency: capture.Amount.CurrencyCode})
}

func (s *Service) HandlePayPalWebhook(ctx context.Context, body []byte, headers http.Header) error {
	webhookID := s.setting(ctx, "payments.paypal.webhook_id", "")
	if webhookID == "" {
		return errors.New("PayPal Webhook 尚未配置")
	}
	token, err := s.paypalToken(ctx)
	if err != nil {
		return err
	}
	var event any
	if err = json.Unmarshal(body, &event); err != nil {
		return errors.New("PayPal 通知内容无效")
	}
	verifyPayload := map[string]any{
		"auth_algo": headers.Get("PayPal-Auth-Algo"),
		"cert_url": headers.Get("PayPal-Cert-Url"),
		"transmission_id": headers.Get("PayPal-Transmission-Id"),
		"transmission_sig": headers.Get("PayPal-Transmission-Sig"),
		"transmission_time": headers.Get("PayPal-Transmission-Time"),
		"webhook_id": webhookID,
		"webhook_event": event,
	}
	verifyBody, _ := json.Marshal(verifyPayload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.paypalBase(ctx)+"/v1/notifications/verify-webhook-signature", bytes.NewReader(verifyBody))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	response, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	verifiedBody, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	var verified struct{ VerificationStatus string `json:"verification_status"` }
	if response.StatusCode < 200 || response.StatusCode >= 300 || json.Unmarshal(verifiedBody, &verified) != nil || verified.VerificationStatus != "SUCCESS" {
		return errors.New("PayPal 通知签名验证失败")
	}
	var webhook struct {
		EventType string `json:"event_type"`
		Resource struct {
			ID string `json:"id"`
			Status string `json:"status"`
			Amount struct{ CurrencyCode, Value string } `json:"amount"`
			SupplementaryData struct { RelatedIDs struct { OrderID string `json:"order_id"` } `json:"related_ids"` } `json:"supplementary_data"`
		} `json:"resource"`
	}
	if json.Unmarshal(body, &webhook) != nil || webhook.EventType != "PAYMENT.CAPTURE.COMPLETED" || webhook.Resource.Status != "COMPLETED" {
		return nil
	}
	orderID := webhook.Resource.SupplementaryData.RelatedIDs.OrderID
	if orderID == "" {
		return nil
	}
	var merchantOrder string
	if err = s.db.QueryRowContext(ctx, `SELECT merchant_order_no FROM payment_transactions WHERE provider='paypal' AND provider_order_id=?`, orderID).Scan(&merchantOrder); err != nil {
		return err
	}
	cents, err := decimalToCents(webhook.Resource.Amount.Value)
	if err != nil {
		return err
	}
	return s.Complete(ctx, Notification{Provider: "paypal", MerchantOrder: merchantOrder, ProviderReference: webhook.Resource.ID, AmountCents: cents, Currency: webhook.Resource.Amount.CurrencyCode})
}

func decimalToCents(value string) (int64, error) {
	parts := strings.Split(strings.TrimSpace(value), ".")
	if len(parts) > 2 || len(parts) == 0 {
		return 0, errors.New("支付金额格式无效")
	}
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || whole < 0 {
		return 0, errors.New("支付金额格式无效")
	}
	fraction := "00"
	if len(parts) == 2 {
		fraction = parts[1]
		if len(fraction) == 1 { fraction += "0" }
		if len(fraction) != 2 { return 0, errors.New("支付金额精度无效") }
	}
	minor, err := strconv.ParseInt(fraction, 10, 64)
	if err != nil || minor < 0 {
		return 0, errors.New("支付金额格式无效")
	}
	return whole*100 + minor, nil
}
