package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
)

// turnstileGuard validates a configured public mutation without changing the
// downstream request contract. It reads turnstile_token from JSON, restores the
// original body, and lets the existing business handler decode it normally.
func (s *server) turnstileGuard(surface, action string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.turnstileSurfaceEnabled(r.Context(), surface) {
			next(w, r)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
		body, err := io.ReadAll(r.Body)
		if err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "请求内容无法读取"})
			return
		}
		r.Body.Close()
		r.Body = io.NopCloser(bytes.NewReader(body))
		var envelope struct {
			TurnstileToken string `json:"turnstile_token"`
		}
		if json.Unmarshal(body, &envelope) != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "请求格式无效"})
			return
		}
		if !s.enforceTurnstile(w, r, surface, action, envelope.TurnstileToken) {
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		next(w, r)
	}
}
