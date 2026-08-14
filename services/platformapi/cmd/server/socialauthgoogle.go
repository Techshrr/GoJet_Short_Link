package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/Techshrr/GoJet_Short_Link/app/identity"
)

var (
	googleOAuthAuthorizeURL = "https://accounts.google.com/o/oauth2/v2/auth"
	googleOAuthTokenURL     = "https://oauth2.googleapis.com/token"
	googleUserInfoURL       = "https://openidconnect.googleapis.com/v1/userinfo"
)

func (s *server) googleAuthStart(w http.ResponseWriter, r *http.Request) {
	const provider = "google"
	config, configured, err := s.socialProviderConfiguration(r.Context(), provider)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置暂时不可用"})
		return
	}
	if !configured {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "该第三方登录方式当前不可用"})
		return
	}
	base, secure, err := socialPublicBase()
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录回调地址配置无效"})
		return
	}
	state, err := randomURLToken(32)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法创建登录请求"})
		return
	}
	nonce, err := randomURLToken(32)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法创建登录请求"})
		return
	}
	verifier, err := randomURLToken(32)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法创建登录请求"})
		return
	}
	returnTo := safeSocialReturn(r.URL.Query().Get("redirect"))
	ip := clientIP(r)
	if ip == "" {
		ip = "0.0.0.0"
	}
	_, err = s.db.ExecContext(r.Context(), `INSERT INTO social_auth_attempts(state_hash,nonce_hash,pkce_verifier_hash,provider,return_to,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))`, hashText(state), hashText(nonce), hashText(verifier), provider, returnTo, ip, limitText(r.UserAgent(), 512))
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法保存登录请求"})
		return
	}
	setSocialCookie(w, socialStateCookie, state, secure)
	setSocialCookie(w, socialNonceCookie, nonce, secure)
	setSocialCookie(w, socialPKCECookie, verifier, secure)

	callback := base + "/api/public/auth/google/callback"
	http.Redirect(w, r, googleAuthorizationRedirect(config, state, verifier, callback), http.StatusFound)
}

func googleAuthorizationRedirect(config socialProviderConfig, state, verifier, callback string) string {
	values := url.Values{}
	values.Set("client_id", config.ClientID)
	values.Set("redirect_uri", callback)
	values.Set("response_type", "code")
	values.Set("scope", "openid profile email")
	values.Set("state", state)
	values.Set("code_challenge", pkceChallenge(verifier))
	values.Set("code_challenge_method", "S256")
	return googleOAuthAuthorizeURL + "?" + values.Encode()
}

func (s *server) googleAuthCallback(w http.ResponseWriter, r *http.Request) {
	const provider = "google"
	config, configured, err := s.socialProviderConfiguration(r.Context(), provider)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置暂时不可用"})
		return
	}
	if !configured {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该第三方登录方式已经停用"})
		return
	}
	if r.URL.Query().Get("error") != "" {
		redirectSocialError(w, r, "cancelled")
		return
	}
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	if code == "" || state == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方登录回调缺少必要参数"})
		return
	}
	stateCookie, stateErr := r.Cookie(socialStateCookie)
	nonceCookie, nonceErr := r.Cookie(socialNonceCookie)
	pkceCookie, pkceErr := r.Cookie(socialPKCECookie)
	if stateErr != nil || nonceErr != nil || pkceErr != nil || subtle.ConstantTimeCompare([]byte(state), []byte(stateCookie.Value)) != 1 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方登录状态验证失败"})
		return
	}
	returnTo, err := s.consumeSocialAttempt(r.Context(), provider, state, nonceCookie.Value, pkceCookie.Value)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方登录请求无效、已过期或已经使用"})
		return
	}
	clearSocialCookies(w)
	base, _, err := socialPublicBase()
	if err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	callback := base + "/api/public/auth/google/callback"
	providerToken, err := exchangeGoogleCode(r.Context(), config, code, pkceCookie.Value, callback)
	if err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	profile, err := fetchGoogleSocialProfile(r.Context(), providerToken)
	providerToken = ""
	if err != nil {
		redirectSocialError(w, r, "provider_profile")
		return
	}
	allowRegister := s.registrationBool(r.Context(), "registration.enabled", true)
	emailAllowed := !s.blockedRegistrationEmail(r.Context(), profile.Email)
	user, _, err := s.identity.ResolveOrRegisterSocial(r.Context(), profile, allowRegister, emailAllowed)
	if err != nil {
		switch {
		case errors.Is(err, identity.ErrSocialEmailCollision):
			redirectSocialError(w, r, "email_exists")
		case errors.Is(err, identity.ErrSocialRegistrationClosed):
			redirectSocialError(w, r, "registration_closed")
		case errors.Is(err, identity.ErrSocialEmailBlocked):
			redirectSocialError(w, r, "email_blocked")
		default:
			redirectSocialError(w, r, "provider_failed")
		}
		return
	}
	handoff, err := randomURLToken(32)
	if err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	payload, _ := json.Marshal(socialHandoffPayload{UserID: user.ID, Provider: provider, ReturnTo: safeSocialReturn(returnTo)})
	if err = s.redis.Set(r.Context(), socialHandoffKey(handoff), string(payload), socialHandoffTTL).Err(); err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	http.Redirect(w, r, "/login#social_handoff="+handoff, http.StatusFound)
}

func exchangeGoogleCode(ctx context.Context, config socialProviderConfig, code, verifier, redirectURI string) (string, error) {
	values := url.Values{}
	values.Set("client_id", config.ClientID)
	values.Set("client_secret", config.ClientSecret)
	values.Set("code", code)
	values.Set("redirect_uri", redirectURI)
	values.Set("grant_type", "authorization_code")
	values.Set("code_verifier", verifier)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleOAuthTokenURL, strings.NewReader(values.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "GoJet")
	resp, err := socialOAuthHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("google token exchange returned %d", resp.StatusCode)
	}
	var out struct {
		AccessToken      string `json:"access_token"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); err != nil {
		return "", err
	}
	if out.Error != "" || strings.TrimSpace(out.AccessToken) == "" {
		return "", errors.New("google token exchange did not return an access token")
	}
	return strings.TrimSpace(out.AccessToken), nil
}

func fetchGoogleSocialProfile(ctx context.Context, accessToken string) (identity.SocialProfile, error) {
	var profile struct {
		Sub           string `json:"sub"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return identity.SocialProfile{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("User-Agent", "GoJet")
	resp, err := socialOAuthHTTPClient.Do(req)
	if err != nil {
		return identity.SocialProfile{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return identity.SocialProfile{}, fmt.Errorf("google userinfo returned %d", resp.StatusCode)
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&profile); err != nil {
		return identity.SocialProfile{}, err
	}
	profile.Sub = strings.TrimSpace(profile.Sub)
	profile.Email = strings.ToLower(strings.TrimSpace(profile.Email))
	if profile.Sub == "" || len(profile.Sub) > 255 {
		return identity.SocialProfile{}, errors.New("google subject is missing or invalid")
	}
	if profile.Email == "" || !profile.EmailVerified {
		return identity.SocialProfile{}, errors.New("google account has no verified email")
	}
	return identity.SocialProfile{Provider: "google", Subject: profile.Sub, Email: profile.Email, EmailVerified: true, DisplayName: strings.TrimSpace(profile.Name), AvatarURL: strings.TrimSpace(profile.Picture)}, nil
}
