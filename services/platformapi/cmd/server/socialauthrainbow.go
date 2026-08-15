package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"

	"github.com/Techshrr/GoJet_Short_Link/app/identity"
)

var rainbowLoginTypes = map[string]bool{
	"qq": true, "wx": true, "alipay": true, "sina": true, "baidu": true,
	"huawei": true, "xiaomi": true, "douyin": true, "bilibili": true, "dingtalk": true,
}

type rainbowBindLaunchPayload struct {
	State string `json:"state"`
	URL   string `json:"url"`
}

// normalizeRainbowBaseURL accepts either a complete Rainbow-compatible
// interface URL (for example https://login.example/connect.php) or a service
// base URL. Admins configure the service they actually use; GoJet no longer
// hard-codes a third-party Rainbow host.
func normalizeRainbowBaseURL(raw string) (string, error) {
	candidate, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || candidate.Scheme != "https" || candidate.Host == "" || candidate.User != nil || candidate.RawQuery != "" || candidate.Fragment != "" {
		return "", errors.New("invalid rainbow interface url")
	}
	host := strings.ToLower(strings.TrimSuffix(candidate.Hostname(), "."))
	if host == "" || host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") {
		return "", errors.New("rainbow interface must use a public host")
	}
	if parsed := net.ParseIP(host); parsed != nil {
		addr, ok := netip.AddrFromSlice(parsed)
		if !ok {
			return "", errors.New("rainbow interface host is invalid")
		}
		addr = addr.Unmap()
		if addr.IsPrivate() || addr.IsLoopback() || addr.IsUnspecified() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() || addr.IsMulticast() {
			return "", errors.New("rainbow interface must use a public host")
		}
	}
	path := strings.TrimSpace(candidate.EscapedPath())
	if path == "" || path == "/" {
		candidate.Path = "/connect.php"
		candidate.RawPath = ""
	} else if strings.HasSuffix(candidate.Path, "/") {
		candidate.Path += "connect.php"
		candidate.RawPath = ""
	}
	return candidate.String(), nil
}

func validRainbowLoginType(value string) bool {
	return rainbowLoginTypes[strings.ToLower(strings.TrimSpace(value))]
}

func rainbowAttemptProvider(loginType string) string {
	return "rainbow:" + strings.ToLower(strings.TrimSpace(loginType))
}

func rainbowProviderRedirect(raw string) (string, error) {
	target, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || target.Scheme != "https" || target.Host == "" || target.User != nil {
		return "", errors.New("rainbow returned an unsafe login url")
	}
	return target.String(), nil
}

func (s *server) rainbowAuthStart(w http.ResponseWriter, r *http.Request) {
	const provider = "rainbow"
	loginType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
	if !validRainbowLoginType(loginType) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "请选择有效的聚合登录方式"})
		return
	}
	if !s.rainbowLoginTypeExposed(r.Context(), loginType) {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该聚合登录方式当前未开放"})
		return
	}
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
	if _, err = s.db.ExecContext(r.Context(), `INSERT INTO social_auth_attempts(state_hash,nonce_hash,pkce_verifier_hash,provider,return_to,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))`, hashText(state), hashText(nonce), hashText(browserSecret), rainbowAttemptProvider(loginType), returnTo, ip, limitText(r.UserAgent(), 512)); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法保存登录请求"})
		return
	}
	setSocialCookie(w, socialStateCookie, state, secure)
	setSocialCookie(w, socialNonceCookie, nonce, secure)
	setSocialCookie(w, socialPKCECookie, browserSecret, secure)
	callback := base + "/api/public/auth/rainbow/callback?state=" + url.QueryEscape(state)
	authorizeURL, err := rainbowAuthorizationURL(r.Context(), config, loginType, callback)
	if err != nil {
		clearSocialCookies(w)
		jsonResponse(w, http.StatusBadGateway, map[string]string{"error": "聚合登录暂时无法创建授权请求"})
		return
	}
	http.Redirect(w, r, authorizeURL, http.StatusFound)
}

func (s *server) rainbowAuthCallback(w http.ResponseWriter, r *http.Request) {
	const provider = "rainbow"
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
	loginType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
	if state == "" || !validRainbowLoginType(loginType) {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方登录回调缺少有效状态或登录方式"})
		return
	}
	stateCookie, stateErr := r.Cookie(socialStateCookie)
	nonceCookie, nonceErr := r.Cookie(socialNonceCookie)
	secretCookie, secretErr := r.Cookie(socialPKCECookie)
	if stateErr != nil || nonceErr != nil || secretErr != nil || subtle.ConstantTimeCompare([]byte(state), []byte(stateCookie.Value)) != 1 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方登录状态验证失败"})
		return
	}
	returnTo, err := s.consumeSocialAttempt(r.Context(), rainbowAttemptProvider(loginType), state, nonceCookie.Value, secretCookie.Value)
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
	profile, err := fetchRainbowSocialProfile(r.Context(), config, loginType, code)
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

func rainbowAuthorizationURL(ctx context.Context, config socialProviderConfig, loginType, redirectURI string) (string, error) {
	endpoint, err := normalizeRainbowBaseURL(config.BaseURL)
	if err != nil {
		return "", err
	}
	loginType = strings.ToLower(strings.TrimSpace(loginType))
	if !validRainbowLoginType(loginType) {
		return "", errors.New("invalid rainbow login type")
	}
	values := url.Values{}
	values.Set("act", "login")
	values.Set("appid", config.ClientID)
	values.Set("appkey", config.ClientSecret)
	values.Set("type", loginType)
	values.Set("redirect_uri", redirectURI)
	var out struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Type string `json:"type"`
		URL  string `json:"url"`
	}
	if err = rainbowGetJSON(ctx, endpoint+"?"+values.Encode(), &out); err != nil {
		return "", err
	}
	if out.Code != 0 || strings.ToLower(strings.TrimSpace(out.Type)) != loginType {
		return "", fmt.Errorf("rainbow login request failed: %d %s", out.Code, out.Msg)
	}
	return rainbowProviderRedirect(out.URL)
}

func fetchRainbowSocialProfile(ctx context.Context, config socialProviderConfig, loginType, code string) (identity.SocialProfile, error) {
	endpoint, err := normalizeRainbowBaseURL(config.BaseURL)
	if err != nil {
		return identity.SocialProfile{}, err
	}
	loginType = strings.ToLower(strings.TrimSpace(loginType))
	if !validRainbowLoginType(loginType) {
		return identity.SocialProfile{}, errors.New("invalid rainbow callback type")
	}
	values := url.Values{}
	values.Set("act", "callback")
	values.Set("appid", config.ClientID)
	values.Set("appkey", config.ClientSecret)
	values.Set("type", loginType)
	values.Set("code", code)
	var out struct {
		Code        int    `json:"code"`
		Msg         string `json:"msg"`
		Type        string `json:"type"`
		SocialUID   string `json:"social_uid"`
		Nickname    string `json:"nickname"`
		FaceImg     string `json:"faceimg"`
		AccessToken string `json:"access_token"`
	}
	if err = rainbowGetJSON(ctx, endpoint+"?"+values.Encode(), &out); err != nil {
		return identity.SocialProfile{}, err
	}
	out.AccessToken = ""
	out.SocialUID = strings.TrimSpace(out.SocialUID)
	if out.Code != 0 || strings.ToLower(strings.TrimSpace(out.Type)) != loginType || out.SocialUID == "" {
		return identity.SocialProfile{}, fmt.Errorf("rainbow callback failed: %d %s", out.Code, out.Msg)
	}
	subject := strings.TrimSpace(config.ClientID) + ":" + loginType + ":" + out.SocialUID
	if len(subject) > 255 {
		return identity.SocialProfile{}, errors.New("rainbow subject is too long")
	}
	return identity.SocialProfile{Provider: "rainbow", Subject: subject, DisplayName: strings.TrimSpace(out.Nickname), AvatarURL: strings.TrimSpace(out.FaceImg)}, nil
}

func rainbowGetJSON(ctx context.Context, endpoint string, out any) error {
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
		return fmt.Errorf("rainbow api returned %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(out)
}

func rainbowBindLaunchKey(ticket string) string {
	return "auth:social:rainbow:launch:" + hashText(ticket)
}

func (s *server) createRainbowBindLaunch(ctx context.Context, state, target string) (string, error) {
	ticket, err := randomURLToken(32)
	if err != nil {
		return "", err
	}
	payload, _ := json.Marshal(rainbowBindLaunchPayload{State: state, URL: target})
	if err = s.redis.Set(ctx, rainbowBindLaunchKey(ticket), string(payload), socialHandoffTTL).Err(); err != nil {
		return "", err
	}
	return ticket, nil
}

func (s *server) rainbowBindLaunch(w http.ResponseWriter, r *http.Request) {
	ticket := strings.TrimSpace(r.URL.Query().Get("ticket"))
	if ticket == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方绑定跳转凭据无效"})
		return
	}
	key := rainbowBindLaunchKey(ticket)
	raw, err := s.redis.Get(r.Context(), key).Result()
	if err != nil || raw == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方绑定跳转凭据无效或已过期"})
		return
	}
	var payload rainbowBindLaunchPayload
	if json.Unmarshal([]byte(raw), &payload) != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方绑定跳转凭据无效"})
		return
	}
	cookie, err := r.Cookie(socialStateCookie)
	if err != nil || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(payload.State)) != 1 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方绑定浏览器状态不匹配"})
		return
	}
	consumed, err := s.redis.GetDel(r.Context(), key).Result()
	if err != nil || subtle.ConstantTimeCompare([]byte(consumed), []byte(raw)) != 1 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方绑定跳转凭据已经使用"})
		return
	}
	target, err := rainbowProviderRedirect(payload.URL)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方绑定跳转地址无效"})
		return
	}
	http.Redirect(w, r, target, http.StatusFound)
}
