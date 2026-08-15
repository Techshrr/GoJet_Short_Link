package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSocialAuthRoutesAreRegistered(t *testing.T) {
	mux := http.NewServeMux()
	(&server{}).registerSocialAuthRoutes(mux)

	cases := []struct {
		method  string
		path    string
		pattern string
	}{
		{http.MethodGet, "/api/public/auth/providers", "GET /api/public/auth/providers"},
		{http.MethodGet, "/api/public/auth/google/start", "GET /api/public/auth/{provider}/start"},
		{http.MethodGet, "/api/public/auth/github/callback", "GET /api/public/auth/{provider}/callback"},
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

func TestSocialAuthDispatchRejectsUnknownProviderBeforeBackendAccess(t *testing.T) {
	s := &server{}
	mux := http.NewServeMux()
	s.registerSocialAuthRoutes(mux)

	for _, path := range []string{
		"/api/public/auth/unknown/start",
		"/api/public/auth/unknown/callback",
	} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "http://gojet.test"+path, nil)
		mux.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusNotFound {
			t.Errorf("GET %s status = %d, want %d", path, recorder.Code, http.StatusNotFound)
		}
	}
}
