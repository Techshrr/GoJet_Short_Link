package main

import "net/http"

func (s *server) registerSocialAuthRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/auth/providers", s.publicSocialProviders)
	mux.HandleFunc("GET /api/public/auth/{provider}/start", sanitizeSocialRedirect(s.socialLoginStart))
	mux.HandleFunc("GET /api/public/auth/{provider}/callback", s.socialLoginCallback)
	mux.HandleFunc("POST /api/public/auth/handoff", s.socialAuthHandoff)
	mux.HandleFunc("GET /api/public/auth/rainbow/bind-launch", s.rainbowBindLaunch)

	mux.HandleFunc("GET /api/admin/auth/providers", s.admin("settings.manage", s.adminSocialProviders))

	mux.HandleFunc("GET /api/me/social-identities", s.user(s.mySocialIdentities))
	mux.HandleFunc("POST /api/me/social/{provider}/bind/start", s.user(s.socialBindStart))
	mux.HandleFunc("DELETE /api/me/social/{provider}", s.user(s.socialUnbind))
}

func (s *server) socialLoginStart(w http.ResponseWriter, r *http.Request) {
	switch r.PathValue("provider") {
	case "google":
		s.googleAuthStart(w, r)
	case "facebook":
		s.facebookAuthStart(w, r)
	case "github":
		s.socialAuthStart(w, r)
	case "qq":
		s.qqAuthStart(w, r)
	case "wechat":
		s.wechatAuthStart(w, r)
	case "rainbow":
		s.rainbowAuthStart(w, r)
	default:
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "未知的第三方登录方式"})
	}
}

func (s *server) socialLoginCallback(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	var next http.HandlerFunc
	switch provider {
	case "google":
		next = s.googleAuthCallback
	case "facebook":
		next = s.facebookAuthCallback
	case "github":
		next = s.socialAuthCallback
	case "qq":
		next = s.qqAuthCallback
	case "wechat":
		next = s.wechatAuthCallback
	case "rainbow":
		next = s.rainbowAuthCallback
	default:
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "未知的第三方登录方式"})
		return
	}
	s.socialCallbackRouter(provider, next)(w, r)
}
