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
	wechatOAuthAuthorizeURL = "https://open.weixin.qq.com/connect/qrconnect"
	wechatOAuthTokenURL     = "https://api.weixin.qq.com/sns/oauth2/access_token"
	wechatUserInfoURL       = "https://api.weixin.qq.com/sns/userinfo"
)

type wechatOAuthToken struct {
	AccessToken string `json:"access_token"`
	OpenID      string `json:"openid"`
	UnionID     string `json:"unionid"`
	Scope       string `json:"scope"`
	ErrCode     int    `json:"errcode"`
	ErrMsg      string `json:"errmsg"`
}

func (s *server) wechatAuthStart(w http.ResponseWriter, r *http.Request) {
	const provider = "wechat"
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
	callback := base + "/api/public/auth/wechat/callback"
	http.Redirect(w, r, wechatAuthorizationRedirect(config, state, callback), http.StatusFound)
}

func wechatAuthorizationRedirect(config socialProviderConfig, state, callback string) string {
	values := url.Values{}
	values.Set("appid", config.ClientID)
	values.Set("redirect_uri", callback)
	values.Set("response_type", "code")
	values.Set("scope", "snsapi_login")
	values.Set("state", state)
	return wechatOAuthAuthorizeURL + "?" + values.Encode() + "#wechat_redirect"
}

func (s *server) wechatAuthCallback(w http.ResponseWriter, r *http.Request) {
	const provider = "wechat"
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
	if code == "" {
		redirectSocialError(w, r, "cancelled")
		return
	}
	base, _, err := socialPublicBase()
	if err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	callback := base + "/api/public/auth/wechat/callback"
	profile, err := fetchWeChatProfileFromCode(r.Context(), config, code, callback)
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

func exchangeWeChatCode(ctx context.Context, config socialProviderConfig, code string) (wechatOAuthToken, error) {
	values := url.Values{}
	values.Set("appid", config.ClientID)
	values.Set("secret", config.ClientSecret)
	values.Set("code", code)
	values.Set("grant_type", "authorization_code")
	var token wechatOAuthToken
	if err := wechatGetJSON(ctx, wechatOAuthTokenURL+"?"+values.Encode(), &token); err != nil {
		return wechatOAuthToken{}, err
	}
	token.AccessToken = strings.TrimSpace(token.AccessToken)
	token.OpenID = strings.TrimSpace(token.OpenID)
	token.UnionID = strings.TrimSpace(token.UnionID)
	if token.ErrCode != 0 || token.AccessToken == "" || token.OpenID == "" {
		return wechatOAuthToken{}, fmt.Errorf("wechat token exchange failed: %d %s", token.ErrCode, token.ErrMsg)
	}
	return token, nil
}

func fetchWeChatSocialProfile(ctx context.Context, config socialProviderConfig, token wechatOAuthToken) (identity.SocialProfile, error) {
	values := url.Values{}
	values.Set("access_token", token.AccessToken)
	values.Set("openid", token.OpenID)
	values.Set("lang", "zh_CN")
	var info struct {
		OpenID     string `json:"openid"`
		Nickname   string `json:"nickname"`
		HeadImgURL string `json:"headimgurl"`
		UnionID    string `json:"unionid"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
	}
	if err := wechatGetJSON(ctx, wechatUserInfoURL+"?"+values.Encode(), &info); err != nil {
		return identity.SocialProfile{}, err
	}
	info.OpenID = strings.TrimSpace(info.OpenID)
	if info.ErrCode != 0 || info.OpenID == "" || info.OpenID != token.OpenID {
		return identity.SocialProfile{}, errors.New("wechat user profile did not match the authorized openid")
	}
	subject := strings.TrimSpace(config.ClientID) + ":" + token.OpenID
	if len(subject) > 255 {
		return identity.SocialProfile{}, errors.New("wechat subject is too long")
	}
	return identity.SocialProfile{Provider: "wechat", Subject: subject, DisplayName: strings.TrimSpace(info.Nickname), AvatarURL: strings.TrimSpace(info.HeadImgURL)}, nil
}

func fetchWeChatProfileFromCode(ctx context.Context, config socialProviderConfig, code, _ string) (identity.SocialProfile, error) {
	token, err := exchangeWeChatCode(ctx, config, code)
	if err != nil {
		return identity.SocialProfile{}, err
	}
	profile, err := fetchWeChatSocialProfile(ctx, config, token)
	token.AccessToken = ""
	return profile, err
}

func wechatGetJSON(ctx context.Context, endpoint string, out any) error {
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
		return fmt.Errorf("wechat api returned %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(out)
}
