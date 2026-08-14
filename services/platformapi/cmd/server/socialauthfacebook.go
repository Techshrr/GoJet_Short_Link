package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
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
	facebookOAuthAuthorizeURL = "https://www.facebook.com/dialog/oauth"
	facebookOAuthTokenURL     = "https://graph.facebook.com/oauth/access_token"
	facebookProfileURL        = "https://graph.facebook.com/me"
)

func (s *server) facebookAuthStart(w http.ResponseWriter, r *http.Request) {
	const provider = "facebook"
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
	browserSecret, err := randomURLToken(32)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法创建登录请求"})
		return
	}
	returnTo := safeSocialReturn(r.URL.Query().Get("redirect"))
	ip := clientIP(r)
	if ip == "" {
		ip = "0.0.0.0"
	}
	if _, err = s.db.ExecContext(r.Context(), `INSERT INTO social_auth_attempts(state_hash,nonce_hash,pkce_verifier_hash,provider,return_to,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))`, hashText(state), hashText(nonce), hashText(browserSecret), provider, returnTo, ip, limitText(r.UserAgent(), 512)); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法保存登录请求"})
		return
	}
	setSocialCookie(w, socialStateCookie, state, secure)
	setSocialCookie(w, socialNonceCookie, nonce, secure)
	setSocialCookie(w, socialPKCECookie, browserSecret, secure)
	callback := base + "/api/public/auth/facebook/callback"
	http.Redirect(w, r, facebookAuthorizationRedirect(config, state, callback), http.StatusFound)
}

func facebookAuthorizationRedirect(config socialProviderConfig, state, callback string) string {
	values := url.Values{}
	values.Set("client_id", config.ClientID)
	values.Set("redirect_uri", callback)
	values.Set("response_type", "code")
	values.Set("scope", "public_profile,email")
	values.Set("state", state)
	return facebookOAuthAuthorizeURL + "?" + values.Encode()
}

func (s *server) facebookAuthCallback(w http.ResponseWriter, r *http.Request) {
	const provider = "facebook"
	config, configured, err := s.socialProviderConfiguration(r.Context(), provider)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置暂时不可用"})
		return
	}
	if !configured {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该第三方登录方式已经停用"})
		return
	}
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	if state == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方登录回调缺少状态参数"})
		return
	}
	stateCookie, stateErr := r.Cookie(socialStateCookie)
	nonceCookie, nonceErr := r.Cookie(socialNonceCookie)
	secretCookie, secretErr := r.Cookie(socialPKCECookie)
	if stateErr != nil || nonceErr != nil || secretErr != nil || subtle.ConstantTimeCompare([]byte(state), []byte(stateCookie.Value)) != 1 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方登录状态验证失败"})
		return
	}
	returnTo, err := s.consumeSocialAttempt(r.Context(), provider, state, nonceCookie.Value, secretCookie.Value)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方登录请求无效、已过期或已经使用"})
		return
	}
	clearSocialCookies(w)
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" || strings.TrimSpace(r.URL.Query().Get("error")) != "" {
		redirectSocialError(w, r, "cancelled")
		return
	}
	base, _, err := socialPublicBase()
	if err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	callback := base + "/api/public/auth/facebook/callback"
	profile, err := fetchFacebookProfileFromCode(r.Context(), config, code, callback)
	if err != nil {
		redirectSocialError(w, r, "provider_profile")
		return
	}
	allowRegister := s.registrationBool(r.Context(), "registration.enabled", true)
	emailAllowed := !s.blockedRegistrationEmail(r.Context(), profile.Email)
	user, _, err := s.identity.ResolveOrRegisterSocial(r.Context(), profile, allowRegister, emailAllowed)
	if err != nil {
		switch {
		case profile.Email == "" || !profile.EmailVerified:
			redirectSocialError(w, r, "binding_required")
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
	if err = s.completeSocialLogin(r.Context(), w, r, user, provider, returnTo); err != nil {
		redirectSocialError(w, r, "provider_failed")
	}
}

func exchangeFacebookCode(ctx context.Context, config socialProviderConfig, code, callback string) (string, error) {
	values := url.Values{}
	values.Set("client_id", config.ClientID)
	values.Set("client_secret", config.ClientSecret)
	values.Set("redirect_uri", callback)
	values.Set("code", code)
	var out struct {
		AccessToken string `json:"access_token"`
		Error       struct {
			Message string `json:"message"`
			Type    string `json:"type"`
			Code    int    `json:"code"`
		} `json:"error"`
	}
	if err := facebookGetJSON(ctx, facebookOAuthTokenURL+"?"+values.Encode(), &out); err != nil {
		return "", err
	}
	out.AccessToken = strings.TrimSpace(out.AccessToken)
	if out.AccessToken == "" || out.Error.Code != 0 {
		return "", fmt.Errorf("facebook token exchange failed: %d %s", out.Error.Code, out.Error.Message)
	}
	return out.AccessToken, nil
}

func facebookAppSecretProof(accessToken, appSecret string) string {
	mac := hmac.New(sha256.New, []byte(appSecret))
	_, _ = mac.Write([]byte(accessToken))
	return hex.EncodeToString(mac.Sum(nil))
}

func fetchFacebookSocialProfile(ctx context.Context, config socialProviderConfig, accessToken string) (identity.SocialProfile, error) {
	values := url.Values{}
	values.Set("access_token", accessToken)
	values.Set("appsecret_proof", facebookAppSecretProof(accessToken, config.ClientSecret))
	values.Set("fields", "id,name,email,picture")
	var out struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Email   string `json:"email"`
		Picture struct {
			Data struct {
				URL string `json:"url"`
			} `json:"data"`
		} `json:"picture"`
		Error struct {
			Message string `json:"message"`
			Code    int    `json:"code"`
		} `json:"error"`
	}
	if err := facebookGetJSON(ctx, facebookProfileURL+"?"+values.Encode(), &out); err != nil {
		return identity.SocialProfile{}, err
	}
	out.ID = strings.TrimSpace(out.ID)
	if out.Error.Code != 0 || out.ID == "" {
		return identity.SocialProfile{}, fmt.Errorf("facebook profile failed: %d %s", out.Error.Code, out.Error.Message)
	}
	subject := strings.TrimSpace(config.ClientID) + ":" + out.ID
	if len(subject) > 255 {
		return identity.SocialProfile{}, errors.New("facebook subject is too long")
	}
	return identity.SocialProfile{Provider: "facebook", Subject: subject, Email: strings.ToLower(strings.TrimSpace(out.Email)), EmailVerified: false, DisplayName: strings.TrimSpace(out.Name), AvatarURL: strings.TrimSpace(out.Picture.Data.URL)}, nil
}

func fetchFacebookProfileFromCode(ctx context.Context, config socialProviderConfig, code, callback string) (identity.SocialProfile, error) {
	token, err := exchangeFacebookCode(ctx, config, code, callback)
	if err != nil {
		return identity.SocialProfile{}, err
	}
	profile, err := fetchFacebookSocialProfile(ctx, config, token)
	token = ""
	return profile, err
}

func facebookGetJSON(ctx context.Context, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "GoJet")
	resp, err := socialOAuthHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("facebook api returned %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(out)
}
