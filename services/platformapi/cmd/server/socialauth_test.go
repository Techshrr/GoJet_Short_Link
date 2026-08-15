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

func TestGitHubOAuthExchangeAndProfile(t *testing.T) {
	oldTokenURL, oldAPIBase, oldClient := githubOAuthTokenURL, githubAPIBaseURL, socialOAuthHTTPClient
	defer func() {
		githubOAuthTokenURL = oldTokenURL
		githubAPIBaseURL = oldAPIBase
		socialOAuthHTTPClient = oldClient
	}()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/login/oauth/access_token":
			if r.Method != http.MethodPost {
				t.Fatalf("token exchange method = %s", r.Method)
			}
			if err := r.ParseForm(); err != nil {
				t.Fatal(err)
			}
			if r.Form.Get("client_id") != "client-id" || r.Form.Get("client_secret") != "client-secret" || r.Form.Get("code") != "temporary-code" || r.Form.Get("code_verifier") != "pkce-verifier" {
				t.Fatalf("unexpected token exchange form: %#v", r.Form)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"provider-token","token_type":"bearer","scope":"user:email"}`))
		case "/user":
			if r.Header.Get("Authorization") != "Bearer provider-token" {
				t.Fatalf("missing provider bearer token")
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"id":4242,"login":"octogojet","name":"Go Jet","avatar_url":"https://avatars.example.test/42"}`))
		case "/user/emails":
			if r.Header.Get("Authorization") != "Bearer provider-token" {
				t.Fatalf("missing provider bearer token on email request")
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"email": "unverified@example.test", "primary": true, "verified": false},
				{"email": "verified@example.test", "primary": false, "verified": true},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	githubOAuthTokenURL = server.URL + "/login/oauth/access_token"
	githubAPIBaseURL = server.URL
	socialOAuthHTTPClient = server.Client()

	config := socialProviderConfig{ID: "github", ClientID: "client-id", ClientSecret: "client-secret"}
	token, err := exchangeGitHubCode(context.Background(), config, "temporary-code", "pkce-verifier", "https://gojet.example.test/api/public/auth/github/callback")
	if err != nil {
		t.Fatal(err)
	}
	if token != "provider-token" {
		t.Fatalf("token = %q", token)
	}
	profile, err := fetchGitHubSocialProfile(context.Background(), token)
	if err != nil {
		t.Fatal(err)
	}
	if profile.Provider != "github" || profile.Subject != "4242" || profile.Email != "verified@example.test" || !profile.EmailVerified || profile.DisplayName != "Go Jet" {
		t.Fatalf("unexpected profile: %#v", profile)
	}
}

func TestSocialAuthSafetyHelpers(t *testing.T) {
	for _, provider := range []string{"google", "facebook", "github", "qq", "wechat", "rainbow"} {
		if !socialProviderImplemented(provider) {
			t.Fatalf("%s adapter must be implemented before customer login can expose it", provider)
		}
	}
	for _, provider := range []string{"admin", "unknown", ""} {
		if socialProviderImplemented(provider) {
			t.Fatalf("unsupported provider %q must never be exposed", provider)
		}
	}
	for input, want := range map[string]string{
		"/app/dashboard":             "/app/dashboard",
		"/app/dashboard?tab=links":   "/app/dashboard?tab=links",
		"https://evil.example.test/": "/app/dashboard",
		"//evil.example.test/":        "/app/dashboard",
		"":                            "/app/dashboard",
	} {
		if got := safeSocialReturn(input); got != want {
			t.Fatalf("safeSocialReturn(%q) = %q, want %q", input, got, want)
		}
	}
	challenge := pkceChallenge(strings.Repeat("v", 43))
	if len(challenge) != 43 {
		t.Fatalf("PKCE S256 challenge length = %d", len(challenge))
	}
	parsed, err := url.Parse(githubOAuthAuthorizeURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host != "github.com" {
		t.Fatalf("unexpected GitHub authorize endpoint: %s", githubOAuthAuthorizeURL)
	}
	googleParsed, err := url.Parse(googleOAuthAuthorizeURL)
	if err != nil || googleParsed.Scheme != "https" || googleParsed.Host != "accounts.google.com" {
		t.Fatalf("unexpected Google authorize endpoint: %s", googleOAuthAuthorizeURL)
	}
}

func TestSocialRedirectGuardDropsBrowserAmbiguousPaths(t *testing.T) {
	for _, target := range []string{`/\evil.example.test/`, "/app/\nbad", "/app/\x00bad"} {
		if !unsafeAuthRedirect(target) {
			t.Fatalf("unsafe redirect was accepted: %q", target)
		}
	}
	if unsafeAuthRedirect("/app/dashboard?tab=links") {
		t.Fatal("valid local redirect was rejected")
	}

	seen := "not-called"
	guarded := sanitizeSocialRedirect(func(w http.ResponseWriter, r *http.Request) {
		seen = r.URL.Query().Get("redirect")
		w.WriteHeader(http.StatusNoContent)
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "http://gojet.test/api/public/auth/github/start?redirect=%2F%5Cevil.example.test%2F", nil)
	guarded(recorder, request)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("guarded handler status = %d", recorder.Code)
	}
	if seen != "" {
		t.Fatalf("unsafe redirect reached social auth start: %q", seen)
	}
}
