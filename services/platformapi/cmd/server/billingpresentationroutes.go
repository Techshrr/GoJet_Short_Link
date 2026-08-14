package main

import (
	"net/http"

	qrcode "github.com/skip2/go-qrcode"
)

func (s *server) registerBillingPresentationRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/plans", s.publicPlans)
	mux.HandleFunc("GET /api/workspaces/{id}/billing/invoices/{invoice}/pdf", s.user(s.invoicePDF))
	mux.HandleFunc("GET /api/workspaces/{id}/billing/payments/{payment}/qr.png", s.user(s.paymentQRPNG))
}

func (s *server) publicPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := s.billing.Plans(r.Context(), false)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "套餐信息暂时不可用"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": plans})
}

func (s *server) paymentQRPNG(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	paymentID, e2 := pathID(r, "payment")
	if e1 != nil || e2 != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "支付记录编号无效"})
		return
	}
	if _, err := s.workspace.Role(r.Context(), wid, currentUser(r).ID); err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无权查看该支付二维码"})
		return
	}
	var qrContent, status string
	if err := s.db.QueryRowContext(r.Context(), `SELECT COALESCE(qr_content,''),status FROM payment_transactions WHERE id=? AND workspace_id=?`, paymentID, wid).Scan(&qrContent, &status); err != nil || qrContent == "" {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "支付二维码不存在"})
		return
	}
	if status != "created" && status != "pending" {
		jsonResponse(w, http.StatusGone, map[string]string{"error": "该支付二维码已经失效"})
		return
	}
	png, err := qrcode.Encode(qrContent, qrcode.Medium, 320)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "暂时无法生成支付二维码"})
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Length", itoaLen(len(png)))
	_, _ = w.Write(png)
}

func itoaLen(value int) string {
	if value == 0 {
		return "0"
	}
	var buf [24]byte
	pos := len(buf)
	for value > 0 {
		pos--
		buf[pos] = byte('0' + value%10)
		value /= 10
	}
	return string(buf[pos:])
}
