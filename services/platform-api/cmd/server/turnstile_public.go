package main

import "net/http"

func (s *server) publicBotProtection(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	enabled := s.registrationBool(ctx, "turnstile.enabled", false)
	out := map[string]any{
		"enabled": enabled,
		"site_key": "",
		"surfaces": map[string]bool{
			"registration":    enabled && s.registrationBool(ctx, "turnstile.registration", true),
			"login":           enabled && s.registrationBool(ctx, "turnstile.login", true),
			"forgot_password": enabled && s.registrationBool(ctx, "turnstile.forgot_password", true),
			"reset_password":  enabled && s.registrationBool(ctx, "turnstile.reset_password", true),
			"ticket_create":   enabled && s.registrationBool(ctx, "turnstile.ticket_create", true),
			"ticket_reply":    enabled && s.registrationBool(ctx, "turnstile.ticket_reply", true),
			"abuse_report":    enabled && s.registrationBool(ctx, "turnstile.abuse_report", true),
		},
	}
	if enabled {
		out["site_key"] = s.registrationString(ctx, "turnstile.site_key")
	}
	jsonResponse(w, http.StatusOK, out)
}
