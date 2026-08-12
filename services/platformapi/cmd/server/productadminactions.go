package main

import (
	"net/http"
	"strings"
)

func (s *server) adminUpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "公告编号无效"})
		return
	}
	var in struct {
		Title  string `json:"title"`
		Body   string `json:"body"`
		Status string `json:"status"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	in.Title = strings.TrimSpace(in.Title)
	if len(in.Title) < 2 || len(strings.TrimSpace(in.Body)) < 1 || (in.Status != "draft" && in.Status != "published" && in.Status != "archived") {
		jsonResponse(w, 422, map[string]string{"error": "公告标题、Markdown 正文或状态无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE announcements SET title=?,body=?,status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,NOW()) ELSE published_at END WHERE id=?`, in.Title, in.Body, in.Status, in.Status, id)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "公告保存失败"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, 404, map[string]string{"error": "公告不存在"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.announcement_updated','announcement',?,JSON_OBJECT('administrator_id',?,'status',?))`, id, currentAdmin(r).ID, in.Status)
	jsonResponse(w, 200, map[string]bool{"updated": true})
}

func (s *server) adminDeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "公告编号无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `DELETE FROM announcements WHERE id=?`, id)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "公告删除失败"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, 404, map[string]string{"error": "公告不存在"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.announcement_deleted','announcement',?,JSON_OBJECT('administrator_id',?))`, id, currentAdmin(r).ID)
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) adminRunReconciliationSimple(w http.ResponseWriter, r *http.Request) {
	admin := currentAdmin(r)
	result, err := s.db.ExecContext(r.Context(), `INSERT INTO system_job_runs(job_name,status,triggered_by,details) VALUES('platform.reconcile','running',?,JSON_OBJECT())`, admin.ID)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "无法创建对账任务"})
		return
	}
	jobID, _ := result.LastInsertId()
	details := map[string]int64{}
	runErr := s.billing.Reconcile(r.Context())
	if runErr == nil {
		if res, e := s.db.ExecContext(r.Context(), `DELETE FROM user_sessions WHERE expires_at<NOW() OR revoked_at<DATE_SUB(NOW(),INTERVAL 30 DAY)`); e == nil {
			details["sessions_cleaned"], _ = res.RowsAffected()
		} else {
			runErr = e
		}
	}
	if runErr == nil {
		if res, e := s.db.ExecContext(r.Context(), `UPDATE file_shares SET scan_status='pending',scan_result='scanner lease expired; operations reconciliation',next_scan_at=NOW() WHERE scan_status='scanning' AND next_scan_at<=NOW()`); e == nil {
			details["file_scans_requeued"], _ = res.RowsAffected()
		} else {
			runErr = e
		}
	}
	status := "success"
	if runErr != nil {
		status = "failure"
	}
	_, _ = s.db.ExecContext(r.Context(), `UPDATE system_job_runs SET status=?,details=JSON_MERGE_PATCH(COALESCE(details,JSON_OBJECT()),?),finished_at=NOW() WHERE id=?`, status, jsonObject(details, runErr), jobID)
	if runErr != nil {
		jsonResponse(w, 503, map[string]string{"error": "对账执行失败：" + runErr.Error()})
		return
	}
	jsonResponse(w, 200, map[string]any{"job_id": jobID, "status": status, "details": details})
}

func (s *server) adminFlushCacheSimple(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var cursor uint64
	deleted := int64(0)
	for {
		keys, next, err := s.redis.Scan(ctx, cursor, "gojet:cache:*", 250).Result()
		if err != nil {
			jsonResponse(w, 503, map[string]string{"error": "Redis 缓存扫描失败"})
			return
		}
		if len(keys) > 0 {
			n, err := s.redis.Del(ctx, keys...).Result()
			if err != nil {
				jsonResponse(w, 503, map[string]string{"error": "Redis 缓存清理失败"})
				return
			}
			deleted += n
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	_, _ = s.db.ExecContext(ctx, `INSERT INTO system_job_runs(job_name,status,triggered_by,details,finished_at) VALUES('cache.flush','success',?,JSON_OBJECT('deleted',?),NOW())`, currentAdmin(r).ID, deleted)
	jsonResponse(w, 200, map[string]int64{"deleted": deleted})
}

func (s *server) adminMaintenanceSimple(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Enabled     bool   `json:"enabled"`
		Message     string `json:"message"`
		ExpectedEnd string `json:"expected_end"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	value := "false"
	if in.Enabled {
		value = "true"
	}
	if err := s.settings.Set(r.Context(), "system.maintenance_mode", value, false); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "维护模式保存失败"})
		return
	}
	_ = s.settings.Set(r.Context(), "system.maintenance_message", strings.TrimSpace(in.Message), false)
	_ = s.settings.Set(r.Context(), "system.maintenance_expected_end", strings.TrimSpace(in.ExpectedEnd), false)
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO system_job_runs(job_name,status,triggered_by,details,finished_at) VALUES('maintenance.toggle','success',?,JSON_OBJECT('enabled',?,'message',?,'expected_end',?),NOW())`, currentAdmin(r).ID, in.Enabled, strings.TrimSpace(in.Message), strings.TrimSpace(in.ExpectedEnd))
	jsonResponse(w, 200, map[string]any{"enabled": in.Enabled, "message": strings.TrimSpace(in.Message), "expected_end": strings.TrimSpace(in.ExpectedEnd)})
}
