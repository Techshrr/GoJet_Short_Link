package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestGoogleOAuthExchangeAndProfile(t *testing.T) {
	oldTokenURL, oldUserInfoURL, oldClient := googleOAuthTokenURL, googleUserInfoURL, socialOAuthHTTPClient
	defer func() {
		googleOAuthTokenURL = oldTokenURL
		googleUserInfoURL = oldUserInfoURL
		socialOAuthHTTPClient = oldClient
	}()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			if r.Method != http.MethodPost {
				t.Fatalf("token exchange method = %s", r.Method)
			}
			if err := r.ParseForm(); err != nil {
				t.Fatal(err)
			}
			if r.Form.Get("client_id") != "google-client" || r.Form.Get("client_secret") != "google-secret" || r.Form.Get("code") != "google-code" || r.Form.Get("code_verifier") != "google-verifier" || r.Form.Get("grant_type") != "authorization_code" {
				t.Fatalf("unexpected Google token exchange form: %#v", r.Form)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"google-provider-token","token_type":"Bearer","expires_in":3600}`))
		case "/userinfo":
			if r.Header.Get("Authorization") != "Bearer google-provider-token" {
				t.Fatalf("missing Google provider bearer token")
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"sub":"google-subject-123","name":"Google User","picture":"https://images.example.test/google-user","email":"Google.User@example.test","email_verified":true}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	googleOAuthTokenURL = server.URL + "/token"
	googleUserInfoURL = server.URL + "/userinfo"
	socialOAuthHTTPClient = server.Client()

	config := socialProviderConfig{ID: "google", ClientID: "google-client", ClientSecret: "google-secret"}
	token, err := exchangeGoogleCode(context.Background(), config, "google-code", "google-verifier", "https://gojet.example.test/api/public/auth/google/callback")
	if err != nil {
		t.Fatal(err)
	}
	if token != "google-provider-token" {
		t.Fatalf("token = %q", token)
	}
	profile, err := fetchGoogleSocialProfile(context.Background(), token)
	if err != nil {
		t.Fatal(err)
	}
	if profile.Provider != "google" || profile.Subject != "google-subject-123" || profile.Email != "google.user@example.test" || !profile.EmailVerified || profile.DisplayName != "Google User" {
		t.Fatalf("unexpected Google profile: %#v", profile)
	}
}

func TestGoogleAuthorizationRedirectUsesCodeFlowAndPKCE(t *testing.T) {
	config := socialProviderConfig{ID: "google", ClientID: "google-client", ClientSecret: "unused-here"}
	location := googleAuthorizationRedirect(config, "state-value", strings.Repeat("v", 43), "https://gojet.example.test/api/public/auth/google/callback")
	parsed, err := url.Parse(location)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Scheme != "https" || parsed.Host != "accounts.google.com" || parsed.Path != "/o/oauth2/v2/auth" {
		t.Fatalf("unexpected Google authorization location: %s", location)
	}
	query := parsed.Query()
	if query.Get("response_type") != "code" || query.Get("state") != "state-value" || query.Get("code_challenge_method") != "S256" {
		t.Fatalf("unexpected Google authorization query: %#v", query)
	}
	scopes := map[string]bool{}
	for _, scope := range strings.Fields(query.Get("scope")) {
		scopes[scope] = true
	}
	for _, required := range []string{"openid", "profile", "email"} {
		if !scopes[required] {
			t.Fatalf("Google authorization scope missing %s: %q", required, query.Get("scope"))
		}
	}
	if len(query.Get("code_challenge")) != 43 {
		t.Fatalf("Google PKCE challenge length = %d", len(query.Get("code_challenge")))
	}
}
