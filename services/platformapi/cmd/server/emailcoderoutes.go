package main

import "net/http"

func (s *server) registerEmailCodeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/account-policy", s.authPolicy)
	mux.HandleFunc("GET /api/public/auth/providers", noStoreHandler(s.publicSocialProviders))
	mux.HandleFunc("GET /api/public/auth/{provider}/start", noStoreHandler(s.socialAuthStart))
	mux.HandleFunc("GET /api/public/auth/{provider}/callback", noStoreHandler(s.socialAuthCallback))
	mux.HandleFunc("POST /api/public/auth/handoff", noStoreHandler(s.socialAuthHandoff))
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
