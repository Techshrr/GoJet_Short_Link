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
	{ID: "rainbow", Label: "聚合登录"},
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
	// APPID/APPKEY. Login type remains a per-request value; these additional
	// settings only control the customer-facing label and which allowed types
	// the administrator chooses to expose.
	keys["auth.social.rainbow.base_url"] = true
	keys["auth.social.rainbow.display_name"] = true
	keys["auth.social.rainbow.login_types"] = true
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

func (s *server) rainbowDisplayName(ctx context.Context) string {
	value, err := s.socialStringSetting(ctx, "auth.social.rainbow.display_name")
	value = strings.TrimSpace(value)
	if err != nil || value == "" {
		return "聚合登录"
	}
	if len([]rune(value)) > 32 {
		value = string([]rune(value)[:32])
	}
	return value
}

func rainbowTypeAllowed(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	for _, item := range rainbowPublicLoginTypes {
		if item["id"] == value {
			return true
		}
	}
	return false
}

func (s *server) rainbowSelectedLoginTypes(ctx context.Context) []map[string]string {
	raw, exists, err := s.settings.Get(ctx, "auth.social.rainbow.login_types")
	selected := map[string]bool{}
	if err == nil && exists {
		switch values := decodeSetting(raw).(type) {
		case []any:
			for _, value := range values {
				if text, ok := value.(string); ok && rainbowTypeAllowed(text) {
					selected[strings.ToLower(strings.TrimSpace(text))] = true
				}
			}
		case []string:
			for _, value := range values {
				if rainbowTypeAllowed(value) {
					selected[strings.ToLower(strings.TrimSpace(value))] = true
				}
			}
		case string:
			for _, value := range strings.FieldsFunc(values, func(r rune) bool { return r == ',' || r == '\n' || r == '\r' }) {
				if rainbowTypeAllowed(value) {
					selected[strings.ToLower(strings.TrimSpace(value))] = true
				}
			}
		}
	}
	// Existing installations did not have an exposure setting. Default to QQ
	// rather than suddenly exposing every aggregate method to customers.
	if len(selected) == 0 && (!exists || err != nil) {
		selected["qq"] = true
	}
	items := make([]map[string]string, 0, len(selected))
	for _, item := range rainbowPublicLoginTypes {
		if selected[item["id"]] {
			items = append(items, map[string]string{"id": item["id"], "label": item["label"]})
		}
	}
	return items
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
		label := definition.Label
		item := map[string]any{"id": definition.ID, "label": label}
		if definition.ID == "rainbow" {
			loginTypes := s.rainbowSelectedLoginTypes(r.Context())
			if len(loginTypes) == 0 {
				continue
			}
			item["label"] = s.rainbowDisplayName(r.Context())
			item["login_types"] = loginTypes
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
		label := definition.Label
		item := map[string]any{
			"id":          definition.ID,
			"label":       label,
			"implemented": implemented,
			"enabled":     enabled,
			"configured":  complete,
			"visible":     implemented && enabled && complete,
		}
		if definition.ID == "rainbow" {
			item["label"] = s.rainbowDisplayName(r.Context())
			item["display_name"] = s.rainbowDisplayName(r.Context())
			item["login_types"] = s.rainbowSelectedLoginTypes(r.Context())
			item["available_login_types"] = rainbowPublicLoginTypes
		} else {
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
		if len(s.rainbowSelectedLoginTypes(ctx)) == 0 {
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
	label := definition.Label
	if provider == "rainbow" {
		label = s.rainbowDisplayName(ctx)
	}
	config := socialProviderConfig{ID: provider, Label: label, ClientID: strings.TrimSpace(clientID), ClientSecret: strings.TrimSpace(secret)}
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
