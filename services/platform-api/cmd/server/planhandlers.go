package main

import (
	"encoding/json"
	"net/http"

	"github.com/Techshrr/GoJet_Short_Link/app/billing"
)

func (s *server) adminCreatePlan(w http.ResponseWriter, r *http.Request) {
	var raw struct {
		Code                   string          `json:"code"`
		Name                   string          `json:"name"`
		Description            string          `json:"description"`
		Currency               string          `json:"currency"`
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
	id, err := s.billing.CreatePlan(r.Context(), billing.PlanCreateInput{
		Code: raw.Code, Name: raw.Name, Description: raw.Description, Currency: raw.Currency,
		MonthlyPriceCents: raw.MonthlyPriceCents, LinkLimit: raw.LinkLimit, QRLimit: raw.QRLimit,
		TextLimit: raw.TextLimit, BioLimit: raw.BioLimit, FileStorageBytes: raw.FileStorageBytes,
		MemberLimit: raw.MemberLimit, AnalyticsRetentionDays: raw.AnalyticsRetentionDays, Features: raw.Features,
	})
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, map[string]any{"id": id, "created": true})
}

func (s *server) adminArchivePlan(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "套餐编号无效"})
		return
	}
	if err = s.billing.ArchivePlan(r.Context(), id); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"archived": true})
}
