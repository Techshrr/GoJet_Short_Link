package main

import (
	"database/sql"
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type adminPaymentItem struct {
	ID               int64  `json:"id"`
	InvoiceID        int64  `json:"invoice_id"`
	WorkspaceID      int64  `json:"workspace_id"`
	OwnerEmail       string `json:"owner_email"`
	Provider         string `json:"provider"`
	MerchantOrderNo  string `json:"merchant_order_no"`
	ProviderOrderID  string `json:"provider_order_id"`
	AmountCents      int64  `json:"amount_cents"`
	Currency         string `json:"currency"`
	Status           string `json:"status"`
	FailureReason    string `json:"failure_reason,omitempty"`
	PaidAt           string `json:"paid_at,omitempty"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

func scanAdminPayment(scanner interface{ Scan(...any) error }, item *adminPaymentItem) error {
	var paid sql.NullTime
	var created, updated time.Time
	if err := scanner.Scan(&item.ID, &item.InvoiceID, &item.WorkspaceID, &item.OwnerEmail, &item.Provider, &item.MerchantOrderNo, &item.ProviderOrderID, &item.AmountCents, &item.Currency, &item.Status, &item.FailureReason, &paid, &created, &updated); err != nil {
		return err
	}
	item.CreatedAt = created.UTC().Format(time.RFC3339)
	item.UpdatedAt = updated.UTC().Format(time.RFC3339)
	if paid.Valid {
		item.PaidAt = paid.Time.UTC().Format(time.RFC3339)
	}
	return nil
}

const adminPaymentSelect = `SELECT t.id,t.invoice_id,t.workspace_id,COALESCE(u.email,''),t.provider,t.merchant_order_no,COALESCE(t.provider_order_id,''),t.amount_cents,t.currency,t.status,COALESCE(t.failure_reason,''),t.paid_at,t.created_at,t.updated_at FROM payment_transactions t LEFT JOIN workspace_members wm ON wm.workspace_id=t.workspace_id AND wm.role='owner' AND wm.status='active' LEFT JOIN users u ON u.id=wm.user_id`

func (s *server) adminPayments(w http.ResponseWriter, r *http.Request) {
	limit, offset := page(r)
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	provider := strings.TrimSpace(r.URL.Query().Get("provider"))
	query := adminPaymentSelect + ` WHERE (?='' OR t.status=?) AND (?='' OR t.provider=?) ORDER BY t.id DESC LIMIT ? OFFSET ?`
	rows, err := s.db.QueryContext(r.Context(), query, status, status, provider, provider, limit, offset)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付交易暂时不可用"})
		return
	}
	defer rows.Close()
	items := make([]adminPaymentItem, 0)
	for rows.Next() {
		var item adminPaymentItem
		if err = scanAdminPayment(rows, &item); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付交易暂时不可用"})
			return
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付交易暂时不可用"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}

func (s *server) adminPaymentDetail(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "支付交易编号无效"})
		return
	}
	var item adminPaymentItem
	if err = scanAdminPayment(s.db.QueryRowContext(r.Context(), adminPaymentSelect+` WHERE t.id=?`, id), &item); err != nil {
		if err == sql.ErrNoRows {
			jsonResponse(w, http.StatusNotFound, map[string]string{"error": "支付交易不存在"})
			return
		}
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付交易暂时不可用"})
		return
	}
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,provider,request_id,merchant_order_no,provider_reference,payload_sha256,outcome,response_status,remote_ip,created_at FROM payment_callback_events WHERE transaction_id=? OR invoice_id=? ORDER BY id DESC LIMIT 100`, item.ID, item.InvoiceID)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付回调记录暂时不可用"})
		return
	}
	defer rows.Close()
	callbacks := make([]map[string]any, 0)
	for rows.Next() {
		var callbackID int64
		var callbackProvider, requestID, merchantOrder, providerReference, payloadHash, outcome, remoteIP string
		var responseStatus int
		var created time.Time
		if err = rows.Scan(&callbackID, &callbackProvider, &requestID, &merchantOrder, &providerReference, &payloadHash, &outcome, &responseStatus, &remoteIP, &created); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付回调记录暂时不可用"})
			return
		}
		callbacks = append(callbacks, map[string]any{
			"id": callbackID, "provider": callbackProvider, "request_id": requestID,
			"merchant_order_no": merchantOrder, "provider_reference": providerReference,
			"payload_sha256": payloadHash, "outcome": outcome, "response_status": responseStatus,
			"remote_ip": remoteIP, "created_at": created.UTC().Format(time.RFC3339),
		})
	}
	jsonResponse(w, http.StatusOK, map[string]any{"payment": item, "callbacks": callbacks, "payload_redacted": true})
}

func parseSettingInt(raw string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return value
}

func (s *server) adminFX(w http.ResponseWriter, r *http.Request) {
	settlement, _, err := s.settings.Get(r.Context(), "billing.settlement_currency")
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "FX 配置暂时不可用"})
		return
	}
	provider, _, _ := s.settings.Get(r.Context(), "billing.fx.provider")
	markupRaw, _, _ := s.settings.Get(r.Context(), "billing.fx.markup_bps")
	cacheRaw, _, _ := s.settings.Get(r.Context(), "billing.fx.cache_hours")
	manualRaw, _, _ := s.settings.Get(r.Context(), "billing.fx.manual_rates")
	manualRates := map[string]string{}
	_ = json.Unmarshal([]byte(manualRaw), &manualRates)

	rows, err := s.db.QueryContext(r.Context(), `SELECT base_currency,quote_currency,provider,CAST(rate AS CHAR),observed_at,expires_at FROM fx_rate_cache ORDER BY observed_at DESC LIMIT 100`)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "FX 汇率缓存暂时不可用"})
		return
	}
	cache := make([]map[string]any, 0)
	for rows.Next() {
		var base, quote, source, rate string
		var observed, expires time.Time
		if rows.Scan(&base, &quote, &source, &rate, &observed, &expires) == nil {
			cache = append(cache, map[string]any{"base_currency": base, "quote_currency": quote, "provider": source, "rate": rate, "observed_at": observed.UTC().Format(time.RFC3339), "expires_at": expires.UTC().Format(time.RFC3339)})
		}
	}
	rows.Close()

	historyRows, err := s.db.QueryContext(r.Context(), `SELECT invoice_number,source_currency,currency,CAST(fx_rate AS CHAR),fx_provider,fx_markup_bps,fx_quoted_at,created_at FROM billing_invoices WHERE fx_quoted_at IS NOT NULL ORDER BY id DESC LIMIT 100`)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "FX 历史暂时不可用"})
		return
	}
	defer historyRows.Close()
	history := make([]map[string]any, 0)
	for historyRows.Next() {
		var invoice, sourceCurrency, currency, rate, fxProvider string
		var markup int
		var quoted sql.NullTime
		var created time.Time
		if historyRows.Scan(&invoice, &sourceCurrency, &currency, &rate, &fxProvider, &markup, &quoted, &created) == nil {
			history = append(history, map[string]any{"invoice_number": invoice, "source_currency": sourceCurrency, "currency": currency, "rate": rate, "provider": fxProvider, "markup_bps": markup, "quoted_at": nullableTime(quoted), "created_at": created.UTC().Format(time.RFC3339)})
		}
	}

	jsonResponse(w, http.StatusOK, map[string]any{
		"settlement_currency": strings.ToUpper(strings.TrimSpace(settlement)),
		"provider": strings.ToLower(strings.TrimSpace(provider)),
		"markup_bps": parseSettingInt(markupRaw, 0),
		"cache_hours": parseSettingInt(cacheRaw, 24),
		"manual_rates": manualRates,
		"rates": cache,
		"history": history,
	})
}

func normalizeManualRates(input map[string]string) (map[string]string, error) {
	out := make(map[string]string, len(input))
	for rawPair, rawRate := range input {
		pair := strings.ToUpper(strings.TrimSpace(rawPair))
		rateText := strings.TrimSpace(rawRate)
		if len(pair) != 7 || !strings.HasPrefix(pair, "USD/") {
			return nil, &commerceValidationError{"手动汇率必须使用 USD/XXX 格式"}
		}
		rate, ok := new(big.Rat).SetString(rateText)
		if !ok || rate.Sign() <= 0 {
			return nil, &commerceValidationError{"手动汇率必须大于 0"}
		}
		out[pair] = rate.FloatString(12)
	}
	return out, nil
}

type commerceValidationError struct{ message string }
func (e *commerceValidationError) Error() string { return e.message }

func (s *server) adminUpdateFX(w http.ResponseWriter, r *http.Request) {
	var in struct {
		SettlementCurrency string            `json:"settlement_currency"`
		Provider           string            `json:"provider"`
		MarkupBPS          int               `json:"markup_bps"`
		CacheHours         int               `json:"cache_hours"`
		ManualRates        map[string]string `json:"manual_rates"`
		Reason             string            `json:"reason"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	in.SettlementCurrency = strings.ToUpper(strings.TrimSpace(in.SettlementCurrency))
	in.Provider = strings.ToLower(strings.TrimSpace(in.Provider))
	in.Reason = strings.TrimSpace(in.Reason)
	if in.SettlementCurrency != "" && len(in.SettlementCurrency) != 3 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "结算币种必须是三位币种代码"})
		return
	}
	if in.Provider != "ecb" && in.Provider != "manual" {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "FX provider 仅支持 ecb 或 manual"})
		return
	}
	if in.MarkupBPS < -1000 || in.MarkupBPS > 5000 || in.CacheHours < 1 || in.CacheHours > 168 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "FX markup 或缓存时长超出允许范围"})
		return
	}
	if in.Reason == "" || len(in.Reason) > 500 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "手工修改 FX 配置必须填写 1-500 字原因"})
		return
	}
	rates, err := normalizeManualRates(in.ManualRates)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	encodedRates, err := json.Marshal(rates)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "手动汇率格式无效"})
		return
	}
	updates := map[string]string{
		"billing.settlement_currency": in.SettlementCurrency,
		"billing.fx.provider": in.Provider,
		"billing.fx.markup_bps": strconv.Itoa(in.MarkupBPS),
		"billing.fx.cache_hours": strconv.Itoa(in.CacheHours),
		"billing.fx.manual_rates": string(encodedRates),
	}
	for key, value := range updates {
		if err = s.settings.Set(r.Context(), key, value, false); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "FX 配置保存失败"})
			return
		}
	}
	_, _ = s.db.ExecContext(r.Context(), `DELETE FROM fx_rate_cache`)
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.fx_updated','fx',0,JSON_OBJECT('administrator_id',?,'reason',?,'provider',?,'settlement_currency',?,'markup_bps',?,'cache_hours',?))`, currentAdmin(r).ID, in.Reason, in.Provider, in.SettlementCurrency, in.MarkupBPS, in.CacheHours)
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
}
