package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

var turnstileAdminKeys = []string{
	"turnstile.enabled",
	"turnstile.site_key",
	"turnstile.fail_open",
	"turnstile.allowed_hostnames",
	"turnstile.registration",
	"turnstile.login",
	"turnstile.forgot_password",
	"turnstile.reset_password",
	"turnstile.ticket_create",
	"turnstile.ticket_reply",
	"turnstile.abuse_report",
}

func (s *server) getBotProtectionSettings(w http.ResponseWriter, r *http.Request) {
	out := map[string]any{}
	for _, key := range turnstileAdminKeys {
		raw, exists, err := s.settings.Get(r.Context(), key)
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "人机验证设置读取失败"})
			return
		}
		if exists {
			out[key] = decodeSetting(raw)
		}
	}
	secret, exists, err := s.settings.Get(r.Context(), "turnstile.secret")
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "人机验证密钥状态读取失败"})
		return
	}
	out["turnstile.secret_configured"] = exists && strings.TrimSpace(secret) != ""
	jsonResponse(w, http.StatusOK, out)
}

func (s *server) saveBotProtectionSettings(w http.ResponseWriter, r *http.Request) {
	var values map[string]any
	if decode(w, r, &values) != nil {
		return
	}
	allowed := map[string]bool{"turnstile.secret": true}
	for _, key := range turnstileAdminKeys {
		allowed[key] = true
	}
	for key := range values {
		if !allowed[key] {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "不允许的人机验证设置项: " + key})
			return
		}
	}
	if raw, ok := values["turnstile.allowed_hostnames"]; ok {
		switch value := raw.(type) {
		case string:
			items := []string{}
			for _, item := range strings.FieldsFunc(value, func(r rune) bool { return r == ',' || r == ';' || r == '\n' || r == '\r' }) {
				item = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(item), "."))
				if item != "" {
					items = append(items, item)
				}
			}
			values["turnstile.allowed_hostnames"] = items
		case []any:
			// Accepted as supplied; JSON encoding below preserves the list.
		default:
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "允许域名格式无效"})
			return
		}
	}
	for key, raw := range values {
		if key == "turnstile.secret" {
			secret, ok := raw.(string)
			secret = strings.TrimSpace(secret)
			if !ok || secret == "" || secret == "********" {
				continue
			}
			encoded, _ := json.Marshal(secret)
			if err := s.settings.Set(r.Context(), key, string(encoded), true); err != nil {
				jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "Secret Key 保存失败"})
				return
			}
			continue
		}
		encoded, err := encodeSetting(raw)
		if err != nil {
			jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "设置格式无效: " + key})
			return
		}
		if err = s.settings.Set(r.Context(), key, encoded, false); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "人机验证设置保存失败"})
			return
		}
	}
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(action,target_type,target_id,metadata) VALUES('admin.turnstile_updated','settings','turnstile',JSON_OBJECT('keys',?))`, strings.Join(mapKeys(values), ","))
	s.invalidatePublicSettings(r.Context())
	jsonResponse(w, http.StatusOK, map[string]bool{"saved": true})
}
