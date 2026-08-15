package main

import (
	"context"
	"net/http"
	"strings"
)

func (s *server) rainbowLoginTypeExposed(ctx context.Context, value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	if !validRainbowLoginType(value) {
		return false
	}
	for _, item := range s.rainbowSelectedLoginTypes(ctx) {
		if item["id"] == value {
			return true
		}
	}
	return false
}

// rainbowCallbackPolicy re-checks the administrator-approved Rainbow method
// at callback time. A method can be disabled while an upstream authorization
// page is still open; pending login/bind attempts must not outlive that policy
// change merely because they were valid when the flow started.
func (s *server) rainbowCallbackPolicy(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		loginType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
		if !validRainbowLoginType(loginType) {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "聚合登录回调方式无效"})
			return
		}
		if !s.rainbowLoginTypeExposed(r.Context(), loginType) {
			jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该聚合登录方式当前未开放"})
			return
		}
		next(w, r)
	}
}
