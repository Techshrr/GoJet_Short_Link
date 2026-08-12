package main

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/Techshrr/GoJet_Short_Link/app/observability"
)

type paymentCallbackResponse struct {
	http.ResponseWriter
	status int
}

func (w *paymentCallbackResponse) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *paymentCallbackResponse) Write(payload []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(payload)
}

func (s *server) observePaymentCallback(provider string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		const maxObservedPayload = 2 << 20
		body, err := io.ReadAll(io.LimitReader(r.Body, maxObservedPayload+1))
		if err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "支付通知格式无效"})
			return
		}
		merchantOrder, providerReference := paymentCallbackMetadata(body)
		hash := sha256.Sum256(body)
		payloadHash := hex.EncodeToString(hash[:])

		if len(body) > maxObservedPayload {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			s.recordPaymentCallbackEvent(r, provider, merchantOrder, providerReference, payloadHash, "rejected", http.StatusRequestEntityTooLarge)
			return
		}

		r.Body = io.NopCloser(bytes.NewReader(body))
		captured := &paymentCallbackResponse{ResponseWriter: w}
		next(captured, r)
		status := captured.status
		if status == 0 {
			status = http.StatusOK
		}
		outcome := "accepted"
		if status >= http.StatusBadRequest {
			outcome = "rejected"
		}
		s.recordPaymentCallbackEvent(r, provider, merchantOrder, providerReference, payloadHash, outcome, status)
	}
}

func paymentCallbackMetadata(body []byte) (string, string) {
	if values, err := url.ParseQuery(string(body)); err == nil && len(values) > 0 {
		merchantOrder := firstCallbackValue(values, "out_trade_no", "merchant_order", "merchant_order_no", "custom_id")
		providerReference := firstCallbackValue(values, "trade_no", "provider_order_id", "transaction_id")
		if merchantOrder != "" || providerReference != "" {
			return merchantOrder, providerReference
		}
	}

	var document any
	if json.Unmarshal(body, &document) != nil {
		return "", ""
	}
	merchantOrder := findCallbackJSONValue(document, map[string]bool{
		"out_trade_no": true, "merchant_order": true, "merchant_order_no": true, "custom_id": true,
	})
	providerReference := findCallbackJSONValue(document, map[string]bool{
		"trade_no": true, "provider_order_id": true, "transaction_id": true, "id": true,
	})
	return merchantOrder, providerReference
}

func firstCallbackValue(values url.Values, keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(values.Get(key)); value != "" {
			return limitCallbackValue(value, 128)
		}
	}
	return ""
}

func findCallbackJSONValue(value any, keys map[string]bool) string {
	switch current := value.(type) {
	case map[string]any:
		for key, item := range current {
			if keys[strings.ToLower(key)] {
				if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
					return limitCallbackValue(strings.TrimSpace(text), 128)
				}
			}
		}
		for _, item := range current {
			if found := findCallbackJSONValue(item, keys); found != "" {
				return found
			}
		}
	case []any:
		for _, item := range current {
			if found := findCallbackJSONValue(item, keys); found != "" {
				return found
			}
		}
	}
	return ""
}

func limitCallbackValue(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}

func (s *server) recordPaymentCallbackEvent(r *http.Request, provider, merchantOrder, providerReference, payloadHash, outcome string, status int) {
	var transactionID, invoiceID sql.NullInt64
	if merchantOrder != "" {
		_ = s.db.QueryRowContext(r.Context(), `SELECT id,invoice_id FROM payment_transactions WHERE merchant_order_no=? LIMIT 1`, merchantOrder).Scan(&transactionID, &invoiceID)
	} else if providerReference != "" {
		_ = s.db.QueryRowContext(r.Context(), `SELECT id,invoice_id FROM payment_transactions WHERE provider=? AND provider_order_id=? ORDER BY id DESC LIMIT 1`, provider, providerReference).Scan(&transactionID, &invoiceID)
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO payment_callback_events(provider,request_id,merchant_order_no,provider_reference,transaction_id,invoice_id,payload_sha256,outcome,response_status,remote_ip) VALUES(?,?,?,?,?,?,?,?,?,?)`,
		provider,
		limitCallbackValue(observability.RequestID(r.Context()), 64),
		limitCallbackValue(merchantOrder, 64),
		limitCallbackValue(providerReference, 128),
		nullableCallbackID(transactionID),
		nullableCallbackID(invoiceID),
		payloadHash,
		outcome,
		status,
		limitCallbackValue(paymentCallbackRemoteIP(r), 64),
	)
}

func nullableCallbackID(value sql.NullInt64) any {
	if !value.Valid {
		return nil
	}
	return value.Int64
}

func paymentCallbackRemoteIP(r *http.Request) string {
	if value := strings.TrimSpace(r.Header.Get("X-Real-IP")); value != "" {
		return value
	}
	if value := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); value != "" {
		return value
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func (s *server) adminPaymentCallbacks(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 200 {
		limit = 200
	}

	rows, err := s.db.QueryContext(r.Context(), `SELECT id,provider,request_id,merchant_order_no,provider_reference,transaction_id,invoice_id,payload_sha256,outcome,response_status,remote_ip,created_at FROM payment_callback_events ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付回调记录暂时不可用"})
		return
	}
	defer rows.Close()

	data := make([]map[string]any, 0)
	for rows.Next() {
		var id int64
		var provider, requestID, merchantOrder, providerReference, payloadHash, outcome, remoteIP string
		var transactionID, invoiceID sql.NullInt64
		var responseStatus int
		var createdAt any
		if err = rows.Scan(&id, &provider, &requestID, &merchantOrder, &providerReference, &transactionID, &invoiceID, &payloadHash, &outcome, &responseStatus, &remoteIP, &createdAt); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付回调记录暂时不可用"})
			return
		}
		item := map[string]any{
			"id": id, "provider": provider, "request_id": requestID, "merchant_order_no": merchantOrder,
			"provider_reference": providerReference, "payload_sha256": payloadHash, "outcome": outcome,
			"response_status": responseStatus, "remote_ip": remoteIP, "created_at": createdAt,
		}
		if transactionID.Valid {
			item["transaction_id"] = transactionID.Int64
		}
		if invoiceID.Valid {
			item["invoice_id"] = invoiceID.Int64
		}
		data = append(data, item)
	}
	if err = rows.Err(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "支付回调记录暂时不可用"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": data})
}
