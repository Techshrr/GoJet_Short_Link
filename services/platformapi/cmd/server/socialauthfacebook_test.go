package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestFacebookCodeAndProfileExchangeTreatsEmailAsUnverified(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("client_id") != "fb-app" || q.Get("client_secret") != "fb-secret" || q.Get("code") != "fb-code" || q.Get("redirect_uri") != "https://gojet.test/callback" {
			t.Fatalf("unexpected Facebook token request: %v", q)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "fb-token", "token_type": "bearer"})
	})
	mux.HandleFunc("/me", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("access_token") != "fb-token" || q.Get("appsecret_proof") != facebookAppSecretProof("fb-token", "fb-secret") || q.Get("fields") != "id,name,email,picture" {
			t.Fatalf("unexpected Facebook profile request: %v", q)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "fb-user-123", "name": "Facebook User", "email": "person@example.test", "picture": map[string]any{"data": map[string]any{"url": "https://img.test/fb.png"}}})
	})
	ts := httptest.NewServer(mux)
	defer ts.Close()
	oldToken, oldProfile, oldClient := facebookOAuthTokenURL, facebookProfileURL, socialOAuthHTTPClient
	facebookOAuthTokenURL, facebookProfileURL, socialOAuthHTTPClient = ts.URL+"/token", ts.URL+"/me", ts.Client()
	defer func() { facebookOAuthTokenURL, facebookProfileURL, socialOAuthHTTPClient = oldToken, oldProfile, oldClient }()
	config := socialProviderConfig{ClientID: "fb-app", ClientSecret: "fb-secret"}
	profile, err := fetchFacebookProfileFromCode(context.Background(), config, "fb-code", "https://gojet.test/callback")
	if err != nil {
		t.Fatal(err)
	}
	if profile.Provider != "facebook" || profile.Subject != "fb-app:fb-user-123" || profile.Email != "person@example.test" || profile.EmailVerified || profile.DisplayName != "Facebook User" {
		t.Fatalf("unexpected profile: %#v", profile)
	}
}

func TestFacebookAuthorizationUsesStateWithoutPretendingPKCEOrLeakingSecret(t *testing.T) {
	raw := facebookAuthorizationRedirect(socialProviderConfig{ClientID: "fb-app", ClientSecret: "must-not-leak"}, "state-value", "https://gojet.test/callback")
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if u.Scheme != "https" || u.Host != "www.facebook.com" || u.Path != "/dialog/oauth" {
		t.Fatalf("unexpected authorize URL %s", raw)
	}
	q := u.Query()
	if q.Get("client_id") != "fb-app" || q.Get("state") != "state-value" || q.Get("response_type") != "code" {
		t.Fatalf("unexpected query %v", q)
	}
	if q.Get("client_secret") != "" || strings.TrimSpace(q.Get("code_challenge")) != "" {
		t.Fatal("Facebook authorize URL leaked a secret or claimed unsupported PKCE")
	}
}
