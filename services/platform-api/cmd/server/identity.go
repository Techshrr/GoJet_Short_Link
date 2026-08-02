package main

import (
	"context"
	"github.com/Techshrr/GoJet_Short_Link/app/identity"
	"net/http"
	"strconv"
	"strings"
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
func (s *server) register(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	if enabled, exists, _ := s.settings.Get(r.Context(), "registration.enabled"); exists && enabled == "false" {
		jsonResponse(w, 403, map[string]string{"error": "当前未开放注册"})
		return
	}
	u, token, err := s.identity.Register(r.Context(), in.Email, in.Password, in.DisplayName)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, map[string]any{"user": u, "token": token})
}
func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	u, token, err := s.identity.Login(r.Context(), in.Email, in.Password)
	if err != nil {
		jsonResponse(w, 401, map[string]string{"error": "邮箱或密码错误"})
		return
	}
	if required, exists, _ := s.settings.Get(r.Context(), "registration.require_email_verification"); exists && required == "true" && !u.EmailVerified {
		jsonResponse(w, 403, map[string]string{"error": "请先完成邮箱验证"})
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
	_, mailErr := s.mail.Queue(r.Context(), "workspace_invitation", in.Email, "邀请您加入 GoJet 工作区", "<p>您被邀请加入 GoJet 工作区。</p><p>邀请令牌：<strong>"+htmlEscape(token)+"</strong></p>")
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
	if _, err = s.mail.Queue(r.Context(), "workspace_invitation", email, "GoJet 工作区邀请已重新发送", "<p>新的邀请令牌：<strong>"+htmlEscape(token)+"</strong></p>"); err != nil {
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
