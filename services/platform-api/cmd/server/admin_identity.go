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
		if !adminauth.Allowed(a.Role, permission) {
			s.adminAuth.AuditDenied(r.Context(), a, r.Method, r.URL.Path, requestIP(r), r.UserAgent(), "permission denied: "+permission)
			jsonResponse(w, http.StatusForbidden, map[string]string{"error": "当前管理员角色没有此操作权限"})
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
		jsonResponse(w, 503, map[string]string{"error": "无法创建二次验证密钥"})
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
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid administrator"})
		return
	}
	if err = s.adminAuth.RevokeAll(r.Context(), id); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "无法强制退出管理员"})
		return
	}
	jsonResponse(w, 200, map[string]bool{"revoked": true})
}

func (s *server) adminListAdministrators(w http.ResponseWriter, r *http.Request) {
	items, err := s.adminAuth.List(r.Context())
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "管理员列表暂时不可用"})
		return
	}
	jsonResponse(w, 200, map[string]any{"data": items})
}
func (s *server) adminCreateAdministrator(w http.ResponseWriter, r *http.Request) {
	var input struct{ Email, DisplayName, Password, Role string }
	if decode(w, r, &input) != nil {
		return
	}
	id, err := s.adminAuth.Create(r.Context(), input.Email, input.DisplayName, input.Password, input.Role)
	if err != nil {
		jsonResponse(w, 422, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 201, map[string]int64{"id": id})
}
func (s *server) adminUpdateAdministrator(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	var input struct{ Role, Status string }
	if decode(w, r, &input) != nil {
		return
	}
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid administrator"})
		return
	}
	if err = s.adminAuth.Update(r.Context(), currentAdmin(r).ID, id, input.Role, input.Status); err != nil {
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
