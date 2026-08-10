package payments

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const wechatNativePath = "/v3/pay/transactions/native"

func (s *Service) createWeChat(ctx context.Context, payment invoicePayment) (createResult, error) {
	if !strings.EqualFold(payment.Invoice.Currency, "CNY") {
		return createResult{}, errors.New("微信支付当前仅支持人民币账单")
	}
	appID := s.setting(ctx, "payments.wechat.app_id", "")
	mchID := s.setting(ctx, "payments.wechat.mch_id", "")
	serial := s.setting(ctx, "payments.wechat.mch_serial_no", "")
	privateKey, err := parseRSAPrivateKey(s.setting(ctx, "payments.wechat.private_key", ""))
	if err != nil || appID == "" || mchID == "" || serial == "" {
		return createResult{}, errors.New("微信支付尚未正确配置")
	}
	payload := map[string]any{
		"appid": appID,
		"mchid": mchID,
		"description": "GoJet " + payment.Invoice.PlanName,
		"out_trade_no": payment.OrderNo,
		"notify_url": s.baseURL + "/api/payments/wechat/notify",
		"amount": map[string]any{"total": payment.Invoice.AmountCents, "currency": "CNY"},
	}
	body, _ := json.Marshal(payload)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	nonce, err := randomHex(16)
	if err != nil {
		return createResult{}, err
	}
	message := http.MethodPost + "\n" + wechatNativePath + "\n" + timestamp + "\n" + nonce + "\n" + string(body) + "\n"
	signature, err := rsaSHA256Sign(privateKey, message)
	if err != nil {
		return createResult{}, err
	}
	authorization := `WECHATPAY2-SHA256-RSA2048 mchid="` + mchID + `",nonce_str="` + nonce + `",timestamp="` + timestamp + `",serial_no="` + serial + `",signature="` + signature + `"`
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.mch.weixin.qq.com"+wechatNativePath, bytes.NewReader(body))
	if err != nil {
		return createResult{}, err
	}
	req.Header.Set("Authorization", authorization)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	response, err := s.client.Do(req)
	if err != nil {
		return createResult{}, err
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return createResult{}, fmt.Errorf("微信支付创建订单失败 (%d)", response.StatusCode)
	}
	var result struct{ CodeURL string `json:"code_url"` }
	if json.Unmarshal(responseBody, &result) != nil || result.CodeURL == "" {
		return createResult{}, errors.New("微信支付未返回付款二维码")
	}
	return createResult{QRContent: result.CodeURL, Payload: map[string]string{"out_trade_no": payment.OrderNo}}, nil
}

func (s *Service) HandleWeChatNotification(ctx context.Context, body []byte, headers http.Header, now time.Time) error {
	timestamp := strings.TrimSpace(headers.Get("Wechatpay-Timestamp"))
	nonce := strings.TrimSpace(headers.Get("Wechatpay-Nonce"))
	signature := strings.TrimSpace(headers.Get("Wechatpay-Signature"))
	serial := strings.TrimSpace(headers.Get("Wechatpay-Serial"))
	if timestamp == "" || nonce == "" || signature == "" || serial == "" {
		return errors.New("微信支付通知签名信息不完整")
	}
	unixTime, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || now.Unix()-unixTime > 300 || now.Unix()-unixTime < -300 {
		return errors.New("微信支付通知时间戳无效")
	}
	expectedSerial := strings.TrimSpace(s.setting(ctx, "payments.wechat.platform_serial_no", ""))
	if expectedSerial != "" && !strings.EqualFold(expectedSerial, serial) {
		return errors.New("微信支付平台公钥编号不匹配")
	}
	publicKey, err := parseRSAPublicKey(s.setting(ctx, "payments.wechat.platform_public_key", ""))
	if err != nil {
		return errors.New("微信支付平台公钥配置无效")
	}
	message := timestamp + "\n" + nonce + "\n" + string(body) + "\n"
	if err = rsaSHA256Verify(publicKey, message, signature); err != nil {
		return errors.New("微信支付通知签名验证失败")
	}
	var envelope struct {
		EventType string `json:"event_type"`
		Resource struct {
			Algorithm      string `json:"algorithm"`
			Ciphertext     string `json:"ciphertext"`
			AssociatedData string `json:"associated_data"`
			Nonce          string `json:"nonce"`
		} `json:"resource"`
	}
	if json.Unmarshal(body, &envelope) != nil || envelope.Resource.Algorithm != "AEAD_AES_256_GCM" {
		return errors.New("微信支付通知内容无效")
	}
	plain, err := decryptWeChatResource(s.setting(ctx, "payments.wechat.api_v3_key", ""), envelope.Resource.Nonce, envelope.Resource.AssociatedData, envelope.Resource.Ciphertext)
	if err != nil {
		return errors.New("微信支付通知解密失败")
	}
	var result struct {
		AppID         string `json:"appid"`
		MchID         string `json:"mchid"`
		OutTradeNo    string `json:"out_trade_no"`
		TransactionID string `json:"transaction_id"`
		TradeState    string `json:"trade_state"`
		Amount struct {
			Total    int64  `json:"total"`
			Currency string `json:"currency"`
		} `json:"amount"`
	}
	if json.Unmarshal(plain, &result) != nil {
		return errors.New("微信支付订单内容无效")
	}
	if result.AppID != s.setting(ctx, "payments.wechat.app_id", "") || result.MchID != s.setting(ctx, "payments.wechat.mch_id", "") {
		return errors.New("微信支付商户信息不匹配")
	}
	if result.TradeState != "SUCCESS" {
		return nil
	}
	return s.Complete(ctx, Notification{Provider: "wechat", MerchantOrder: result.OutTradeNo, ProviderReference: result.TransactionID, AmountCents: result.Amount.Total, Currency: result.Amount.Currency})
}

func decryptWeChatResource(apiV3Key, nonce, associatedData, ciphertext string) ([]byte, error) {
	key := []byte(apiV3Key)
	if len(key) != 32 {
		return nil, errors.New("APIv3 密钥长度必须为 32 字节")
	}
	decoded, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, []byte(nonce), decoded, []byte(associatedData))
}

func randomHex(size int) (string, error) {
	buffer := make([]byte, size)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}
