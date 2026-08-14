package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestWeChatCodeAndProfileExchange(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.Method != http.MethodGet || q.Get("appid") != "wx-app" || q.Get("secret") != "wx-secret" || q.Get("code") != "wx-code" || q.Get("grant_type") != "authorization_code" {
			t.Fatalf("unexpected WeChat token request: %s %v", r.Method, q)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "wx-token", "openid": "openid-123", "unionid": "union-456", "scope": "snsapi_login"})
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("access_token") != "wx-token" || q.Get("openid") != "openid-123" || q.Get("lang") != "zh_CN" {
			t.Fatalf("unexpected WeChat userinfo request: %v", q)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"openid": "openid-123", "nickname": "微信用户", "headimgurl": "https://img.test/wechat.png", "unionid": "union-456"})
	})
	ts := httptest.NewServer(mux)
	defer ts.Close()
	oldToken, oldInfo, oldClient := wechatOAuthTokenURL, wechatUserInfoURL, socialOAuthHTTPClient
	wechatOAuthTokenURL = ts.URL + "/token"
	wechatUserInfoURL = ts.URL + "/userinfo"
	socialOAuthHTTPClient = ts.Client()
	defer func() { wechatOAuthTokenURL, wechatUserInfoURL, socialOAuthHTTPClient = oldToken, oldInfo, oldClient }()
	config := socialProviderConfig{ClientID: "wx-app", ClientSecret: "wx-secret"}
	profile, err := fetchWeChatProfileFromCode(t.Context(), config, "wx-code", "https://gojet.test/callback")
	if err != nil {
		t.Fatal(err)
	}
	if profile.Provider != "wechat" || profile.Subject != "wx-app:openid-123" || profile.DisplayName != "微信用户" || profile.Email != "" || profile.EmailVerified {
		t.Fatalf("unexpected profile: %#v", profile)
	}
}

func TestWeChatAuthorizationRedirectUsesStateWithoutPretendingPKCE(t *testing.T) {
	raw := wechatAuthorizationRedirect(socialProviderConfig{ClientID: "wx-app"}, "state-value", "https://gojet.test/callback")
	parts := strings.SplitN(raw, "#", 2)
	if len(parts) != 2 || parts[1] != "wechat_redirect" {
		t.Fatalf("missing wechat_redirect fragment: %s", raw)
	}
	u, err := url.Parse(parts[0])
	if err != nil {
		t.Fatal(err)
	}
	if u.Scheme != "https" || u.Host != "open.weixin.qq.com" || u.Path != "/connect/qrconnect" {
		t.Fatalf("unexpected authorize URL %s", raw)
	}
	q := u.Query()
	if q.Get("response_type") != "code" || q.Get("scope") != "snsapi_login" || q.Get("state") != "state-value" || q.Get("appid") != "wx-app" {
		t.Fatalf("unexpected query %v", q)
	}
	if strings.TrimSpace(q.Get("code_challenge")) != "" {
		t.Fatal("WeChat adapter must not claim provider PKCE support")
	}
}
