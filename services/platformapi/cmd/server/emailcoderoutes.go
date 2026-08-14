package main

import (
	"net/http"
	"strings"
)

func (s *server) registerEmailCodeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/account-policy", s.authPolicy)
	mux.HandleFunc("GET /api/public/auth/providers", noStoreHandler(s.publicSocialProviders))
	mux.HandleFunc("GET /api/public/auth/google/start", noStoreHandler(sanitizeSocialRedirect(s.googleAuthStart)))
	mux.HandleFunc("GET /api/public/auth/google/callback", noStoreHandler(s.googleAuthCallback))
	mux.HandleFunc("GET /api/public/auth/{provider}/start", noStoreHandler(sanitizeSocialRedirect(s.socialAuthStart)))
	mux.HandleFunc("GET /api/public/auth/{provider}/callback", noStoreHandler(s.socialAuthCallback))
	mux.HandleFunc("POST /api/public/auth/handoff", noStoreHandler(s.socialAuthHandoff))
	mux.HandleFunc("GET /api/admin/auth/providers", noStoreHandler(s.admin("settings.manage", s.adminSocialProviders)))
	mux.HandleFunc("POST /api/public/email-code", s.requestAuthCode)
	mux.HandleFunc("POST /api/public/register-email-code", s.registerByCode)
	mux.HandleFunc("POST /api/public/login-email-code", s.loginByCode)
}

func noStoreHandler(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Pragma", "no-cache")
		next(w, r)
	}
}

func sanitizeSocialRedirect(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		target := r.URL.Query().Get("redirect")
		if target == "" || !unsafeAuthRedirect(target) {
			next(w, r)
			return
		}
		clone := r.Clone(r.Context())
		clonedURL := *r.URL
		query := clonedURL.Query()
		query.Del("redirect")
		clonedURL.RawQuery = query.Encode()
		clone.URL = &clonedURL
		next(w, clone)
	}
}

func unsafeAuthRedirect(target string) bool {
	if strings.Contains(target, `\`) {
		return true
	}
	return strings.IndexFunc(target, func(r rune) bool { return r < 0x20 || r == 0x7f }) >= 0
}
