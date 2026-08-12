package main

import (
	"context"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/Techshrr/GoJet_Short_Link/app/adminauth"
)

type adminKey struct{}
type adminSessionKey struct{}
type adminResponse struct {
	http.ResponseWriter
	status int
}

func (w *adminResponse) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (s *server) admin(permission string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		a, sessionID, err := s.adminAuth.Authenticate(r.Context(), token)
		if err != nil {
			jsonResponse(w, http.StatusUnauthorized, map[string]string{"error": "管理员会话无效或已过期"})
			return
		}
		a = adminauth.WithBaselinePermissions(a)
		if !adminauth.AllowedAdministrator(a, permission) {
			s.adminAuth.AuditDenied(r.Context(), a, r.Method, r.URL.Path, requestIP(r), r.UserAgent(), "permission denied: "+permission)
			jsonResponse(w, http.StatusForbidden, map[string]string{"error": "当前管理员没有此操作权限"})
			return
		}
		ctx := context.WithValue(r.Context(), adminKey{}, a)
		ctx = context.WithValue(ctx, adminSessionKey{}, sessionID)
		result := &adminResponse{ResponseWriter: w, status: http.StatusOK}
		next(result, r.WithContext(ctx))
		if result.status >= 400 {
			s.adminAuth.AuditDenied(r.Context(), a, r.Method, r.URL.Path, requestIP(r), r.UserAgent(), "handler status "+strconv.Itoa(result.status))
		} else {
			s.adminAuth.AuditRequest(r.Context(), a, r.Method, r.URL.Path, requestIP(r), r.UserAgent())
		}
	}
}

func currentAdmin(r *http.Request) adminauth.Administrator {
	return r.Context().Value(adminKey{}).(adminauth.Administrator)
}

func requireSuperAdministrator(w http.ResponseWriter, r *http.Request) bool {
	if currentAdmin(r).Role == "super_admin" {
		return true
	}
	jsonResponse(w, http.StatusForbidden, map[string]string{"error": "只有超级管理员可以执行此操作"})
	return false
}

func (s *server) adminLogin(w http.ResponseWriter, r *http.Request) {
	var input struct{ Email, Password, Code string }
	if decode(w, r, &input) != nil {
		return
	}
	a, token, twoFactor, err := s.adminAuth.Login(r.Context(), input.Email, input.Password, input.Code, requestIP(r), r.UserAgent())
	if err != nil {
		status := http.StatusUnauthorized
		if twoFactor {
			status = http.StatusPreconditionRequired
		}
		jsonResponse(w, status, map[string]any{"error": err.Error(), "two_factor_required": twoFactor})
		return
	}
	a = adminauth.WithBaselinePermissions(a)
	jsonResponse(w, http.StatusOK, map[string]any{"administrator": a, "token": token})
}

func (s *server) adminMe(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, http.StatusOK, currentAdmin(r))
}
func (s *server) adminLogout(w http.ResponseWriter, r *http.Request) {
	_ = s.adminAuth.Logout(r.Context(), r.Context().Value(adminSessionKey{}).(int64))
	w.WriteHeader(http.StatusNoContent)
}
func (s *server) adminBeginTOTP(w http.ResponseWriter, r *http.Request) {
	secret, uri, err := s.adminAuth.BeginTOTP(r.Context(), currentAdmin(r))
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "无法创建登录双因素认证密钥"})
		return
	}
	jsonResponse(w, http.StatusCreated, map[string]string{"secret": secret, "otpauth_uri": uri})
}
func (s *server) adminConfirmTOTP(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Code string `json:"code"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err := s.adminAuth.ConfirmTOTP(r.Context(), currentAdmin(r), input.Code); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"enabled": true})
}
func (s *server) adminChangePassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err := s.adminAuth.ChangePassword(r.Context(), currentAdmin(r).ID, r.Context().Value(adminSessionKey{}).(int64), input.CurrentPassword, input.NewPassword); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}
func (s *server) adminRevokeSessions(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdministrator(w, r) {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "管理员编号无效"})
		return
	}
	if err = s.adminAuth.RevokeAll(r.Context(), id); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "无法强制退出管理员"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"revoked": true})
}

func administratorRoleTemplates() map[string][]string {
	return map[string][]string{
		"super_admin": adminauth.EffectiveTemplatePermissions("super_admin"),
		"operator":    adminauth.EffectiveTemplatePermissions("operator"),
		"security":    adminauth.EffectiveTemplatePermissions("security"),
		"support":     adminauth.EffectiveTemplatePermissions("support"),
		"analyst":     adminauth.EffectiveTemplatePermissions("analyst"),
		"custom":      adminauth.EffectiveTemplatePermissions("custom"),
	}
}

func (s *server) adminListAdministrators(w http.ResponseWriter, r *http.Request) {
	items, err := s.adminAuth.List(r.Context())
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "管理员列表暂时不可用"})
		return
	}
	for i := range items {
		items[i].Administrator = adminauth.WithBaselinePermissions(items[i].Administrator)
	}
	jsonResponse(w, 200, map[string]any{
		"data":               items,
		"permission_catalog": adminauth.PermissionCatalog(),
		"role_templates":     administratorRoleTemplates(),
	})
}
func (s *server) adminCreateAdministrator(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdministrator(w, r) {
		return
	}
	var input struct {
		Email       string   `json:"email"`
		DisplayName string   `json:"display_name"`
		Password    string   `json:"password"`
		Role        string   `json:"role"`
		Permissions []string `json:"permissions"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	id, err := s.adminAuth.Create(r.Context(), input.Email, input.DisplayName, input.Password, input.Role, input.Permissions)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, map[string]int64{"id": id})
}
func (s *server) adminUpdateAdministrator(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdministrator(w, r) {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	var input struct {
		Role        string   `json:"role"`
		Status      string   `json:"status"`
		Permissions []string `json:"permissions"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "管理员编号无效"})
		return
	}
	if err = s.adminAuth.Update(r.Context(), currentAdmin(r).ID, id, input.Role, input.Status, input.Permissions); err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]bool{"updated": true})
}

func requestIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer := net.ParseIP(host)
	if peer != nil && (peer.IsLoopback() || peer.IsPrivate()) {
		if forwarded := net.ParseIP(strings.TrimSpace(r.Header.Get("X-Real-IP"))); forwarded != nil {
			return forwarded.String()
		}
	}
	return host
}
