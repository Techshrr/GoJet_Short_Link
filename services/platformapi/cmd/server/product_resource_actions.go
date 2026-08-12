package main

import (
	"net/http"
	"strings"
	"time"
)

func (s *server) adminUpdateWorkspace(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	var in struct {
		Name string `json:"name"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if err != nil || in.Name == "" || len(in.Name) > 120 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "工作区名称无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE workspaces SET name=? WHERE id=?`, in.Name, id)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "工作区保存失败"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "工作区不存在"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.workspace_updated','workspace',?,JSON_OBJECT('administrator_id',?,'name',?))`, id, currentAdmin(r).ID, in.Name)
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *server) adminUpdateLinkStatus(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	var in struct {
		Status string `json:"status"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil || (in.Status != "active" && in.Status != "paused") {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "链接状态无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE short_links SET status=? WHERE id=? AND deleted_at IS NULL`, in.Status, id)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接状态保存失败"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "链接不存在"})
		return
	}
	if err = s.links.SyncByID(r.Context(), id); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "数据库已更新，但跳转缓存同步失败"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.link_status','link',?,JSON_OBJECT('administrator_id',?,'status',?))`, id, currentAdmin(r).ID, in.Status)
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *server) adminDeleteLink(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "链接编号无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE short_links SET status='paused',deleted_at=NOW() WHERE id=? AND deleted_at IS NULL`, id)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接删除失败"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "链接不存在或已经删除"})
		return
	}
	if err = s.links.SyncByID(r.Context(), id); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接已删除，但跳转缓存同步失败"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.link_deleted','link',?,JSON_OBJECT('administrator_id',?))`, id, currentAdmin(r).ID)
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) adminUpdateDomainStatus(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	var in struct {
		Status string `json:"status"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil || (in.Status != "active" && in.Status != "suspended") {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "域名状态无效"})
		return
	}
	if in.Status == "active" {
		var httpsStatus string
		if err = s.db.QueryRowContext(r.Context(), `SELECT https_status FROM custom_domains WHERE id=?`, id).Scan(&httpsStatus); err != nil {
			jsonResponse(w, http.StatusNotFound, map[string]string{"error": "域名不存在"})
			return
		}
		if httpsStatus != "active" {
			jsonResponse(w, http.StatusConflict, map[string]string{"error": "HTTPS 尚未正常，不能直接启用该域名"})
			return
		}
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE custom_domains SET status=? WHERE id=?`, in.Status, id)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "域名状态保存失败"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "域名不存在"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.domain_status','domain',?,JSON_OBJECT('administrator_id',?,'status',?))`, id, currentAdmin(r).ID, in.Status)
	jsonResponse(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *server) adminDeleteDomain(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "域名编号无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `DELETE FROM custom_domains WHERE id=?`, id)
	if err != nil {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "域名仍被业务资源引用，无法删除"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "域名不存在"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.domain_deleted','domain',?,JSON_OBJECT('administrator_id',?))`, id, currentAdmin(r).ID)
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) publicAnnouncements(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,title,body,published_at FROM announcements WHERE status='published' AND published_at IS NOT NULL AND published_at<=NOW() ORDER BY published_at DESC LIMIT 20`)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "公告暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var title, body string
		var published time.Time
		if rows.Scan(&id, &title, &body, &published) == nil {
			items = append(items, map[string]any{"id": id, "title": title, "body_markdown": body, "published_at": published})
		}
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}
