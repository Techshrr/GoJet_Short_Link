package main

import (
	"net/http"
	"strings"
	"time"
)

func (s *server) createAbuseReport(w http.ResponseWriter, r *http.Request) {
	var in struct {
		LinkID                 *int64 `json:"link_id"`
		Email, Reason, Details string
	}
	if decode(w, r, &in) != nil {
		return
	}
	allowed := map[string]bool{"malware": true, "phishing": true, "spam": true, "copyright": true, "other": true}
	if !allowed[in.Reason] || len(in.Details) < 10 || len(in.Details) > 5000 {
		jsonResponse(w, 422, map[string]string{"error": "举报原因和至少 10 个字符的详情为必填项"})
		return
	}
	if in.Email != "" && !strings.Contains(in.Email, "@") {
		jsonResponse(w, 422, map[string]string{"error": "举报邮箱格式无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `INSERT INTO abuse_reports(link_id,reporter_email,reason,details) VALUES(?,?,?,?)`, in.LinkID, nullableString(in.Email), in.Reason, in.Details)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "举报暂时无法提交"})
		return
	}
	id, _ := result.LastInsertId()
	jsonResponse(w, 201, map[string]int64{"id": id})
}
func (s *server) adminAbuse(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT a.id,COALESCE(a.link_id,0),COALESCE(a.reporter_email,''),a.reason,a.details,a.status,COALESCE(a.resolution,''),a.created_at,COALESCE(l.code,'') FROM abuse_reports a LEFT JOIN short_links l ON l.id=a.link_id ORDER BY FIELD(a.status,'open','investigating','resolved','rejected'),a.created_at DESC LIMIT 200`)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "举报列表暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, linkID int64
		var email, reason, details, status, resolution, code string
		var created time.Time
		if rows.Scan(&id, &linkID, &email, &reason, &details, &status, &resolution, &created, &code) == nil {
			items = append(items, map[string]any{"id": id, "link_id": linkID, "code": code, "reporter": email, "reason": reason, "details": details, "status": status, "resolution": resolution, "created_at": created})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) adminResolveAbuse(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	var in struct{ Status, Resolution string }
	if decode(w, r, &in) != nil {
		return
	}
	allowed := map[string]bool{"investigating": true, "resolved": true, "rejected": true}
	if err != nil || !allowed[in.Status] || len(in.Resolution) < 3 {
		jsonResponse(w, 422, map[string]string{"error": "状态和处理原因必填"})
		return
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "处理失败"})
		return
	}
	defer tx.Rollback()
	var linkID *int64
	if err = tx.QueryRowContext(r.Context(), `SELECT link_id FROM abuse_reports WHERE id=? FOR UPDATE`, id).Scan(&linkID); err != nil {
		jsonResponse(w, 404, map[string]string{"error": "举报不存在"})
		return
	}
	_, err = tx.ExecContext(r.Context(), `UPDATE abuse_reports SET status=?,resolution=?,resolved_at=IF(? IN ('resolved','rejected'),NOW(),NULL) WHERE id=?`, in.Status, in.Resolution, in.Status, id)
	if err == nil && in.Status == "resolved" && linkID != nil {
		_, err = tx.ExecContext(r.Context(), `UPDATE short_links SET status='paused' WHERE id=?`, *linkID)
	}
	if err == nil {
		_, err = tx.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.abuse_status','abuse_report',?,JSON_OBJECT('status',?,'resolution',?))`, id, in.Status, in.Resolution)
	}
	if err != nil || tx.Commit() != nil {
		jsonResponse(w, 503, map[string]string{"error": "处理失败"})
		return
	}
	if in.Status == "resolved" && linkID != nil {
		if err = s.links.SyncByID(r.Context(), *linkID); err != nil {
			jsonResponse(w, 503, map[string]string{"error": "举报已处理，但跳转服务同步失败"})
			return
		}
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}
func (s *server) adminDomains(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT d.id,d.hostname,d.status,d.https_status,COALESCE(d.last_error,''),d.last_checked_at,d.created_at,w.name FROM custom_domains d JOIN workspaces w ON w.id=d.workspace_id ORDER BY d.created_at DESC LIMIT 200`)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "域名列表暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var host, status, httpsStatus, lastError, workspace string
		var checked *time.Time
		var created time.Time
		if rows.Scan(&id, &host, &status, &httpsStatus, &lastError, &checked, &created, &workspace) == nil {
			items = append(items, map[string]any{"id": id, "hostname": host, "status": status, "https_status": httpsStatus, "last_error": lastError, "last_checked_at": checked, "created_at": created, "workspace": workspace})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) adminSecurityEvents(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,event_type,severity,COALESCE(source,''),description,status,created_at FROM security_events ORDER BY FIELD(status,'open','resolved'),FIELD(severity,'critical','high','warning','info'),created_at DESC LIMIT 200`)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "安全事件暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var eventType, severity, source, description, status string
		var created time.Time
		if rows.Scan(&id, &eventType, &severity, &source, &description, &status, &created) == nil {
			items = append(items, map[string]any{"id": id, "event_type": eventType, "severity": severity, "source": source, "description": description, "status": status, "created_at": created})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) adminResolveSecurity(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE security_events SET status='resolved',resolved_at=NOW() WHERE id=? AND status='open'`, id)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "处理失败"})
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		jsonResponse(w, 404, map[string]string{"error": "事件不存在或已处理"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id) VALUES('admin.security_resolved','security_event',?)`, id)
	jsonResponse(w, 200, map[string]bool{"resolved": true})
}
func (s *server) adminAnnouncements(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,title,body,status,published_at,created_at FROM announcements ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "公告暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var title, body, status string
		var published *time.Time
		var created time.Time
		if rows.Scan(&id, &title, &body, &status, &published, &created) == nil {
			items = append(items, map[string]any{"id": id, "title": title, "body": body, "status": status, "published_at": published, "created_at": created})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) adminCreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	var in struct{ Title, Body, Status string }
	if decode(w, r, &in) != nil {
		return
	}
	if len(in.Title) < 2 || len(in.Body) < 5 || (in.Status != "draft" && in.Status != "published") {
		jsonResponse(w, 422, map[string]string{"error": "公告标题、正文和状态无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `INSERT INTO announcements(title,body,status,published_at) VALUES(?,?,?,IF(?='published',NOW(),NULL))`, in.Title, in.Body, in.Status, in.Status)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "公告创建失败"})
		return
	}
	id, _ := result.LastInsertId()
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id) VALUES('admin.announcement_created','announcement',?)`, id)
	jsonResponse(w, 201, map[string]int64{"id": id})
}
func nullableString(v string) any {
	if v == "" {
		return nil
	}
	return v
}
func (s *server) publicStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	components := map[string]map[string]any{}
	dbStatus := "operational"
	if err := s.db.PingContext(ctx); err != nil {
		dbStatus = "outage"
	}
	components["database"] = map[string]any{"status": dbStatus}
	redisStatus := "operational"
	if err := s.redis.Ping(ctx).Err(); err != nil {
		redisStatus = "outage"
	}
	backlog, _ := s.redis.XLen(ctx, "gojet:analytics:events").Result()
	components["redirect_analytics"] = map[string]any{"status": redisStatus, "stream_events": backlog}
	var failed, pending int64
	mailStatus := "operational"
	if err := s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(status='failed'),0),COALESCE(SUM(status IN ('pending','sending')),0) FROM mail_messages`).Scan(&failed, &pending); err != nil {
		mailStatus = "outage"
	} else if failed > 0 {
		mailStatus = "degraded"
	}
	components["mail"] = map[string]any{"status": mailStatus, "failed": failed, "queued": pending}
	overall := "operational"
	for _, component := range components {
		if component["status"] == "outage" {
			overall = "outage"
			break
		}
		if component["status"] == "degraded" {
			overall = "degraded"
		}
	}
	jsonResponse(w, 200, map[string]any{"status": overall, "components": components, "checked_at": time.Now().UTC()})
}
