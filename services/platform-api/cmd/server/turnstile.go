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
		item = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(item), "."))
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
		candidate = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(candidate), "."))
		if hostname == candidate {
			return true
		}
	}
	return false
}

// verifyTurnstileWithClient contains the complete external verification contract
// without any database dependency so the security boundary is executable in CI.
// failOpen is intentionally limited to transport errors and non-2xx upstream
// responses. A negative, malformed, wrong-action or wrong-hostname challenge is
// always rejected.
func verifyTurnstileWithClient(ctx context.Context, client *http.Client, endpoint, secret, action, token, remoteIP string, allowedHostnames []string, failOpen bool) error {
	secret = strings.TrimSpace(secret)
	if secret == "" || secret == "********" {
		return errors.New("Turnstile 已启用但 Secret Key 尚未配置")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return errors.New("请完成人机验证")
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		endpoint = defaultTurnstileVerifyURL
	}
	values := url.Values{"secret": {secret}, "response": {token}}
	if strings.TrimSpace(remoteIP) != "" {
		values.Set("remoteip", strings.TrimSpace(remoteIP))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return errors.New("人机验证请求无法创建")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if client == nil {
		client = &http.Client{Timeout: 7 * time.Second}
	}
	res, err := client.Do(req)
	if err != nil {
		if failOpen {
			return nil
		}
		return errors.New("人机验证服务暂时不可用")
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		if failOpen {
			return nil
		}
		return errors.New("人机验证服务暂时不可用")
	}
	var result turnstileVerifyResponse
	if err = json.NewDecoder(res.Body).Decode(&result); err != nil {
		return errors.New("人机验证响应无效")
	}
	if !result.Success {
		return errors.New("人机验证失败，请重试")
	}
	if result.Action != "" && action != "" && result.Action != action {
		return errors.New("人机验证场景不匹配，请刷新页面重试")
	}
	if !hostnameAllowed(result.Hostname, allowedHostnames) {
		return errors.New("人机验证域名不匹配")
	}
	return nil
}

func (s *server) verifyTurnstile(ctx context.Context, action, token, remoteIP string) error {
	return verifyTurnstileWithClient(
		ctx,
		&http.Client{Timeout: 7 * time.Second},
		getenv("TURNSTILE_VERIFY_URL", defaultTurnstileVerifyURL),
		registrationStringFromSettings(ctx, s, "turnstile.secret"),
		action,
		token,
		remoteIP,
		s.turnstileAllowedHostnames(ctx),
		s.registrationBool(ctx, "turnstile.fail_open", false),
	)
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
