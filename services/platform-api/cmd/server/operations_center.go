package main

import (
	"context"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

func (s *server) adminUserSessions(w http.ResponseWriter, r *http.Request) {
	userID, _ := pathID(r, "id")
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,COALESCE(ip_address,''),COALESCE(user_agent,''),last_seen_at,expires_at,revoked_at,created_at FROM user_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 200`, userID)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "登录记录暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, ip, ua string
		var last, expires, created time.Time
		var revoked sql.NullTime
		if rows.Scan(&id, &ip, &ua, &last, &expires, &revoked, &created) == nil {
			state := "active"
			if revoked.Valid {
				state = "revoked"
			} else if expires.Before(time.Now()) {
				state = "expired"
			}
			items = append(items, map[string]any{"id": id, "fingerprint": id[:12], "ip_address": ip, "user_agent": ua, "last_seen_at": last, "expires_at": expires, "revoked_at": nullableTime(revoked), "created_at": created, "status": state})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}

func (s *server) adminRevokeUserSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("session")
	if len(id) != 64 {
		jsonResponse(w, 400, map[string]string{"error": "会话编号无效"})
		return
	}
	if _, err := hex.DecodeString(id); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "会话编号无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE user_sessions SET revoked_at=NOW() WHERE id=? AND revoked_at IS NULL`, id)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "会话撤销失败"})
		return
	}
	n, _ := result.RowsAffected()
	if n != 1 {
		jsonResponse(w, 409, map[string]string{"error": "会话不存在或已经失效"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.user_session_revoked','user_session',?,JSON_OBJECT('fingerprint',?))`, id, id[:12])
	jsonResponse(w, 200, map[string]bool{"revoked": true})
}

type resourceSpec struct {
	table, name, status string
	softDelete          bool
}

var resourceSpecs = map[string]resourceSpec{
	"link": {table: "short_links", name: "code", status: "status"}, "text": {table: "text_shares", name: "title", status: "status"}, "bio": {table: "bio_pages", name: "title", status: "status"}, "qr": {table: "qr_codes", name: "name", softDelete: true}, "file": {table: "file_shares", name: "original_name", status: "status"},
}

func (s *server) adminResources(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT q.id,q.resource_type,q.resource_id,q.workspace_id,w.name,q.previous_status,q.status,q.reason,q.quarantined_at,q.restore_reason,q.restored_at FROM admin_resource_quarantine q JOIN workspaces w ON w.id=q.workspace_id ORDER BY FIELD(q.status,'quarantined','restored'),q.quarantined_at DESC LIMIT 300`)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "隔离记录暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, rid, wid int64
		var kind, workspace, previous, status, reason string
		var quarantined time.Time
		var restoreReason sql.NullString
		var restored sql.NullTime
		if rows.Scan(&id, &kind, &rid, &wid, &workspace, &previous, &status, &reason, &quarantined, &restoreReason, &restored) == nil {
			items = append(items, map[string]any{"id": id, "resource_type": kind, "resource_id": rid, "workspace_id": wid, "workspace": workspace, "previous_status": previous, "status": status, "reason": reason, "quarantined_at": quarantined, "restore_reason": restoreReason.String, "restored_at": nullableTime(restored)})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}

func (s *server) adminQuarantineResource(w http.ResponseWriter, r *http.Request) {
	kind := r.PathValue("type")
	id, err := pathID(r, "id")
	var in struct {
		Reason string `json:"reason"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil || len(strings.TrimSpace(in.Reason)) < 3 {
		jsonResponse(w, 422, map[string]string{"error": "资源编号和至少 3 个字符的隔离原因必填"})
		return
	}
	if err = s.quarantineResource(r.Context(), currentAdmin(r).ID, kind, id, in.Reason); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"quarantined": true})
}

func (s *server) quarantineResource(ctx context.Context, adminID int64, kind string, id int64, reason string) error {
	spec, ok := resourceSpecs[kind]
	if !ok {
		return errors.New("不支持的资源类型")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var wid int64
	var previous string
	var deleted sql.NullTime
	query := `SELECT workspace_id,'' status,deleted_at FROM ` + spec.table + ` WHERE id=? FOR UPDATE`
	if !spec.softDelete {
		query = `SELECT workspace_id,` + spec.status + `,NULL FROM ` + spec.table + ` WHERE id=? FOR UPDATE`
	}
	if err = tx.QueryRowContext(ctx, query, id).Scan(&wid, &previous, &deleted); err != nil {
		return errors.New("资源不存在")
	}
	if kind == "file" && previous == "quarantined" {
		return errors.New("文件已经处于隔离状态")
	}
	if spec.softDelete {
		_, err = tx.ExecContext(ctx, `UPDATE `+spec.table+` SET deleted_at=NOW() WHERE id=?`, id)
	} else {
		target := "paused"
		if kind == "file" {
			target = "quarantined"
		}
		_, err = tx.ExecContext(ctx, `UPDATE `+spec.table+` SET `+spec.status+`=? WHERE id=?`, target, id)
	}
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO admin_resource_quarantine(resource_type,resource_id,workspace_id,previous_status,previous_deleted_at,reason,quarantined_by) VALUES(?,?,?,?,?,?,?)`, kind, id, wid, previous, nullableTime(deleted), reason, adminID)
	if err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	if kind == "link" {
		return s.links.SyncByID(ctx, id)
	}
	return nil
}

func (s *server) adminRestoreResource(w http.ResponseWriter, r *http.Request) {
	qid, err := pathID(r, "id")
	var in struct {
		Reason string `json:"reason"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil || len(strings.TrimSpace(in.Reason)) < 3 {
		jsonResponse(w, 422, map[string]string{"error": "隔离记录和至少 3 个字符的恢复原因必填"})
		return
	}
	if err = s.restoreResource(r.Context(), currentAdmin(r).ID, qid, in.Reason); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"restored": true})
}

func (s *server) restoreResource(ctx context.Context, adminID, qid int64, reason string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var kind, previous, status string
	var rid int64
	var deleted sql.NullTime
	if err = tx.QueryRowContext(ctx, `SELECT resource_type,resource_id,COALESCE(previous_status,''),previous_deleted_at,status FROM admin_resource_quarantine WHERE id=? FOR UPDATE`, qid).Scan(&kind, &rid, &previous, &deleted, &status); err != nil {
		return errors.New("隔离记录不存在")
	}
	if status != "quarantined" {
		return errors.New("资源已经恢复")
	}
	spec := resourceSpecs[kind]
	if kind == "file" {
		var scan string
		if err = tx.QueryRowContext(ctx, `SELECT scan_status FROM file_shares WHERE id=?`, rid).Scan(&scan); err != nil {
			return err
		}
		if scan != "clean" {
			return errors.New("只有安全扫描通过的文件可以恢复")
		}
	}
	if spec.softDelete {
		_, err = tx.ExecContext(ctx, `UPDATE `+spec.table+` SET deleted_at=? WHERE id=?`, nullableTime(deleted), rid)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE `+spec.table+` SET `+spec.status+`=? WHERE id=?`, previous, rid)
	}
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `UPDATE admin_resource_quarantine SET status='restored',restored_by=?,restored_at=NOW(),restore_reason=? WHERE id=?`, adminID, reason, qid)
	if err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	if kind == "link" {
		return s.links.SyncByID(ctx, rid)
	}
	return nil
}

func nullableTime(value sql.NullTime) any {
	if !value.Valid {
		return nil
	}
	return value.Time
}

func (s *server) adminResourceInventory(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.QueryContext(r.Context(), `SELECT resource_type,id,workspace_id,name,status,created_at FROM (
SELECT 'link' resource_type,id,workspace_id,code name,status,created_at FROM short_links WHERE deleted_at IS NULL
UNION ALL SELECT 'text',id,workspace_id,title,status,created_at FROM text_shares WHERE deleted_at IS NULL
UNION ALL SELECT 'bio',id,workspace_id,title,status,created_at FROM bio_pages WHERE deleted_at IS NULL
UNION ALL SELECT 'qr',id,workspace_id,name,'active',created_at FROM qr_codes WHERE deleted_at IS NULL
UNION ALL SELECT 'file',id,workspace_id,original_name,status,created_at FROM file_shares
) inventory ORDER BY created_at DESC LIMIT 500`)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "资源清单暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var kind, name, status string
		var id, wid int64
		var created time.Time
		if rows.Scan(&kind, &id, &wid, &name, &status, &created) == nil {
			items = append(items, map[string]any{"resource_type": kind, "id": id, "workspace_id": wid, "name": name, "status": status, "created_at": created})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}

func (s *server) adminDiagnostics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	start := time.Now()
	dbErr := s.db.PingContext(ctx)
	dbLatency := time.Since(start).Milliseconds()
	start = time.Now()
	redisErr := s.redis.Ping(ctx).Err()
	redisLatency := time.Since(start).Milliseconds()
	stream, _ := s.redis.XLen(ctx, "gojet:analytics:events").Result()
	pending := int64(0)
	if summary, err := s.redis.XPending(ctx, "gojet:analytics:events", s.analyticsGroup).Result(); err == nil {
		pending = summary.Count
	}
	dbStats := s.db.Stats()
	counts := map[string]int64{}
	queries := map[string]string{"mail_queued": `SELECT COUNT(*) FROM mail_messages WHERE status IN ('pending','sending')`, "mail_failed": `SELECT COUNT(*) FROM mail_messages WHERE status='failed'`, "file_scan_backlog": `SELECT COUNT(*) FROM file_shares WHERE scan_status IN ('pending','scanning')`, "file_scan_failed": `SELECT COUNT(*) FROM file_shares WHERE scan_status IN ('infected','error')`, "analytics_failures": `SELECT COUNT(*) FROM analytics_worker_failures`, "active_user_sessions": `SELECT COUNT(*) FROM user_sessions WHERE revoked_at IS NULL AND expires_at>NOW()`, "quarantined_resources": `SELECT COUNT(*) FROM admin_resource_quarantine WHERE status='quarantined'`}
	for key, query := range queries {
		var n int64
		if s.db.QueryRowContext(ctx, query).Scan(&n) == nil {
			counts[key] = n
		}
	}
	rows, _ := s.db.QueryContext(ctx, `SELECT id,job_name,status,COALESCE(details,JSON_OBJECT()),started_at,finished_at FROM system_job_runs ORDER BY started_at DESC LIMIT 20`)
	jobs := []map[string]any{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id int64
			var name, status string
			var details []byte
			var started time.Time
			var finished sql.NullTime
			if rows.Scan(&id, &name, &status, &details, &started, &finished) == nil {
				jobs = append(jobs, map[string]any{"id": id, "job_name": name, "status": status, "details": string(details), "started_at": started, "finished_at": nullableTime(finished)})
			}
		}
	}
	maintenance, _, _ := s.settings.Get(ctx, "system.maintenance_mode")
	jsonResponse(w, 200, map[string]any{"database": map[string]any{"status": healthState(dbErr), "latency_ms": dbLatency, "open_connections": dbStats.OpenConnections, "in_use": dbStats.InUse, "idle": dbStats.Idle}, "redis": map[string]any{"status": healthState(redisErr), "latency_ms": redisLatency, "stream_events": stream, "consumer_pending": pending}, "queues": counts, "maintenance_mode": maintenance == "true", "jobs": jobs, "checked_at": time.Now().UTC()})
}
func healthState(err error) string {
	if err != nil {
		return "outage"
	}
	return "operational"
}

func (s *server) adminRunReconciliation(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Reason string `json:"reason"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if len(strings.TrimSpace(in.Reason)) < 3 {
		jsonResponse(w, 422, map[string]string{"error": "必须填写执行原因"})
		return
	}
	admin := currentAdmin(r)
	result, err := s.db.ExecContext(r.Context(), `INSERT INTO system_job_runs(job_name,status,triggered_by,details) VALUES('platform.reconcile','running',?,JSON_OBJECT('reason',?))`, admin.ID, in.Reason)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "无法创建任务记录"})
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

func (s *server) adminFlushCache(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Confirmation string `json:"confirmation"`
		Reason       string `json:"reason"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if in.Confirmation != "清理 GoJet 缓存" || len(strings.TrimSpace(in.Reason)) < 3 {
		jsonResponse(w, 422, map[string]string{"error": "请输入确认文字并填写原因"})
		return
	}
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
	_, _ = s.db.ExecContext(ctx, `INSERT INTO system_job_runs(job_name,status,triggered_by,details,finished_at) VALUES('cache.flush','success',?,JSON_OBJECT('deleted',?,'reason',?),NOW())`, currentAdmin(r).ID, deleted, in.Reason)
	jsonResponse(w, 200, map[string]int64{"deleted": deleted})
}

func (s *server) adminMaintenance(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Enabled bool   `json:"enabled"`
		Reason  string `json:"reason"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if len(strings.TrimSpace(in.Reason)) < 3 {
		jsonResponse(w, 422, map[string]string{"error": "必须填写维护模式变更原因"})
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
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO system_job_runs(job_name,status,triggered_by,details,finished_at) VALUES('maintenance.toggle','success',?,JSON_OBJECT('enabled',?,'reason',?),NOW())`, currentAdmin(r).ID, in.Enabled, in.Reason)
	jsonResponse(w, 200, map[string]bool{"enabled": in.Enabled})
}

func jsonObject(values map[string]int64, cause error) string {
	payload := map[string]any{}
	for key, value := range values {
		payload[key] = value
	}
	if cause != nil {
		payload["error"] = cause.Error()
	}
	encoded, _ := json.Marshal(payload)
	return string(encoded)
}
