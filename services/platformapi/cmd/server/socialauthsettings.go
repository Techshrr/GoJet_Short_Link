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

type socialProviderConfig struct {
	ID           string
	Label        string
	ClientID     string
	ClientSecret string
	BaseURL      string
}

var socialProviderDefinitions = []socialProviderDefinition{
	{ID: "google", Label: "Google"},
	{ID: "facebook", Label: "Facebook"},
	{ID: "github", Label: "GitHub"},
	{ID: "qq", Label: "QQ"},
	{ID: "wechat", Label: "微信"},
	{ID: "rainbow", Label: "彩虹聚合登录"},
}

var rainbowPublicLoginTypes = []map[string]string{
	{"id": "qq", "label": "QQ"},
	{"id": "wx", "label": "微信"},
	{"id": "alipay", "label": "支付宝"},
	{"id": "sina", "label": "微博"},
	{"id": "baidu", "label": "百度"},
	{"id": "huawei", "label": "华为"},
	{"id": "xiaomi", "label": "小米"},
	{"id": "douyin", "label": "抖音"},
	{"id": "bilibili", "label": "哔哩哔哩"},
	{"id": "dingtalk", "label": "钉钉"},
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
	// Rainbow compatible services use an operator supplied interface URL plus
	// APPID/APPKEY. Login type is selected per login request, not stored as an
	// application credential.
	keys["auth.social.rainbow.base_url"] = true
	settingSections["socialauth"] = keys
}

func socialProviderImplemented(provider string) bool {
	switch provider {
	case "github", "google", "facebook", "qq", "wechat", "rainbow":
		return true
	default:
		return false
	}
}

func socialProviderDefinitionByID(provider string) (socialProviderDefinition, bool) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	for _, definition := range socialProviderDefinitions {
		if definition.ID == provider {
			return definition, true
		}
	}
	return socialProviderDefinition{}, false
}

func (s *server) publicSocialProviders(w http.ResponseWriter, r *http.Request) {
	providers := make([]map[string]any, 0, len(socialProviderDefinitions))
	for _, definition := range socialProviderDefinitions {
		if !socialProviderImplemented(definition.ID) {
			continue
		}
		configured, err := s.socialProviderConfigured(r.Context(), definition.ID)
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置暂时不可用"})
			return
		}
		if !configured {
			continue
		}
		item := map[string]any{"id": definition.ID, "label": definition.Label}
		if definition.ID == "rainbow" {
			item["login_types"] = rainbowPublicLoginTypes
		}
		providers = append(providers, item)
	}
	jsonResponse(w, http.StatusOK, map[string]any{"providers": providers})
}

func (s *server) adminSocialProviders(w http.ResponseWriter, r *http.Request) {
	base, _, err := socialPublicBase()
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录回调地址配置无效"})
		return
	}
	providers := make([]map[string]any, 0, len(socialProviderDefinitions))
	for _, definition := range socialProviderDefinitions {
		enabled, getErr := s.socialBoolSetting(r.Context(), "auth.social."+definition.ID+".enabled")
		if getErr != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置读取失败"})
			return
		}
		complete, getErr := s.socialProviderCredentialsComplete(r.Context(), definition.ID)
		if getErr != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置读取失败"})
			return
		}
		implemented := socialProviderImplemented(definition.ID)
		item := map[string]any{
			"id":          definition.ID,
			"label":       definition.Label,
			"implemented": implemented,
			"enabled":     enabled,
			"configured":  complete,
			"visible":     implemented && enabled && complete,
		}
		if definition.ID != "rainbow" {
			item["callback_url"] = base + "/api/public/auth/" + definition.ID + "/callback"
		}
		providers = append(providers, item)
	}
	jsonResponse(w, http.StatusOK, map[string]any{"providers": providers})
}

func (s *server) socialProviderCredentialsComplete(ctx context.Context, provider string) (bool, error) {
	prefix := "auth.social." + provider + "."
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
		if getErr != nil {
			return false, getErr
		}
		if _, validateErr := normalizeRainbowBaseURL(baseURL); validateErr != nil {
			return false, nil
		}
	}
	return true, nil
}

func (s *server) socialProviderConfigured(ctx context.Context, provider string) (bool, error) {
	enabled, err := s.socialBoolSetting(ctx, "auth.social."+provider+".enabled")
	if err != nil || !enabled {
		return false, err
	}
	complete, err := s.socialProviderCredentialsComplete(ctx, provider)
	return complete, err
}

func (s *server) socialProviderConfiguration(ctx context.Context, provider string) (socialProviderConfig, bool, error) {
	definition, exists := socialProviderDefinitionByID(provider)
	if !exists || !socialProviderImplemented(provider) {
		return socialProviderConfig{}, false, nil
	}
	configured, err := s.socialProviderConfigured(ctx, provider)
	if err != nil || !configured {
		return socialProviderConfig{}, false, err
	}
	clientID, err := s.socialStringSetting(ctx, "auth.social."+provider+".client_id")
	if err != nil {
		return socialProviderConfig{}, false, err
	}
	secret, err := s.socialStringSetting(ctx, "auth.social."+provider+".client_secret")
	if err != nil {
		return socialProviderConfig{}, false, err
	}
	config := socialProviderConfig{ID: provider, Label: definition.Label, ClientID: strings.TrimSpace(clientID), ClientSecret: strings.TrimSpace(secret)}
	if provider == "rainbow" {
		baseURL, readErr := s.socialStringSetting(ctx, "auth.social.rainbow.base_url")
		if readErr != nil {
			return socialProviderConfig{}, false, readErr
		}
		config.BaseURL, err = normalizeRainbowBaseURL(baseURL)
		if err != nil {
			return socialProviderConfig{}, false, nil
		}
	}
	return config, true, nil
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
