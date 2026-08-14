package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/identity"
	"github.com/redis/go-redis/v9"
)

var (
	githubOAuthAuthorizeURL = "https://github.com/login/oauth/authorize"
	githubOAuthTokenURL     = "https://github.com/login/oauth/access_token"
	githubAPIBaseURL        = "https://api.github.com"
	socialOAuthHTTPClient   = &http.Client{Timeout: 12 * time.Second}
)

const (
	socialStateCookie = "gojet_social_state"
	socialNonceCookie = "gojet_social_nonce"
	socialPKCECookie  = "gojet_social_pkce"
	socialAttemptTTL  = 10 * time.Minute
	socialHandoffTTL  = 90 * time.Second
)

type socialHandoffPayload struct {
	UserID   int64  `json:"user_id"`
	Provider string `json:"provider"`
	ReturnTo string `json:"return_to"`
}

func (s *server) socialAuthStart(w http.ResponseWriter, r *http.Request) {
	provider := strings.ToLower(strings.TrimSpace(r.PathValue("provider")))
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

	callback := base + "/api/public/auth/" + url.PathEscape(provider) + "/callback"
	values := url.Values{}
	values.Set("client_id", config.ClientID)
	values.Set("redirect_uri", callback)
	values.Set("scope", "user:email")
	values.Set("state", state)
	values.Set("code_challenge", pkceChallenge(verifier))
	values.Set("code_challenge_method", "S256")
	http.Redirect(w, r, githubOAuthAuthorizeURL+"?"+values.Encode(), http.StatusFound)
}

func (s *server) socialAuthCallback(w http.ResponseWriter, r *http.Request) {
	provider := strings.ToLower(strings.TrimSpace(r.PathValue("provider")))
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
	callback := base + "/api/public/auth/" + url.PathEscape(provider) + "/callback"
	providerToken, err := exchangeGitHubCode(r.Context(), config, code, pkceCookie.Value, callback)
	if err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	profile, err := fetchGitHubSocialProfile(r.Context(), providerToken)
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

func (s *server) socialAuthHandoff(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Code string `json:"code"`
	}
	if decode(w, r, &in) != nil {
		return
	}
	in.Code = strings.TrimSpace(in.Code)
	if len(in.Code) < 32 || len(in.Code) > 128 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "登录接力凭据无效或已经过期"})
		return
	}
	raw, err := s.redis.GetDel(r.Context(), socialHandoffKey(in.Code)).Result()
	if errors.Is(err, redis.Nil) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "登录接力凭据无效或已经过期"})
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "登录接力服务暂时不可用"})
		return
	}
	var payload socialHandoffPayload
	if json.Unmarshal([]byte(raw), &payload) != nil || payload.UserID <= 0 || !socialProviderImplemented(payload.Provider) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "登录接力凭据无效"})
		return
	}
	configured, err := s.socialProviderConfigured(r.Context(), payload.Provider)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置暂时不可用"})
		return
	}
	if !configured {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该第三方登录方式已经停用"})
		return
	}
	user, token, err := s.identity.CreateSessionForUser(r.Context(), payload.UserID, clientIP(r), r.UserAgent())
	if err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "账户当前不可用"})
		return
	}
	metadata, _ := json.Marshal(map[string]string{"provider": payload.Provider})
	_, _ = s.db.ExecContext(r.Context(), `INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address) VALUES(?,'auth.social.login','user',?,?,?)`, user.ID, strconv.FormatInt(user.ID, 10), string(metadata), clientIP(r))
	jsonResponse(w, http.StatusOK, map[string]any{"user": user, "token": token, "redirect": safeSocialReturn(payload.ReturnTo)})
}

func (s *server) consumeSocialAttempt(ctx context.Context, provider, state, nonce, verifier string) (string, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	var id int64
	var nonceHash, verifierHash string
	var returnTo sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT id,nonce_hash,pkce_verifier_hash,return_to FROM social_auth_attempts WHERE state_hash=? AND provider=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE`, hashText(state), provider).Scan(&id, &nonceHash, &verifierHash, &returnTo)
	if err != nil {
		return "", err
	}
	if subtle.ConstantTimeCompare([]byte(nonceHash), []byte(hashText(nonce))) != 1 || subtle.ConstantTimeCompare([]byte(verifierHash), []byte(hashText(verifier))) != 1 {
		return "", errors.New("social attempt browser binding mismatch")
	}
	result, err := tx.ExecContext(ctx, `UPDATE social_auth_attempts SET consumed_at=UTC_TIMESTAMP() WHERE id=? AND consumed_at IS NULL`, id)
	if err != nil {
		return "", err
	}
	changed, err := result.RowsAffected()
	if err != nil || changed != 1 {
		return "", errors.New("social attempt was already consumed")
	}
	if err = tx.Commit(); err != nil {
		return "", err
	}
	if returnTo.Valid {
		return safeSocialReturn(returnTo.String), nil
	}
	return "/app/dashboard", nil
}

func exchangeGitHubCode(ctx context.Context, config socialProviderConfig, code, verifier, redirectURI string) (string, error) {
	values := url.Values{}
	values.Set("client_id", config.ClientID)
	values.Set("client_secret", config.ClientSecret)
	values.Set("code", code)
	values.Set("redirect_uri", redirectURI)
	values.Set("code_verifier", verifier)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, githubOAuthTokenURL, strings.NewReader(values.Encode()))
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
		return "", fmt.Errorf("github token exchange returned %d", resp.StatusCode)
	}
	var out struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); err != nil {
		return "", err
	}
	if out.Error != "" || strings.TrimSpace(out.AccessToken) == "" {
		return "", errors.New("github token exchange did not return an access token")
	}
	return strings.TrimSpace(out.AccessToken), nil
}

func fetchGitHubSocialProfile(ctx context.Context, accessToken string) (identity.SocialProfile, error) {
	var user struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := githubGetJSON(ctx, "/user", accessToken, &user); err != nil {
		return identity.SocialProfile{}, err
	}
	if user.ID <= 0 {
		return identity.SocialProfile{}, errors.New("github user id is missing")
	}
	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := githubGetJSON(ctx, "/user/emails?per_page=100", accessToken, &emails); err != nil {
		return identity.SocialProfile{}, err
	}
	selected := ""
	for _, email := range emails {
		if email.Primary && email.Verified && strings.TrimSpace(email.Email) != "" {
			selected = email.Email
			break
		}
	}
	if selected == "" {
		for _, email := range emails {
			if email.Verified && strings.TrimSpace(email.Email) != "" {
				selected = email.Email
				break
			}
		}
	}
	if selected == "" {
		return identity.SocialProfile{}, errors.New("github account has no verified email")
	}
	return identity.SocialProfile{Provider: "github", Subject: strconv.FormatInt(user.ID, 10), Email: strings.ToLower(strings.TrimSpace(selected)), EmailVerified: true, DisplayName: strings.TrimSpace(user.Name), AvatarURL: strings.TrimSpace(user.AvatarURL), Login: strings.TrimSpace(user.Login)}, nil
}

func githubGetJSON(ctx context.Context, path, accessToken string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(githubAPIBaseURL, "/")+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("X-GitHub-Api-Version", "2026-03-10")
	req.Header.Set("User-Agent", "GoJet")
	resp, err := socialOAuthHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("github api returned %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(out)
}

func randomURLToken(bytesCount int) (string, error) {
	raw := make([]byte, bytesCount)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashText(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func pkceChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func socialHandoffKey(code string) string {
	return "gojet:auth:social:handoff:" + hashText(code)
}

func socialPublicBase() (string, bool, error) {
	raw := strings.TrimRight(strings.TrimSpace(getenv("PUBLIC_BASE_URL", "http://localhost:8080")), "/")
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", false, errors.New("invalid PUBLIC_BASE_URL")
	}
	return raw, parsed.Scheme == "https", nil
}

func safeSocialReturn(target string) string {
	target = strings.TrimSpace(target)
	if target == "" || !strings.HasPrefix(target, "/") || strings.HasPrefix(target, "//") {
		return "/app/dashboard"
	}
	parsed, err := url.Parse(target)
	if err != nil || parsed.IsAbs() || parsed.Host != "" {
		return "/app/dashboard"
	}
	return target
}

func setSocialCookie(w http.ResponseWriter, name, value string, secure bool) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/api/public/auth/", HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode, MaxAge: int(socialAttemptTTL.Seconds()), Expires: time.Now().Add(socialAttemptTTL)})
}

func clearSocialCookies(w http.ResponseWriter) {
	for _, name := range []string{socialStateCookie, socialNonceCookie, socialPKCECookie} {
		http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/api/public/auth/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1, Expires: time.Unix(1, 0)})
	}
}

func redirectSocialError(w http.ResponseWriter, r *http.Request, code string) {
	http.Redirect(w, r, "/login#social_error="+url.QueryEscape(code), http.StatusFound)
}

func limitText(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}
