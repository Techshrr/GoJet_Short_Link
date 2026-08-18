package main

import (
	"encoding/json"
	"net/http"
)

func bufferedStatus(buffer *bufferedSocialResponse) int {
	if buffer.status == 0 { return http.StatusOK }
	return buffer.status
}

func replayBufferedResponse(w http.ResponseWriter, buffer *bufferedSocialResponse) {
	for key, values := range buffer.header {
		w.Header()[key] = append([]string(nil), values...)
	}
	w.WriteHeader(bufferedStatus(buffer))
	_, _ = w.Write(buffer.body.Bytes())
}

// p15SocialAuthHandoff upgrades the existing one-time OAuth handoff into the
// V5 browser session contract without changing the underlying provider/audit
// logic. MFA is enforced here as well so an OAuth login cannot bypass TOTP.
func (s *server) p15SocialAuthHandoff(w http.ResponseWriter, r *http.Request) {
	buffer := newBufferedSocialResponse()
	s.socialAuthHandoff(buffer, r)
	status := bufferedStatus(buffer)
	if status < 200 || status >= 300 {
		replayBufferedResponse(w, buffer)
		return
	}
	var payload struct {
		User struct { ID int64 `json:"id"` } `json:"user"`
		Token string `json:"token"`
		Redirect string `json:"redirect"`
	}
	if json.Unmarshal(buffer.body.Bytes(), &payload) != nil || payload.User.ID <= 0 || payload.Token == "" {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"第三方登录会话创建失败"})
		return
	}
	if s.userMFAEnabled(r.Context(), payload.User.ID) {
		_ = s.identity.RevokeToken(r.Context(), payload.Token)
		challenge, err := s.createMFAChallenge(r.Context(), payload.User.ID)
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"暂时无法创建二次验证请求"})
			return
		}
		jsonResponse(w, http.StatusAccepted, map[string]any{"two_factor_required":true,"challenge":challenge,"redirect":safeSocialReturn(payload.Redirect)})
		return
	}
	csrf := s.setUserSessionCookies(w, r, payload.Token)
	var out map[string]any
	_ = json.Unmarshal(buffer.body.Bytes(), &out)
	out["csrfToken"] = csrf
	jsonResponse(w, status, out)
}

// p15SocialRegistrationComplete keeps the existing social-registration truth
// and simply promotes the returned server-side session into an HttpOnly cookie.
func (s *server) p15SocialRegistrationComplete(w http.ResponseWriter, r *http.Request) {
	buffer := newBufferedSocialResponse()
	s.socialRegistrationComplete(buffer, r)
	status := bufferedStatus(buffer)
	if status < 200 || status >= 300 {
		replayBufferedResponse(w, buffer)
		return
	}
	var out map[string]any
	if json.Unmarshal(buffer.body.Bytes(), &out) != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"第三方注册会话创建失败"})
		return
	}
	token, _ := out["token"].(string)
	if token == "" {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error":"第三方注册会话创建失败"})
		return
	}
	out["csrfToken"] = s.setUserSessionCookies(w, r, token)
	jsonResponse(w, status, out)
}
