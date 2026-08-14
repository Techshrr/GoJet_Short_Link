package main

import "net/http"

func (s *server) registerEmailCodeRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/account-policy", s.authPolicy)
	mux.HandleFunc("GET /api/public/auth/providers", s.publicSocialProviders)
	mux.HandleFunc("GET /api/public/auth/{provider}/start", s.socialAuthStart)
	mux.HandleFunc("GET /api/public/auth/{provider}/callback", s.socialAuthCallback)
	mux.HandleFunc("POST /api/public/auth/handoff", s.socialAuthHandoff)
	mux.HandleFunc("POST /api/public/email-code", s.requestAuthCode)
	mux.HandleFunc("POST /api/public/register-email-code", s.registerByCode)
	mux.HandleFunc("POST /api/public/login-email-code", s.loginByCode)
}
