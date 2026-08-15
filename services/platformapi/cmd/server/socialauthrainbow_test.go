package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

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
	ts := httptest.NewTLSServer(mux)
	defer ts.Close()

	upstream, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	baseClient := ts.Client()
	baseTransport := baseClient.Transport
	oldClient := socialOAuthHTTPClient
	socialOAuthHTTPClient = &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		clone := req.Clone(req.Context())
		clonedURL := *req.URL
		clonedURL.Scheme = upstream.Scheme
		clonedURL.Host = upstream.Host
		clone.URL = &clonedURL
		clone.Host = "rainbow.test"
		return baseTransport.RoundTrip(clone)
	})}
	defer func() { socialOAuthHTTPClient = oldClient }()

	// Production validation must continue to see a public-host-shaped HTTPS
	// interface. The test transport above maps that hostname to the local TLS
	// fixture without weakening normalizeRainbowBaseURL for real deployments.
	config := socialProviderConfig{ClientID: "rainbow-app", ClientSecret: "rainbow-secret", BaseURL: "https://rainbow.test/connect.php"}
	authorize, err := rainbowAuthorizationURL(context.Background(), config, "qq", "https://gojet.test/api/public/auth/rainbow/callback?state=state-value")
	if err != nil || authorize != "https://graph.qq.com/oauth2.0/authorize?from=rainbow" {
		t.Fatalf("authorize=%q err=%v", authorize, err)
	}
	if parsed, _ := url.Parse(authorize); parsed.Query().Get("appkey") != "" {
		t.Fatal("Rainbow appkey leaked into browser authorization URL")
	}
	profile, err := fetchRainbowSocialProfile(context.Background(), config, "qq", "provider-code")
	if err != nil {
		t.Fatal(err)
	}
	if profile.Provider != "rainbow" || profile.Subject != "rainbow-app:qq:social-123" || profile.DisplayName != "Rainbow User" || profile.Email != "" || profile.EmailVerified {
		t.Fatalf("unexpected profile: %#v", profile)
	}
}

func TestRainbowConfigurationAcceptsOperatorInterfaceAndRejectsUnsafeOrigins(t *testing.T) {
	if got, err := normalizeRainbowBaseURL("https://login.example.com"); err != nil || got != "https://login.example.com/connect.php" {
		t.Fatalf("base interface normalization got=%q err=%v", got, err)
	}
	if got, err := normalizeRainbowBaseURL("https://login.example.com/api/connect.php"); err != nil || got != "https://login.example.com/api/connect.php" {
		t.Fatalf("explicit interface normalization got=%q err=%v", got, err)
	}
	for _, unsafe := range []string{"http://login.example.com/connect.php", "https://127.0.0.1/connect.php", "https://10.0.0.1/connect.php", "https://localhost/connect.php", "https://user:pass@login.example.com/connect.php"} {
		if _, err := normalizeRainbowBaseURL(unsafe); err == nil {
			t.Fatalf("unsafe Rainbow interface was accepted: %s", unsafe)
		}
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