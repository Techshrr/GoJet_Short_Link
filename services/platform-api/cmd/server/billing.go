package main

import (
	"encoding/json"
	"net/http"

	"github.com/Techshrr/GoJet_Short_Link/app/billing"
)

func (s *server) workspaceBilling(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	if _, err = s.workspace.Role(r.Context(), wid, currentUser(r).ID); err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无权查看该工作区账单"})
		return
	}
	plans, err := s.billing.Plans(r.Context(), false)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "套餐暂时不可用"})
		return
	}
	sub, invoices, err := s.billing.Subscription(r.Context(), wid)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "订阅信息暂时不可用"})
		return
	}
	jsonResponse(w, 200, map[string]any{"plans": plans, "subscription": sub, "invoices": invoices})
}

func (s *server) requestInvoice(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var in struct {
		PlanCode string `json:"plan_code"`
		Type     string `json:"type"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	invoice, err := s.billing.Request(r.Context(), currentUser(r).ID, wid, in.PlanCode, in.Type)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, invoice)
}

func (s *server) cancelSubscription(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	var in struct {
		Cancel bool `json:"cancel"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "工作区编号无效"})
		return
	}
	if err = s.billing.CancelAtPeriodEnd(r.Context(), currentUser(r).ID, wid, in.Cancel); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"cancel_at_period_end": in.Cancel})
}

func (s *server) adminPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := s.billing.Plans(r.Context(), true)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "套餐列表暂时不可用"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": plans})
}

func (s *server) adminUpdatePlan(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	var raw struct {
		Name                   string          `json:"name"`
		Description            string          `json:"description"`
		Status                 string          `json:"status"`
		MonthlyPriceCents      int64           `json:"monthly_price_cents"`
		LinkLimit              int64           `json:"link_limit"`
		QRLimit                int64           `json:"qr_limit"`
		TextLimit              int64           `json:"text_limit"`
		BioLimit               int64           `json:"bio_limit"`
		FileStorageBytes       int64           `json:"file_storage_bytes"`
		MemberLimit            int64           `json:"member_limit"`
		AnalyticsRetentionDays int             `json:"analytics_retention_days"`
		Features               json.RawMessage `json:"features"`
	}
	if decode(w, r, &raw) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "套餐编号无效"})
		return
	}
	in := billing.PlanInput{Name: raw.Name, Description: raw.Description, Status: raw.Status, MonthlyPriceCents: raw.MonthlyPriceCents, LinkLimit: raw.LinkLimit, QRLimit: raw.QRLimit, TextLimit: raw.TextLimit, BioLimit: raw.BioLimit, FileStorageBytes: raw.FileStorageBytes, MemberLimit: raw.MemberLimit, AnalyticsRetentionDays: raw.AnalyticsRetentionDays, Features: raw.Features}
	if err = s.billing.UpdatePlan(r.Context(), id, in); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}

func (s *server) adminInvoices(w http.ResponseWriter, r *http.Request) {
	limit, offset := page(r)
	items, err := s.billing.Invoices(r.Context(), r.URL.Query().Get("status"), limit, offset)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "账单列表暂时不可用"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}

func (s *server) adminSettleInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	var in struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "账单编号无效"})
		return
	}
	if err = s.billing.Settle(r.Context(), currentAdmin(r).ID, id, in.Status, in.Note); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}
