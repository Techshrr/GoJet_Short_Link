package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultTurnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type turnstileVerifyResponse struct {
	Success    bool     `json:"success"`
	Hostname   string   `json:"hostname"`
	Action     string   `json:"action"`
	ErrorCodes []string `json:"error-codes"`
}

func (s *server) turnstileSurfaceEnabled(ctx context.Context, surface string) bool {
	if !s.registrationBool(ctx, "turnstile.enabled", false) {
		return false
	}
	return s.registrationBool(ctx, "turnstile."+surface, true)
}

func (s *server) turnstileAllowedHostnames(ctx context.Context) []string {
	raw, exists, err := s.settings.Get(ctx, "turnstile.allowed_hostnames")
	if err != nil || !exists || strings.TrimSpace(raw) == "" {
		return nil
	}
	var items []string
	if json.Unmarshal([]byte(raw), &items) != nil {
		var single string
		if json.Unmarshal([]byte(raw), &single) == nil {
			raw = single
		}
		for _, item := range strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == ';' || r == '\n' || r == '\r' }) {
			items = append(items, item)
		}
	}
	out := make([]string, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		item = strings.ToLower(strings.TrimSpace(item))
		item = strings.TrimSuffix(item, ".")
		if item != "" && !seen[item] {
			seen[item] = true
			out = append(out, item)
		}
	}
	return out
}

func hostnameAllowed(hostname string, allowed []string) bool {
	if len(allowed) == 0 {
		return true
	}
	hostname = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(hostname), "."))
	for _, candidate := range allowed {
		if hostname == candidate {
			return true
		}
	}
	return false
}

func (s *server) verifyTurnstile(ctx context.Context, action, token, remoteIP string) error {
	secret := registrationStringFromSettings(ctx, s, "turnstile.secret")
	if secret == "" || secret == "********" {
		return errors.New("Turnstile 已启用但 Secret Key 尚未配置")
	}
	if strings.TrimSpace(token) == "" {
		return errors.New("请完成人机验证")
	}
	values := url.Values{"secret": {secret}, "response": {strings.TrimSpace(token)}}
	if strings.TrimSpace(remoteIP) != "" {
		values.Set("remoteip", remoteIP)
	}
	endpoint := strings.TrimSpace(getenv("TURNSTILE_VERIFY_URL", defaultTurnstileVerifyURL))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := &http.Client{Timeout: 7 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		if s.registrationBool(ctx, "turnstile.fail_open", false) {
			return nil
		}
		return errors.New("人机验证服务暂时不可用")
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		if s.registrationBool(ctx, "turnstile.fail_open", false) {
			return nil
		}
		return errors.New("人机验证服务暂时不可用")
	}
	var result turnstileVerifyResponse
	if err = json.NewDecoder(res.Body).Decode(&result); err != nil {
		if s.registrationBool(ctx, "turnstile.fail_open", false) {
			return nil
		}
		return errors.New("人机验证响应无效")
	}
	if !result.Success {
		return errors.New("人机验证失败，请重试")
	}
	if result.Action != "" && action != "" && result.Action != action {
		return errors.New("人机验证场景不匹配，请刷新页面重试")
	}
	if !hostnameAllowed(result.Hostname, s.turnstileAllowedHostnames(ctx)) {
		return errors.New("人机验证域名不匹配")
	}
	return nil
}

func (s *server) enforceTurnstile(w http.ResponseWriter, r *http.Request, surface, action, token string) bool {
	if !s.turnstileSurfaceEnabled(r.Context(), surface) {
		return true
	}
	if err := s.verifyTurnstile(r.Context(), action, token, clientIP(r)); err != nil {
		status := http.StatusUnprocessableEntity
		if strings.Contains(err.Error(), "尚未配置") || strings.Contains(err.Error(), "暂时不可用") {
			status = http.StatusServiceUnavailable
		}
		jsonResponse(w, status, map[string]string{"error": err.Error(), "code": "turnstile_verification_failed"})
		return false
	}
	return true
}

func registrationStringFromSettings(ctx context.Context, s *server, key string) string {
	return s.registrationString(ctx, key)
}
