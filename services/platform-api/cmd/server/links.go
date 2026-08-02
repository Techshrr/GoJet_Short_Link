package main

import (
	"github.com/Techshrr/GoJet_Short_Link/app/links"
	"net/http"
	"strconv"
	"time"
)

func (s *server) listLinks(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	items, total, err := s.links.List(r.Context(), currentUser(r).ID, wid, links.Filter{Search: r.URL.Query().Get("search"), Status: r.URL.Query().Get("status"), Limit: limit, Offset: offset})
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法读取链接"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": items, "total": total, "limit": limit, "offset": offset})
}
func (s *server) createLink(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	var in links.Link
	if decode(w, r, &in) != nil {
		return
	}
	created, err := s.links.Create(r.Context(), currentUser(r).ID, wid, in)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, created)
}
func (s *server) bulkLinkStatus(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	var in struct {
		IDs    []int64 `json:"ids"`
		Status string  `json:"status"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if len(in.IDs) == 0 || len(in.IDs) > 100 {
		jsonResponse(w, 422, map[string]string{"error": "请选择 1 到 100 条链接"})
		return
	}
	affected, err := s.links.BulkStatus(r.Context(), currentUser(r).ID, wid, in.IDs, in.Status)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]int64{"affected": affected})
}
func (s *server) linkAnalytics(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	lid, e2 := pathID(r, "link")
	if e1 != nil || e2 != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	to := time.Now().UTC().Add(24 * time.Hour).Format("2006-01-02")
	from := time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02")
	if value := r.URL.Query().Get("from"); value != "" {
		from = value
	}
	if value := r.URL.Query().Get("to"); value != "" {
		to = value
	}
	if _, err := time.Parse("2006-01-02", from); err != nil {
		jsonResponse(w, 422, map[string]string{"error": "from 必须为 YYYY-MM-DD"})
		return
	}
	if _, err := time.Parse("2006-01-02", to); err != nil {
		jsonResponse(w, 422, map[string]string{"error": "to 必须为 YYYY-MM-DD"})
		return
	}
	data, err := s.links.Analytics(r.Context(), currentUser(r).ID, wid, lid, from, to)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法读取分析数据"})
		return
	}
	jsonResponse(w, 200, data)
}
