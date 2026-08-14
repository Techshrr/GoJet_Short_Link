package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestRainbowLoginAndProfileExchangeKeepSecretServerSide(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/connect.php", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("appid") != "rainbow-app" || q.Get("appkey") != "rainbow-secret" || q.Get("type") != "qq" {
			t.Fatalf("unexpected Rainbow credentials: %v", q)
		}
		switch q.Get("act") {
		case "login":
			redirect, err := url.Parse(q.Get("redirect_uri"))
			if err != nil || redirect.Query().Get("state") != "state-value" {
				t.Fatalf("state missing from redirect_uri: %s", q.Get("redirect_uri"))
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"code": 0, "msg": "succ", "type": "qq", "url": "https://graph.qq.com/oauth2.0/authorize?from=rainbow"})
		case "callback":
			if q.Get("code") != "provider-code" {
				t.Fatalf("unexpected callback code: %v", q)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"code": 0, "msg": "succ", "type": "qq", "social_uid": "social-123", "nickname": "Rainbow User", "faceimg": "https://img.test/rainbow.png", "access_token": "provider-token"})
		default:
			t.Fatalf("unexpected Rainbow act: %s", q.Get("act"))
		}
	})
	ts := httptest.NewServer(mux)
	defer ts.Close()
	oldBase, oldClient := rainbowOfficialBaseURL, socialOAuthHTTPClient
	rainbowOfficialBaseURL, socialOAuthHTTPClient = ts.URL, ts.Client()
	defer func() { rainbowOfficialBaseURL, socialOAuthHTTPClient = oldBase, oldClient }()
	config := socialProviderConfig{ClientID: "rainbow-app", ClientSecret: "rainbow-secret", BaseURL: ts.URL, LoginType: "qq"}
	authorize, err := rainbowAuthorizationURL(t.Context(), config, "https://gojet.test/api/public/auth/rainbow/callback?state=state-value")
	if err != nil || authorize != "https://graph.qq.com/oauth2.0/authorize?from=rainbow" {
		t.Fatalf("authorize=%q err=%v", authorize, err)
	}
	if parsed, _ := url.Parse(authorize); parsed.Query().Get("appkey") != "" {
		t.Fatal("Rainbow appkey leaked into browser authorization URL")
	}
	profile, err := fetchRainbowSocialProfile(t.Context(), config, "qq", "provider-code")
	if err != nil {
		t.Fatal(err)
	}
	if profile.Provider != "rainbow" || profile.Subject != "rainbow-app:qq:social-123" || profile.DisplayName != "Rainbow User" || profile.Email != "" || profile.EmailVerified {
		t.Fatalf("unexpected profile: %#v", profile)
	}
}

func TestRainbowConfigurationRejectsArbitraryOriginsAndUnsafeRedirects(t *testing.T) {
	oldBase := rainbowOfficialBaseURL
	rainbowOfficialBaseURL = "https://u.cccyun.cc"
	defer func() { rainbowOfficialBaseURL = oldBase }()
	if _, err := normalizeRainbowBaseURL("https://127.0.0.1"); err == nil {
		t.Fatal("arbitrary Rainbow base URL was accepted")
	}
	if _, err := normalizeRainbowBaseURL("https://u.cccyun.cc.evil.example"); err == nil {
		t.Fatal("lookalike Rainbow host was accepted")
	}
	if _, err := rainbowProviderRedirect("http://graph.qq.com/oauth2.0/authorize"); err == nil {
		t.Fatal("insecure provider redirect was accepted")
	}
	for _, loginType := range []string{"qq", "wx", "alipay", "sina", "baidu", "huawei", "xiaomi", "douyin", "bilibili", "dingtalk"} {
		if !validRainbowLoginType(loginType) {
			t.Fatalf("documented Rainbow login type rejected: %s", loginType)
		}
	}
	if validRainbowLoginType("custom") {
		t.Fatal("unknown Rainbow login type accepted")
	}
}
