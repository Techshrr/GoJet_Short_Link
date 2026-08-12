package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (s *server) adminUserDetail(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "用户编号无效"})
		return
	}
	var email, name, status string
	var verified, lastLogin, deleted sql.NullTime
	var created time.Time
	if err = s.db.QueryRowContext(r.Context(), `SELECT email,display_name,status,email_verified_at,last_login_at,deleted_at,created_at FROM users WHERE id=?`, id).Scan(&email, &name, &status, &verified, &lastLogin, &deleted, &created); err != nil {
		jsonResponse(w, 404, map[string]string{"error": "用户不存在"})
		return
	}
	rows, err := s.db.QueryContext(r.Context(), `SELECT w.id,w.name,m.role,m.status,m.joined_at FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? ORDER BY m.joined_at`, id)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "用户工作区暂时不可用"})
		return
	}
	defer rows.Close()
	workspaces := []map[string]any{}
	for rows.Next() {
		var wid int64
		var workspace, role, memberStatus string
		var joined time.Time
		if rows.Scan(&wid, &workspace, &role, &memberStatus, &joined) == nil {
			workspaces = append(workspaces, map[string]any{"id": wid, "name": workspace, "role": role, "status": memberStatus, "joined_at": joined})
		}
	}
	var activeSessions int64
	_ = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM user_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>NOW()`, id).Scan(&activeSessions)
	counts := map[string]int64{}
	countQueries := map[string]string{
		"links":       `SELECT COUNT(*) FROM short_links WHERE created_by=? AND deleted_at IS NULL`,
		"text_shares": `SELECT COUNT(*) FROM text_shares WHERE created_by=?`,
		"file_shares": `SELECT COUNT(*) FROM file_shares WHERE created_by=?`,
		"bio_pages":   `SELECT COUNT(*) FROM bio_pages WHERE created_by=?`,
	}
	for key, query := range countQueries {
		var value int64
		if s.db.QueryRowContext(r.Context(), query, id).Scan(&value) == nil {
			counts[key] = value
		}
	}
	jsonResponse(w, 200, map[string]any{
		"id": id, "email": email, "display_name": name, "status": status,
		"email_verified": verified.Valid, "email_verified_at": nullableTime(verified),
		"last_login_at": nullableTime(lastLogin), "deleted_at": nullableTime(deleted),
		"created_at": created, "active_sessions": activeSessions, "workspaces": workspaces,
		"resources": counts,
	})
}

func (s *server) adminCreateUser(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email         string `json:"email"`
		DisplayName   string `json:"display_name"`
		Password      string `json:"password"`
		EmailVerified bool   `json:"email_verified"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	u, _, err := s.identity.RegisterWithMetadata(r.Context(), in.Email, in.Password, in.DisplayName, requestIP(r), r.UserAgent())
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `DELETE FROM user_sessions WHERE user_id=?`, u.ID)
	if in.EmailVerified {
		_, _ = s.db.ExecContext(r.Context(), `UPDATE users SET email_verified_at=NOW() WHERE id=?`, u.ID)
	}
	admin := currentAdmin(r)
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.user_created','user',?,JSON_OBJECT('administrator_id',?,'email_verified',?))`, u.ID, admin.ID, in.EmailVerified)
	jsonResponse(w, http.StatusCreated, map[string]any{"id": u.ID, "email": u.Email, "display_name": u.DisplayName})
}

func (s *server) adminUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "用户编号无效"})
		return
	}
	var in struct {
		Email       string `json:"email"`
		DisplayName string `json:"display_name"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	if !strings.Contains(in.Email, "@") || in.DisplayName == "" || len(in.DisplayName) > 120 {
		jsonResponse(w, 422, map[string]string{"error": "邮箱或显示名称无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `UPDATE users SET email=?,display_name=? WHERE id=? AND status<>'deleted'`, in.Email, in.DisplayName, id)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": "用户资料保存失败，邮箱可能已被使用"})
		return
	}
	if n, _ := result.RowsAffected(); n != 1 {
		jsonResponse(w, 404, map[string]string{"error": "用户不存在或已经删除"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.user_updated','user',?,JSON_OBJECT('administrator_id',?))`, id, currentAdmin(r).ID)
	jsonResponse(w, 200, map[string]bool{"updated": true})
}

func (s *server) adminDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "用户编号无效"})
		return
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "删除操作失败"})
		return
	}
	defer tx.Rollback()
	var status string
	if err = tx.QueryRowContext(r.Context(), `SELECT status FROM users WHERE id=? FOR UPDATE`, id).Scan(&status); err != nil {
		jsonResponse(w, 404, map[string]string{"error": "用户不存在"})
		return
	}
	if status == "deleted" {
		jsonResponse(w, 409, map[string]string{"error": "用户已经删除"})
		return
	}
	anonymizedEmail := "deleted+" + strconv.FormatInt(id, 10) + "@invalid.local"
	if _, err = tx.ExecContext(r.Context(), `UPDATE users SET email=?,display_name='已删除用户',status='deleted',email_verified_at=NULL,deleted_at=NOW() WHERE id=?`, anonymizedEmail, id); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "删除操作失败"})
		return
	}
	if _, err = tx.ExecContext(r.Context(), `DELETE FROM user_sessions WHERE user_id=?`, id); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "删除操作失败"})
		return
	}
	if _, err = tx.ExecContext(r.Context(), `UPDATE workspace_members SET status='removed' WHERE user_id=? AND role<>'owner'`, id); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "删除操作失败"})
		return
	}
	if _, err = tx.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.user_deleted','user',?,JSON_OBJECT('administrator_id',?))`, id, currentAdmin(r).ID); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "删除操作失败"})
		return
	}
	if err = tx.Commit(); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "删除操作失败"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) adminUserEmailVerification(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	var in struct {
		Verified bool `json:"verified"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": "用户编号无效"})
		return
	}
	admin := currentAdmin(r)
	result, err := s.db.ExecContext(r.Context(), `UPDATE users SET email_verified_at=IF(?,COALESCE(email_verified_at,NOW()),NULL) WHERE id=? AND status<>'deleted'`, in.Verified, id)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "邮箱验证状态修改失败"})
		return
	}
	n, _ := result.RowsAffected()
	if n != 1 {
		jsonResponse(w, 404, map[string]string{"error": "用户不存在或已经删除"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.email_verification','user',?,JSON_OBJECT('verified',?,'administrator_id',?))`, id, in.Verified, admin.ID)
	jsonResponse(w, 200, map[string]bool{"verified": in.Verified})
}

func (s *server) adminUserPasswordReset(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": "用户编号无效"})
		return
	}
	var email string
	if s.db.QueryRowContext(r.Context(), `SELECT email FROM users WHERE id=? AND status<>'deleted'`, id).Scan(&email) != nil {
		jsonResponse(w, 404, map[string]string{"error": "用户不存在"})
		return
	}
	admin := currentAdmin(r)
	token, err := s.identity.CreatePasswordReset(r.Context(), id, &admin.ID)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "无法创建密码重置请求"})
		return
	}
	resetURL := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/") + "/resetpassword?token=" + token
	if _, err = s.mail.QueueTemplate(r.Context(), "password_reset", email, map[string]string{"site_name": "GoJet", "reset_url": resetURL}); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "重置请求已创建，但邮件暂时无法入队"})
		return
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.password_reset','user',?,JSON_OBJECT('administrator_id',?))`, id, admin.ID)
	jsonResponse(w, 202, map[string]bool{"queued": true, "sessions_revoked": true})
}

func (s *server) adminRevokeAllUserSessions(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "用户编号无效"})
		return
	}
	result, err := s.db.ExecContext(r.Context(), `DELETE FROM user_sessions WHERE user_id=?`, id)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "无法注销用户会话"})
		return
	}
	count, _ := result.RowsAffected()
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.user_sessions_revoked','user',?,JSON_OBJECT('administrator_id',?,'sessions',?))`, id, currentAdmin(r).ID, count)
	jsonResponse(w, 200, map[string]any{"revoked": true, "sessions": count})
}

func (s *server) adminOverview(w http.ResponseWriter, r *http.Request) {
	queries := map[string]string{"users": `SELECT COUNT(*) FROM users WHERE status<>'deleted'`, "workspaces": `SELECT COUNT(*) FROM workspaces`, "active_links": `SELECT COUNT(*) FROM short_links WHERE status='active'`, "today_clicks": `SELECT COALESCE(SUM(clicks),0) FROM analytics_daily WHERE metric_date=CURDATE()`, "mail_failures": `SELECT COUNT(*) FROM mail_messages WHERE status='failed'`, "abuse_reports": `SELECT COUNT(*) FROM abuse_reports WHERE status IN ('open','investigating')`, "domain_errors": `SELECT COUNT(*) FROM custom_domains WHERE status='error' OR https_status='error'`, "security_events": `SELECT COUNT(*) FROM security_events WHERE status='open' AND severity IN ('high','critical')`, "file_scan_backlog": `SELECT COUNT(*) FROM file_shares WHERE scan_status IN ('pending','scanning')`, "file_scan_failures": `SELECT COUNT(*) FROM file_shares WHERE scan_status IN ('infected','error')`}
	data := map[string]int64{}
	for key, query := range queries {
		var value int64
		if err := s.db.QueryRowContext(r.Context(), query).Scan(&value); err != nil {
			jsonResponse(w, 503, map[string]string{"error": "平台指标暂时不可用"})
			return
		}
		data[key] = value
	}
	jsonResponse(w, 200, data)
}
func page(r *http.Request) (int, int) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit < 1 || limit > 100 {
		limit = 25
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}
func (s *server) adminUsers(w http.ResponseWriter, r *http.Request) {
	limit, offset := page(r)
	search := "%" + strings.TrimSpace(r.URL.Query().Get("search")) + "%"
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = "%"
	}
	rows, err := s.db.QueryContext(r.Context(), `SELECT u.id,u.email,u.display_name,u.status,u.email_verified_at,u.last_login_at,u.created_at,COUNT(DISTINCT m.workspace_id) FROM users u LEFT JOIN workspace_members m ON m.user_id=u.id AND m.status='active' WHERE (u.email LIKE ? OR u.display_name LIKE ?) AND u.status LIKE ? GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, search, search, status, limit, offset)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "用户列表暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, workspaces int64
		var email, name, userStatus string
		var verified, lastLogin sql.NullTime
		var created time.Time
		if rows.Scan(&id, &email, &name, &userStatus, &verified, &lastLogin, &created, &workspaces) != nil {
			continue
		}
		items = append(items, map[string]any{"id": id, "email": email, "name": name, "status": userStatus, "email_verified": verified.Valid, "last_login_at": nullableTime(lastLogin), "workspaces": workspaces, "created_at": created})
	}
	var total int64
	_ = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM users WHERE (email LIKE ? OR display_name LIKE ?) AND status LIKE ?`, search, search, status).Scan(&total)
	jsonResponse(w, 200, map[string]any{"data": items, "total": total, "limit": limit, "offset": offset})
}
func (s *server) adminUserStatus(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	var in struct{ Status string `json:"status"` }
	if decode(w, r, &in) != nil {
		return
	}
	if err != nil || (in.Status != "active" && in.Status != "suspended") {
		jsonResponse(w, 422, map[string]string{"error": "用户状态无效"})
		return
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "操作失败"})
		return
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(r.Context(), `UPDATE users SET status=? WHERE id=? AND status<>'deleted'`, in.Status, id)
	if err == nil {
		if changed, _ := result.RowsAffected(); changed != 1 {
			jsonResponse(w, 404, map[string]string{"error": "用户不存在或已经删除"})
			return
		}
	}
	if err == nil && in.Status == "suspended" {
		_, err = tx.ExecContext(r.Context(), `DELETE FROM user_sessions WHERE user_id=?`, id)
	}
	if err == nil {
		_, err = tx.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.user_status','user',?,JSON_OBJECT('status',?,'administrator_id',?))`, id, in.Status, currentAdmin(r).ID)
	}
	if err != nil || tx.Commit() != nil {
		jsonResponse(w, 503, map[string]string{"error": "操作失败"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}
func (s *server) adminWorkspaces(w http.ResponseWriter, r *http.Request) {
	limit, offset := page(r)
	rows, err := s.db.QueryContext(r.Context(), `SELECT w.id,w.name,w.workspace_type,w.created_at,u.email,COUNT(m.user_id),COUNT(l.id) FROM workspaces w JOIN users u ON u.id=w.owner_id LEFT JOIN workspace_members m ON m.workspace_id=w.id AND m.status='active' LEFT JOIN short_links l ON l.workspace_id=w.id GROUP BY w.id ORDER BY w.created_at DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "工作区列表暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, members, links int64
		var name, kind, owner string
		var created time.Time
		if rows.Scan(&id, &name, &kind, &created, &owner, &members, &links) == nil {
			items = append(items, map[string]any{"id": id, "name": name, "type": kind, "owner": owner, "members": members, "links": links, "created_at": created})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) adminLinks(w http.ResponseWriter, r *http.Request) {
	limit, offset := page(r)
	rows, err := s.db.QueryContext(r.Context(), `SELECT l.id,l.code,l.destination,l.status,l.created_at,w.name,u.email FROM short_links l JOIN workspaces w ON w.id=l.workspace_id JOIN users u ON u.id=l.created_by WHERE l.deleted_at IS NULL ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "链接列表暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id int64
		var code, destination, status, workspace, email string
		var created time.Time
		if rows.Scan(&id, &code, &destination, &status, &created, &workspace, &email) == nil {
			items = append(items, map[string]any{"id": id, "code": code, "destination": destination, "status": status, "workspace": workspace, "creator": email, "created_at": created})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) adminAudit(w http.ResponseWriter, r *http.Request) {
	limit, offset := page(r)
	rows, err := s.db.QueryContext(r.Context(), `SELECT id,actor,workspace_id,action,target_type,target_id,metadata,created_at FROM (
        SELECT id,COALESCE(administrator_id,0) actor,0 workspace_id,action,'administrator_request' target_type,COALESCE(path,'') target_id,JSON_OBJECT('method',method,'outcome',outcome,'reason',reason,'ip',ip_address) metadata,created_at FROM administrator_audit_logs
        UNION ALL
        SELECT id,COALESCE(actor_user_id,0),COALESCE(workspace_id,0),action,target_type,COALESCE(target_id,''),COALESCE(metadata,JSON_OBJECT()),created_at FROM audit_logs
        ) combined ORDER BY created_at DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "审计日志暂时不可用"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, actor, wid int64
		var action, target, targetID string
		var meta []byte
		var created time.Time
		if rows.Scan(&id, &actor, &wid, &action, &target, &targetID, &meta, &created) == nil {
			items = append(items, map[string]any{"id": id, "actor": actor, "workspace": wid, "action": action, "target_type": target, "target_id": targetID, "metadata": string(meta), "created_at": created})
		}
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
