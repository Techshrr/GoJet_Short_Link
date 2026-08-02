package main

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/links"
)

func (s *server) listLinks(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	filter := linkFilter(r)
	items, total, err := s.links.List(r.Context(), currentUser(r).ID, wid, filter)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法读取链接"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": items, "total": total, "limit": filter.Limit, "offset": filter.Offset})
}

func (s *server) bulkLinkDelete(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	var input struct {
		IDs []int64 `json:"ids"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	affected, err := s.links.BulkDelete(r.Context(), currentUser(r).ID, workspaceID, input.IDs)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]int64{"affected": affected})
}

func (s *server) exportLinksCSV(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	filter := linkFilter(r)
	filter.Limit = 100
	filter.Offset = 0
	all := []links.Link{}
	for len(all) < 10_000 {
		items, total, listErr := s.links.List(r.Context(), currentUser(r).ID, workspaceID, filter)
		if listErr != nil {
			jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无法导出链接"})
			return
		}
		all = append(all, items...)
		filter.Offset += len(items)
		if len(items) == 0 || int64(filter.Offset) >= total {
			break
		}
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="gojet-links.csv"`)
	_, _ = w.Write([]byte{0xEF, 0xBB, 0xBF})
	writer := csv.NewWriter(w)
	_ = writer.Write([]string{"短码", "域名", "目标地址", "标题", "状态", "文件夹", "活动", "标签", "点击", "独立访客", "创建时间"})
	for _, item := range all {
		_ = writer.Write([]string{item.Code, item.Domain, item.Destination, item.Title, item.Status, item.FolderName, item.CampaignName, strings.Join(item.TagNames, ","), strconv.FormatInt(item.Clicks, 10), strconv.FormatInt(item.Visitors, 10), item.CreatedAt})
	}
	writer.Flush()
}

func linkFilter(r *http.Request) links.Filter {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	folderID, _ := strconv.ParseInt(r.URL.Query().Get("folder"), 10, 64)
	campaignID, _ := strconv.ParseInt(r.URL.Query().Get("campaign"), 10, 64)
	tagID, _ := strconv.ParseInt(r.URL.Query().Get("tag"), 10, 64)
	return links.Filter{Search: r.URL.Query().Get("search"), Status: r.URL.Query().Get("status"), Domain: r.URL.Query().Get("domain"), FolderID: folderID, CampaignID: campaignID, TagID: tagID, Limit: limit, Offset: offset}
}

func (s *server) bulkLinkMove(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	var input struct {
		IDs        []int64 `json:"ids"`
		FolderID   *int64  `json:"folder_id"`
		CampaignID *int64  `json:"campaign_id"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	affected, err := s.links.BulkMove(r.Context(), currentUser(r).ID, workspaceID, input.IDs, input.FolderID, input.CampaignID)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]int64{"affected": affected})
}

func (s *server) bulkLinkTags(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	var input struct {
		IDs    []int64 `json:"ids"`
		TagIDs []int64 `json:"tag_ids"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	affected, err := s.links.BulkTags(r.Context(), currentUser(r).ID, workspaceID, input.IDs, input.TagIDs)
	if err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]int64{"affected": affected})
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
func (s *server) getLink(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "link")
	if e1 != nil || e2 != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid link"})
		return
	}
	item, err := s.links.Get(r.Context(), currentUser(r).ID, wid, id)
	if err != nil {
		jsonResponse(w, 404, map[string]string{"error": "链接不存在或无权访问"})
		return
	}
	jsonResponse(w, 200, item)
}
func (s *server) updateLink(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "link")
	var input struct {
		Link   links.Link `json:"link"`
		Reason string     `json:"reason"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if e1 != nil || e2 != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid link"})
		return
	}
	item, err := s.links.Update(r.Context(), currentUser(r).ID, wid, id, input.Link, input.Reason)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, item)
}
func (s *server) linkVersions(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "link")
	if e1 != nil || e2 != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid link"})
		return
	}
	items, err := s.links.Versions(r.Context(), currentUser(r).ID, wid, id)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法读取版本历史"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) restoreLinkVersion(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	id, e2 := pathID(r, "link")
	revision, e3 := strconv.Atoi(r.PathValue("revision"))
	var input struct {
		Reason string `json:"reason"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if e1 != nil || e2 != nil || e3 != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid revision"})
		return
	}
	item, err := s.links.Restore(r.Context(), currentUser(r).ID, wid, id, revision, input.Reason)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, item)
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
