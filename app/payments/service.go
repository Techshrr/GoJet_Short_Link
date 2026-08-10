package payments

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/billing"
	"github.com/Techshrr/GoJet_Short_Link/app/settings"
)

type Service struct {
	db       *sql.DB
	settings *settings.Store
	billing  *billing.Service
	client   *http.Client
	baseURL  string
}

type Method struct {
	Code    string `json:"code"`
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
	Mode    string `json:"mode"`
}

type Checkout struct {
	TransactionID int64  `json:"transaction_id"`
	Provider      string `json:"provider"`
	ProviderName  string `json:"provider_name"`
	Mode          string `json:"mode"`
	RedirectURL   string `json:"redirect_url,omitempty"`
	QRContent     string `json:"qr_content,omitempty"`
	MerchantOrder string `json:"merchant_order_no"`
}

type createResult struct {
	ProviderOrderID string
	RedirectURL     string
	QRContent       string
	Payload         any
}

type invoicePayment struct {
	Invoice billing.Invoice
	OrderNo string
}

func New(db *sql.DB, store *settings.Store, billingService *billing.Service, baseURL string) *Service {
	return &Service{
		db: db, settings: store, billing: billingService,
		client: &http.Client{Timeout: 15 * time.Second},
		baseURL: strings.TrimRight(baseURL, "/"),
	}
}

func (s *Service) Methods(ctx context.Context) ([]Method, error) {
	master, _, err := s.boolSetting(ctx, "payments.enabled")
	if err != nil {
		return nil, err
	}
	defs := []Method{
		{Code: "alipay", Name: "支付宝", Mode: "redirect"},
		{Code: "wechat", Name: "微信支付", Mode: "qr"},
		{Code: "epay", Name: "易支付兼容协议", Mode: "redirect"},
		{Code: "paypal", Name: "PayPal", Mode: "redirect"},
		{Code: "stripe", Name: "Stripe", Mode: "redirect"},
	}
	for i := range defs {
		enabled, exists, e := s.boolSetting(ctx, "payments."+defs[i].Code+".enabled")
		if e != nil {
			return nil, e
		}
		defs[i].Enabled = master && exists && enabled && s.providerConfigured(ctx, defs[i].Code)
	}
	return defs, nil
}

func (s *Service) EnabledMethods(ctx context.Context) ([]Method, error) {
	methods, err := s.Methods(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Method, 0, len(methods))
	for _, method := range methods {
		if method.Enabled {
			out = append(out, method)
		}
	}
	return out, nil
}

func (s *Service) CreateCheckout(ctx context.Context, userID, workspaceID, invoiceID int64, provider string) (Checkout, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if !s.providerConfigured(ctx, provider) {
		return Checkout{}, errors.New("所选支付方式尚未配置")
	}
	methods, err := s.EnabledMethods(ctx)
	if err != nil {
		return Checkout{}, err
	}
	var method Method
	for _, candidate := range methods {
		if candidate.Code == provider {
			method = candidate
			break
		}
	}
	if method.Code == "" {
		return Checkout{}, errors.New("所选支付方式当前不可用")
	}
	invoice, err := s.billing.InvoiceForPayment(ctx, userID, workspaceID, invoiceID)
	if err != nil {
		return Checkout{}, err
	}
	if invoice.Status != "pending" && invoice.Status != "overdue" {
		return Checkout{}, errors.New("当前账单无需支付")
	}
	if invoice.AmountCents <= 0 {
		return Checkout{}, errors.New("金额为零的账单无需在线支付")
	}
	orderNo, err := merchantOrderNumber()
	if err != nil {
		return Checkout{}, err
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO payment_transactions(invoice_id,workspace_id,provider,merchant_order_no,amount_cents,currency,status) VALUES(?,?,?,?,?,?,'created')`, invoice.ID, workspaceID, provider, orderNo, invoice.AmountCents, strings.ToUpper(invoice.Currency))
	if err != nil {
		return Checkout{}, err
	}
	transactionID, _ := result.LastInsertId()
	payment := invoicePayment{Invoice: invoice, OrderNo: orderNo}
	created, err := s.createProviderCheckout(ctx, provider, payment)
	if err != nil {
		_, _ = s.db.ExecContext(ctx, `UPDATE payment_transactions SET status='failed',failure_reason=? WHERE id=?`, trimFailure(err.Error()), transactionID)
		return Checkout{}, err
	}
	payload, _ := json.Marshal(created.Payload)
	_, err = s.db.ExecContext(ctx, `UPDATE payment_transactions SET status='pending',provider_order_id=NULLIF(?,''),checkout_url=NULLIF(?,''),qr_content=NULLIF(?,''),provider_payload=? WHERE id=?`, created.ProviderOrderID, created.RedirectURL, created.QRContent, payload, transactionID)
	if err != nil {
		return Checkout{}, err
	}
	return Checkout{TransactionID: transactionID, Provider: provider, ProviderName: method.Name, Mode: method.Mode, RedirectURL: created.RedirectURL, QRContent: created.QRContent, MerchantOrder: orderNo}, nil
}

func (s *Service) createProviderCheckout(ctx context.Context, provider string, payment invoicePayment) (createResult, error) {
	switch provider {
	case "stripe":
		return s.createStripe(ctx, payment)
	case "paypal":
		return s.createPayPal(ctx, payment)
	case "wechat":
		return s.createWeChat(ctx, payment)
	case "alipay":
		return s.createAlipay(ctx, payment)
	case "epay":
		return s.createEPay(ctx, payment)
	default:
		return createResult{}, errors.New("不支持的支付方式")
	}
}

func (s *Service) providerConfigured(ctx context.Context, provider string) bool {
	required := map[string][]string{
		"alipay": {"payments.alipay.app_id", "payments.alipay.private_key", "payments.alipay.public_key"},
		"wechat": {"payments.wechat.app_id", "payments.wechat.mch_id", "payments.wechat.mch_serial_no", "payments.wechat.private_key", "payments.wechat.api_v3_key", "payments.wechat.platform_public_key"},
		"epay": {"payments.epay.gateway", "payments.epay.pid", "payments.epay.key"},
		"paypal": {"payments.paypal.client_id", "payments.paypal.client_secret"},
		"stripe": {"payments.stripe.secret_key", "payments.stripe.webhook_secret"},
	}
	keys, ok := required[provider]
	if !ok {
		return false
	}
	for _, key := range keys {
		value, exists, err := s.settings.Get(ctx, key)
		if err != nil || !exists || strings.TrimSpace(value) == "" {
			return false
		}
	}
	return true
}

func (s *Service) setting(ctx context.Context, key, fallback string) string {
	value, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists || strings.TrimSpace(value) == "" {
		return fallback
	}
	var decoded string
	if json.Unmarshal([]byte(value), &decoded) == nil {
		return decoded
	}
	return value
}

func (s *Service) boolSetting(ctx context.Context, key string) (bool, bool, error) {
	value, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists {
		return false, exists, err
	}
	var flag bool
	if json.Unmarshal([]byte(value), &flag) == nil {
		return flag, true, nil
	}
	return strings.EqualFold(strings.TrimSpace(value), "true"), true, nil
}

func merchantOrderNumber() (string, error) {
	var random [10]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", err
	}
	return "GJ" + time.Now().UTC().Format("060102") + strings.ToUpper(hex.EncodeToString(random[:])), nil
}

func trimFailure(value string) string {
	value = strings.TrimSpace(value)
	if len([]rune(value)) <= 255 {
		return value
	}
	return string([]rune(value)[:255])
}

func moneyDecimal(cents int64) string { return fmt.Sprintf("%d.%02d", cents/100, cents%100) }
