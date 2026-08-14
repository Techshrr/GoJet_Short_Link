package main

import (
	"context"
	"net/http"
	"strings"
)

type socialProviderDefinition struct {
	ID    string
	Label string
}

var socialProviderDefinitions = []socialProviderDefinition{
	{ID: "google", Label: "Google"},
	{ID: "facebook", Label: "Facebook"},
	{ID: "github", Label: "GitHub"},
	{ID: "qq", Label: "QQ"},
	{ID: "wechat", Label: "微信"},
	{ID: "rainbow", Label: "彩虹聚合登录"},
}

func init() {
	keys := map[string]bool{}
	for _, provider := range socialProviderDefinitions {
		prefix := "auth.social." + provider.ID + "."
		keys[prefix+"enabled"] = true
		keys[prefix+"client_id"] = true
		keys[prefix+"client_secret"] = true
		sensitiveSettings[prefix+"client_secret"] = true
	}
	keys["auth.social.rainbow.base_url"] = true
	settingSections["socialauth"] = keys
}

func (s *server) publicSocialProviders(w http.ResponseWriter, r *http.Request) {
	providers := make([]map[string]string, 0, len(socialProviderDefinitions))
	for _, definition := range socialProviderDefinitions {
		configured, err := s.socialProviderConfigured(r.Context(), definition.ID)
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置暂时不可用"})
			return
		}
		if !configured {
			continue
		}
		providers = append(providers, map[string]string{
			"id":    definition.ID,
			"label": definition.Label,
		})
	}
	jsonResponse(w, http.StatusOK, map[string]any{"providers": providers})
}

func (s *server) socialProviderConfigured(ctx context.Context, provider string) (bool, error) {
	prefix := "auth.social." + provider + "."
	enabled, err := s.socialBoolSetting(ctx, prefix+"enabled")
	if err != nil || !enabled {
		return false, err
	}
	clientID, err := s.socialStringSetting(ctx, prefix+"client_id")
	if err != nil || strings.TrimSpace(clientID) == "" {
		return false, err
	}
	secret, err := s.socialStringSetting(ctx, prefix+"client_secret")
	if err != nil || strings.TrimSpace(secret) == "" {
		return false, err
	}
	if provider == "rainbow" {
		baseURL, getErr := s.socialStringSetting(ctx, prefix+"base_url")
		if getErr != nil || strings.TrimSpace(baseURL) == "" {
			return false, getErr
		}
	}
	return true, nil
}

func (s *server) socialBoolSetting(ctx context.Context, key string) (bool, error) {
	raw, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists {
		return false, err
	}
	value, ok := decodeSetting(raw).(bool)
	return ok && value, nil
}

func (s *server) socialStringSetting(ctx context.Context, key string) (string, error) {
	raw, exists, err := s.settings.Get(ctx, key)
	if err != nil || !exists {
		return "", err
	}
	value, _ := decodeSetting(raw).(string)
	return value, nil
}
