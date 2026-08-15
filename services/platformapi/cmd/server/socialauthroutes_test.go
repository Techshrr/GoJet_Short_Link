package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSocialAuthRoutesAreRegisteredByProductionRegistrar(t *testing.T) {
	mux := http.NewServeMux()
	(&server{}).registerEmailCodeRoutes(mux)

	cases := []struct {
		method  string
		path    string
		pattern string
	}{
		{http.MethodGet, "/api/public/auth/providers", "GET /api/public/auth/providers"},
		{http.MethodGet, "/api/public/auth/google/start", "GET /api/public/auth/google/start"},
		{http.MethodGet, "/api/public/auth/facebook/start", "GET /api/public/auth/facebook/start"},
		{http.MethodGet, "/api/public/auth/github/start", "GET /api/public/auth/github/start"},
		{http.MethodGet, "/api/public/auth/qq/start", "GET /api/public/auth/qq/start"},
		{http.MethodGet, "/api/public/auth/wechat/start", "GET /api/public/auth/wechat/start"},
		{http.MethodGet, "/api/public/auth/rainbow/start", "GET /api/public/auth/rainbow/start"},
		{http.MethodGet, "/api/public/auth/github/callback", "GET /api/public/auth/github/callback"},
		{http.MethodPost, "/api/public/auth/handoff", "POST /api/public/auth/handoff"},
		{http.MethodGet, "/api/public/auth/rainbow/bind-launch", "GET /api/public/auth/rainbow/bind-launch"},
		{http.MethodGet, "/api/admin/auth/providers", "GET /api/admin/auth/providers"},
		{http.MethodGet, "/api/me/social-identities", "GET /api/me/social-identities"},
		{http.MethodPost, "/api/me/social/github/bind/start", "POST /api/me/social/{provider}/bind/start"},
		{http.MethodDelete, "/api/me/social/github", "DELETE /api/me/social/{provider}"},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, "http://gojet.test"+tc.path, nil)
		_, pattern := mux.Handler(req)
		if pattern != tc.pattern {
			t.Errorf("%s %s matched %q, want %q", tc.method, tc.path, pattern, tc.pattern)
		}
	}
}

func TestUnknownSocialLoginProviderHasNoProductionRoute(t *testing.T) {
	mux := http.NewServeMux()
	(&server{}).registerEmailCodeRoutes(mux)

	for _, path := range []string{
		"/api/public/auth/unknown/start",
		"/api/public/auth/unknown/callback",
	} {
		request := httptest.NewRequest(http.MethodGet, "http://gojet.test"+path, nil)
		_, pattern := mux.Handler(request)
		if pattern != "" {
			t.Errorf("GET %s unexpectedly matched %q", path, pattern)
		}
	}
}
