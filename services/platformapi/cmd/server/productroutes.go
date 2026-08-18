package main

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/payments"
)

func (s *server) registerProductRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/workspaces/{id}", s.user(s.workspaceDetail))
	mux.HandleFunc("PATCH /api/workspaces/{id}", s.user(s.renameWorkspace))
	mux.HandleFunc("DELETE /api/workspaces/{id}", s.user(s.deleteWorkspace))
	mux.HandleFunc("POST /api/workspaces/{id}/transfer", s.user(s.transferWorkspace))

	mux.HandleFunc("PUT /api/workspaces/{id}/campaigns/{campaign}", s.user(s.updateCampaignFull))
	mux.HandleFunc("DELETE /api/workspaces/{id}/campaigns/{campaign}", s.user(s.deleteCampaign))
	mux.HandleFunc("PATCH /api/workspaces/{id}/folders/{folder}", s.user(s.updateFolder))
	mux.HandleFunc("DELETE /api/workspaces/{id}/folders/{folder}", s.user(s.deleteFolder))
	mux.HandleFunc("PATCH /api/workspaces/{id}/tags/{tag}", s.user(s.updateTag))
	mux.HandleFunc("DELETE /api/workspaces/{id}/tags/{tag}", s.user(s.deleteTag))
	mux.HandleFunc("POST /api/workspaces/{id}/share-qr", s.user(s.createShareQR))

	// P05 Links presentation routes close the V4 UI-contract gaps without
	// changing the redirect-plane service semantics already accepted in V4.
	mux.HandleFunc("GET /api/workspaces/{id}/link-domains", s.user(s.workspaceLinkDomains))
	mux.HandleFunc("POST /api/workspaces/{id}/links/official", s.user(s.createOfficialLink))
	mux.HandleFunc("GET /api/workspaces/{id}/links/presentation", s.user(s.listLinksP05))
	mux.HandleFunc("GET /api/workspaces/{id}/links/capabilities", s.user(s.linksP05Capabilities))
	mux.HandleFunc("GET /api/workspaces/{id}/links/{link}/presentation", s.user(s.getLinkP05))
	mux.HandleFunc("GET /api/workspaces/{id}/links/{link}/qr", s.user(s.linkP05QR))

	mux.HandleFunc("GET /api/workspaces/{id}/billing/payment-methods", s.user(s.paymentMethods))
	mux.HandleFunc("GET /api/admin/payment-callbacks", s.admin("billing.manage", s.adminPaymentCallbacks))
	mux.HandleFunc("GET /api/admin/analytics/overview", s.admin("platform.read", s.adminAnalyticsOverview))
	mux.HandleFunc("POST /api/workspaces/{id}/billing/invoices/{invoice}/pay", s.user(s.startInvoicePayment))
	mux.HandleFunc("POST /api/payments/alipay/notify", s.observePaymentCallback("alipay", s.alipayNotify))
	mux.HandleFunc("POST /api/payments/wechat/notify", s.observePaymentCallback("wechat", s.wechatNotify))
	// Epay-compatible V1 implementations commonly send asynchronous callbacks
	// with GET while others use POST. Accept both on the same signed endpoint.
	mux.HandleFunc("/api/payments/epay/notify", s.observePaymentCallback("epay", s.epayNotify))
	mux.HandleFunc("GET /api/payments/epay/return", s.observePaymentCallback("epay", s.epayReturn))
	mux.HandleFunc("POST /api/payments/paypal/webhook", s.observePaymentCallback("paypal", s.paypalWebhook))
	mux.HandleFunc("GET /api/payments/paypal/return", s.paypalReturn)
	mux.HandleFunc("POST /api/payments/stripe/webhook", s.observePaymentCallback("stripe", s.stripeWebhook))

	mux.HandleFunc("GET /api/admin/destination-risks", s.admin("security.manage", s.adminDestinationRisks))
	mux.HandleFunc("GET /api/admin/destination-risks/{id}", s.admin("security.manage", s.adminDestinationRiskDetail))
	mux.HandleFunc("POST /api/admin/destination-risks/{id}/override", s.admin("security.manage", s.adminOverrideDestinationRisk))
	mux.HandleFunc("DELETE /api/admin/destination-risks/{id}/override", s.admin("security.manage", s.adminClearDestinationRiskOverride))
	mux.HandleFunc("POST /api/admin/destination-risks/{id}/rescan", s.admin("security.manage", s.adminRescanDestinationRisk))
	mux.HandleFunc("GET /api/workspaces/{id}/link-risks", s.user(s.workspaceLinkRisks))

	s.registerSupportAndBotRoutes(mux)
}

func (s *server) paymentService() *payments.Service {
	return payments.New(s.db, s.settings, s.billing, getenv("PUBLIC_BASE_URL", "http://localhost:8080"))
}

func (s *server) workspaceDetail(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	detail, err := s.workspace.Detail(r.Context(), currentUser(r).ID, wid)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法访问该工作区"})
		return
	}
	members, invitations, err := s.workspace.Members(r.Context(), currentUser(r).ID, wid)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "成员信息暂时不可用"})
		return
	}
	jsonResponse(w, 200, map[string]any{"workspace": detail, "members": members, "invitations": invitations})
}

func (s *server) renameWorkspace(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var input struct {
		Name string `json:"name"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil || s.workspace.Rename(r.Context(), currentUser(r).ID, wid, input.Name) != nil {
		jsonResponse(w, 422, map[string]string{"error": "无法修改工作区名称"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}

func (s *server) transferWorkspace(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var input struct {
		NewOwnerUserID int64 `json:"new_owner_user_id"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	if err = s.workspace.TransferOwnership(r.Context(), currentUser(r).ID, wid, input.NewOwnerUserID); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"transferred": true})
}

func (s *server) deleteWorkspace(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	if err = s.workspace.Delete(r.Context(), currentUser(r).ID, wid); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (s *server) updateCampaignFull(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "campaign")
	var input struct{ Name, Status string }
	if decode(w, r, &input) != nil {
		return
	}
	if e1 != nil || e2 != nil {
		jsonResponse(w, 400, map[string]string{"error": "活动编号无效"})
		return
	}
	if err := s.organizer.UpdateCampaign(r.Context(), currentUser(r).ID, wid, id, input.Name, input.Status); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}
func (s *server) deleteCampaign(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "campaign")
	if e1 != nil || e2 != nil || s.organizer.DeleteCampaign(r.Context(), currentUser(r).ID, wid, id) != nil {
		jsonResponse(w, 422, map[string]string{"error": "无法删除活动"})
		return
	}
	w.WriteHeader(204)
}
func (s *server) updateFolder(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "folder")
	var input struct {
		Name string `json:"name"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if e1 != nil || e2 != nil || s.organizer.UpdateFolder(r.Context(), currentUser(r).ID, wid, id, input.Name) != nil {
		jsonResponse(w, 422, map[string]string{"error": "无法修改文件夹"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}
func (s *server) deleteFolder(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "folder")
	if e1 != nil || e2 != nil || s.organizer.DeleteFolder(r.Context(), currentUser(r).ID, wid, id) != nil {
		jsonResponse(w, 422, map[string]string{"error": "无法删除文件夹"})
		return
	}
	w.WriteHeader(204)
}
func (s *server) updateTag(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "tag")
	var input struct{ Name, Color string }
	if decode(w, r, &input) != nil {
		return
	}
	if e1 != nil || e2 != nil || s.organizer.UpdateTag(r.Context(), currentUser(r).ID, wid, id, input.Name, input.Color) != nil {
		jsonResponse(w, 422, map[string]string{"error": "无法修改标签"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}
func (s *server) deleteTag(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "tag")
	if e1 != nil || e2 != nil || s.organizer.DeleteTag(r.Context(), currentUser(r).ID, wid, id) != nil {
		jsonResponse(w, 422, map[string]string{"error": "无法删除标签"})
		return
	}
	w.WriteHeader(204)
}

func (s *server) paymentMethods(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	if _, err = s.workspace.Role(r.Context(), wid, currentUser(r).ID); err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无权查看支付方式"})
		return
	}
	methods, err := s.paymentService().EnabledMethods(r.Context())
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "支付方式暂时不可用"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": methods})
}

func (s *server) startInvoicePayment(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	invoiceID, e2 := pathID(r, "invoice")
	var input struct {
		Provider string `json:"provider"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if e1 != nil || e2 != nil {
		jsonResponse(w, 400, map[string]string{"error": "账单编号无效"})
		return
	}
	checkout, err := s.paymentService().CreateCheckout(r.Context(), currentUser(r).ID, wid, invoiceID, input.Provider)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, checkout)
}

func paymentForm(w http.ResponseWriter, r *http.Request) (url.Values, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := r.ParseForm(); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "支付通知格式无效"})
		return nil, false
	}
	// r.Form merges the query string and urlencoded POST body, which is required
	// for Epay-compatible providers that choose either transport.
	return r.Form, true
}
func (s *server) alipayNotify(w http.ResponseWriter, r *http.Request) {
	form, ok := paymentForm(w, r)
	if !ok {
		return
	}
	if err := s.paymentService().HandleAlipayNotification(r.Context(), form); err != nil {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("failure"))
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("success"))
}
func (s *server) epayNotify(w http.ResponseWriter, r *http.Request) {
	form, ok := paymentForm(w, r)
	if !ok {
		return
	}
	if err := s.paymentService().HandleEPayNotification(r.Context(), form); err != nil {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("fail"))
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("success"))
}
func (s *server) epayReturn(w http.ResponseWriter, r *http.Request) {
	form, ok := paymentForm(w, r)
	if !ok {
		http.Redirect(w, r, "/app/billing?payment=failed", http.StatusSeeOther)
		return
	}
	if !strings.EqualFold(strings.TrimSpace(form.Get("trade_status")), "TRADE_SUCCESS") {
		http.Redirect(w, r, "/app/billing?payment=cancelled", http.StatusSeeOther)
		return
	}
	if err := s.paymentService().HandleEPayNotification(r.Context(), form); err != nil {
		http.Redirect(w, r, "/app/billing?payment=failed", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/app/billing?payment=success", http.StatusSeeOther)
}
func (s *server) wechatNotify(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	body, err := io.ReadAll(r.Body)
	if err != nil || s.paymentService().HandleWeChatNotification(r.Context(), body, r.Header, time.Now()) != nil {
		jsonResponse(w, 400, map[string]string{"code": "FAIL", "message": "支付通知验证失败"})
		return
	}
	jsonResponse(w, 200, map[string]string{"code": "SUCCESS", "message": "成功"})
}
func (s *server) stripeWebhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	body, err := io.ReadAll(r.Body)
	if err != nil || s.paymentService().HandleStripeWebhook(r.Context(), body, r.Header.Get("Stripe-Signature"), time.Now()) != nil {
		jsonResponse(w, 400, map[string]string{"error": "支付通知验证失败"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"received": true})
}
func (s *server) paypalWebhook(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	body, err := io.ReadAll(r.Body)
	if err != nil || s.paymentService().HandlePayPalWebhook(r.Context(), body, r.Header) != nil {
		jsonResponse(w, 400, map[string]string{"error": "支付通知验证失败"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"received": true})
}
func (s *server) paypalReturn(w http.ResponseWriter, r *http.Request) {
	merchantOrder := strings.TrimSpace(r.URL.Query().Get("merchant_order"))
	orderID := strings.TrimSpace(r.URL.Query().Get("token"))
	if err := s.paymentService().CompletePayPalReturn(r.Context(), merchantOrder, orderID); err != nil {
		http.Redirect(w, r, "/app/billing?payment=failed", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/app/billing?payment=success", http.StatusSeeOther)
}