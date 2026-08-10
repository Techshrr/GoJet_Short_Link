package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Techshrr/GoJet_Short_Link/app/identity"
)

type userKey struct{}

func (s *server) user(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		u, err := s.identity.Authenticate(r.Context(), token)
		if err != nil {
			jsonResponse(w, 401, map[string]string{"error": "请先登录"})
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), userKey{}, u)))
	}
}

func currentUser(r *http.Request) identity.User { return r.Context().Value(userKey{}).(identity.User) }

func settingEnabled(value string, exists bool, fallback bool) bool {
	if !exists {
		return fallback
	}
	return strings.EqualFold(strings.TrimSpace(value), "true") || strings.TrimSpace(value) == "1"
}

func (s *server) revokeUserSessions(ctx context.Context, userID int64) error {
	_, err := s.db.ExecContext(ctx, `UPDATE user_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP()) WHERE user_id=? AND revoked_at IS NULL`, userID)
	return err
}

func (s *server) register(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	ctx := r.Context()
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if !s.registrationBool(ctx, "registration.enabled", true) {
		jsonResponse(w, 403, map[string]string{"error": "当前暂未开放新用户注册"})
		return
	}
	if s.blockedRegistrationEmail(ctx, email) {
		jsonResponse(w, 422, map[string]string{"error": "该邮箱域名不允许注册"})
		return
	}
	minPassword := s.registrationInt(ctx, "registration.password_min_length", 10, 10, 72)
	if len(in.Password) < minPassword {
		jsonResponse(w, 422, map[string]string{"error": fmt.Sprintf("密码至少需要 %d 位", minPassword)})
		return
	}
	requireVerification := s.registrationBool(ctx, "registration.require_email_verification", false)
	u, token, err := s.identity.RegisterWithMetadata(ctx, email, in.Password, in.DisplayName, clientIP(r), r.UserAgent())
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	if !requireVerification {
		jsonResponse(w, 201, map[string]any{"user": u, "token": token, "verification_required": false})
		return
	}
	if err = s.revokeUserSessions(ctx, u.ID); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "账户已创建，但暂时无法进入邮箱验证状态"})
		return
	}
	verificationToken, createErr := s.identity.CreateVerification(ctx, u.ID)
	if createErr != nil {
		jsonResponse(w, 503, map[string]string{"error": "账户已创建，但暂时无法创建邮箱验证请求"})
		return
	}
	base := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/")
	verificationURL := base + "/verify-email?token=" + verificationToken
	_, mailErr := s.mail.QueueTemplate(ctx, "verification", u.Email, map[string]string{
		"site_name":        "GoJet",
		"token":            verificationToken,
		"verification_url": verificationURL,
	})
	if mailErr != nil {
		jsonResponse(w, 201, map[string]any{"user": u, "verification_required": true, "verification_queued": false, "message": "账户已创建，请稍后在登录页重新发送验证邮件"})
		return
	}
	jsonResponse(w, 201, map[string]any{"user": u, "verification_required": true, "verification_queued": true})
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	ctx := r.Context()
	email := strings.ToLower(strings.TrimSpace(in.Email))
	ip := clientIP(r)
	if s.loginRateExceeded(ctx, email, ip) {
		jsonResponse(w, 429, map[string]string{"error": "登录失败次数过多，请稍后再试"})
		return
	}
	u, token, err := s.identity.LoginWithMetadata(ctx, email, in.Password, ip, r.UserAgent())
	if err != nil {
		s.recordLoginAttempt(ctx, email, ip, "failure")
		jsonResponse(w, 401, map[string]string{"error": "邮箱或密码错误"})
		return
	}
	s.recordLoginAttempt(ctx, email, ip, "success")
	if s.registrationBool(ctx, "registration.require_email_verification", false) && !u.EmailVerified {
		if revokeErr := s.revokeUserSessions(ctx, u.ID); revokeErr != nil {
			jsonResponse(w, 503, map[string]string{"error": "邮箱验证状态暂时不可用"})
			return
		}
		jsonResponse(w, 403, map[string]any{"error": "请先完成邮箱验证", "email_verification_required": true})
		return
	}
	jsonResponse(w, 200, map[string]any{"user": u, "token": token})
}

func (s *server) verifyEmail(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token string `json:"token"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if err := s.identity.VerifyEmail(r.Context(), in.Token); err != nil {
		jsonResponse(w, 422, map[string]string{"error": "验证链接无效或已过期"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"verified": true})
}

func (s *server) me(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, currentUser(r)) }
func pathID(r *http.Request, name string) (int64, error) {
	return strconv.ParseInt(r.PathValue(name), 10, 64)
}
func (s *server) createWorkspace(w http.ResponseWriter, r *http.Request) {
	var in struct{ Name, Type string }
	if decode(w, r, &in) != nil {
		return
	}
	id, err := s.workspace.Create(r.Context(), currentUser(r).ID, in.Name, in.Type)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, map[string]int64{"id": id})
}
func (s *server) listWorkspaces(w http.ResponseWriter, r *http.Request) {
	items, err := s.workspace.List(r.Context(), currentUser(r).ID)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "工作区暂时不可用"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) invite(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	var in struct{ Email, Role string }
	if decode(w, r, &in) != nil {
		return
	}
	token, err := s.workspace.Invite(r.Context(), currentUser(r).ID, wid, in.Email, in.Role)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "没有管理成员的权限"})
		return
	}
	_, mailErr := s.mail.QueueTemplate(r.Context(), "workspace_invitation", in.Email, map[string]string{"site_name": "GoJet", "inviter": currentUser(r).Email, "token": token})
	if mailErr != nil {
		jsonResponse(w, 503, map[string]string{"error": "邀请已创建，但邮件暂时无法入队"})
		return
	}
	jsonResponse(w, 201, map[string]bool{"queued": true})
}
func (s *server) workspaceMembers(w http.ResponseWriter, r *http.Request) {
	wid, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	members, invitations, err := s.workspace.Members(r.Context(), currentUser(r).ID, wid)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法读取成员"})
		return
	}
	jsonResponse(w, 200, map[string]any{"members": members, "invitations": invitations})
}
func (s *server) resendInvite(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	iid, e2 := pathID(r, "invitation")
	if e1 != nil || e2 != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid invitation"})
		return
	}
	token, email, err := s.workspace.Resend(r.Context(), currentUser(r).ID, wid, iid)
	if err != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法重新发送邀请"})
		return
	}
	if _, err = s.mail.QueueTemplate(r.Context(), "workspace_invitation", email, map[string]string{"site_name": "GoJet", "inviter": currentUser(r).Email, "token": token}); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "邮件暂时无法入队"})
		return
	}
	jsonResponse(w, 202, map[string]bool{"queued": true})
}
func (s *server) rejectInvite(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token string `json:"token"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if s.workspace.Reject(r.Context(), in.Token) != nil {
		jsonResponse(w, 422, map[string]string{"error": "邀请无效或已过期"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"rejected": true})
}
func (s *server) acceptInvite(w http.ResponseWriter, r *http.Request) {
	var in struct{ Token string }
	if decode(w, r, &in) != nil {
		return
	}
	if err := s.workspace.Accept(r.Context(), currentUser(r).ID, in.Token); err != nil {
		jsonResponse(w, 422, map[string]string{"error": "邀请无效、已过期或邮箱不匹配"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"accepted": true})
}
func (s *server) revokeInvite(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	iid, e2 := pathID(r, "invitation")
	if e1 != nil || e2 != nil || s.workspace.Revoke(r.Context(), currentUser(r).ID, wid, iid) != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法撤销邀请"})
		return
	}
	w.WriteHeader(204)
}
func (s *server) changeMemberRole(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	uid, e2 := pathID(r, "user")
	var in struct{ Role string }
	if decode(w, r, &in) != nil {
		return
	}
	if e1 != nil || e2 != nil || s.workspace.ChangeRole(r.Context(), currentUser(r).ID, wid, uid, in.Role) != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法修改角色"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}
func (s *server) removeMember(w http.ResponseWriter, r *http.Request) {
	wid, e1 := pathID(r, "id")
	uid, e2 := pathID(r, "user")
	if e1 != nil || e2 != nil || s.workspace.Remove(r.Context(), currentUser(r).ID, wid, uid) != nil {
		jsonResponse(w, 403, map[string]string{"error": "无法移除成员"})
		return
	}
	w.WriteHeader(204)
}

// resetPassword serves both password-reset request creation and final reset so
// the existing API path remains backward compatible while the public UI gains
// a real /forgot-password page. Sending {email} requests a reset; sending
// {token,password} consumes it.
func (s *server) resetPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	ctx := r.Context()
	if strings.TrimSpace(in.Token) == "" {
		if !s.registrationBool(ctx, "registration.forgot_password", true) {
			jsonResponse(w, 403, map[string]string{"error": "密码找回功能当前已关闭"})
			return
		}
		email := strings.ToLower(strings.TrimSpace(in.Email))
		if !strings.Contains(email, "@") {
			jsonResponse(w, 202, map[string]bool{"queued": true})
			return
		}
		var userID int64
		err := s.db.QueryRowContext(ctx, `SELECT id FROM users WHERE email=? AND status='active'`, email).Scan(&userID)
		if err == nil {
			token, createErr := s.identity.CreatePasswordReset(ctx, userID, nil)
			if createErr == nil {
				base := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:8080"), "/")
				resetURL := base + "/reset-password?token=" + token
				_, _ = s.mail.QueueTemplate(ctx, "password_reset", email, map[string]string{"site_name": "GoJet", "reset_url": resetURL})
			}
		} else if err != sql.ErrNoRows {
			jsonResponse(w, 503, map[string]string{"error": "密码重置服务暂时不可用"})
			return
		}
		jsonResponse(w, 202, map[string]bool{"queued": true})
		return
	}
	minPassword := s.registrationInt(ctx, "registration.password_min_length", 10, 10, 72)
	if len(in.Password) < minPassword {
		jsonResponse(w, 422, map[string]string{"error": fmt.Sprintf("新密码至少需要 %d 位", minPassword)})
		return
	}
	if err := s.identity.ResetPassword(ctx, in.Token, in.Password); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"reset": true})
}
