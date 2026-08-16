package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/identity"
	"github.com/redis/go-redis/v9"
)

const socialRegistrationTTL = 20 * time.Minute

type socialRegistrationPayload struct {
	Profile   identity.SocialProfile `json:"profile"`
	Provider  string                 `json:"provider"`
	LoginType string                 `json:"login_type,omitempty"`
	ReturnTo  string                 `json:"return_to"`
}

type bufferedSocialResponse struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func newBufferedSocialResponse() *bufferedSocialResponse { return &bufferedSocialResponse{header: make(http.Header)} }
func (b *bufferedSocialResponse) Header() http.Header { return b.header }
func (b *bufferedSocialResponse) WriteHeader(status int) { if b.status == 0 { b.status = status } }
func (b *bufferedSocialResponse) Write(data []byte) (int, error) {
	if b.status == 0 { b.status = http.StatusOK }
	return b.body.Write(data)
}
func (b *bufferedSocialResponse) replay(w http.ResponseWriter) {
	for key, values := range b.header {
		w.Header()[key] = append([]string(nil), values...)
	}
	status := b.status
	if status == 0 { status = http.StatusOK }
	w.WriteHeader(status)
	_, _ = w.Write(b.body.Bytes())
}

// socialRegistrationStart marks a normal provider attempt as register before
// any redirect/cookies reach the browser. Provider start implementations remain
// the single source of truth for OAuth/QR request construction.
func (s *server) socialRegistrationStart(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("flow")), "register") {
			next(w, r)
			return
		}
		if !s.registrationBool(r.Context(), "registration.enabled", true) {
			jsonResponse(w, http.StatusForbidden, map[string]string{"error": "当前暂未开放新用户注册"})
			return
		}
		buffer := newBufferedSocialResponse()
		next(buffer, r)
		response := &http.Response{Header: buffer.header}
		state := ""
		for _, cookie := range response.Cookies() {
			if cookie.Name == socialStateCookie {
				state = strings.TrimSpace(cookie.Value)
				break
			}
		}
		if state == "" || buffer.status < 300 || buffer.status >= 400 {
			buffer.replay(w)
			return
		}
		result, err := s.db.ExecContext(r.Context(), `UPDATE social_auth_attempts SET mode='register' WHERE state_hash=? AND mode='login' AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP()`, hashText(state))
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "暂时无法创建第三方注册请求"})
			return
		}
		changed, err := result.RowsAffected()
		if err != nil || changed != 1 {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方注册请求状态保存失败，请重新发起"})
			return
		}
		buffer.replay(w)
	}
}

func (s *server) socialRegistrationCallbackRouter(provider string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		state := strings.TrimSpace(r.URL.Query().Get("state"))
		if state == "" {
			next(w, r)
			return
		}
		attemptProvider := socialAttemptProviderForCallback(provider, r)
		var mode string
		err := s.db.QueryRowContext(r.Context(), `SELECT mode FROM social_auth_attempts WHERE state_hash=? AND provider=? AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP()`, hashText(state), attemptProvider).Scan(&mode)
		if errors.Is(err, sql.ErrNoRows) {
			next(w, r)
			return
		}
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方注册状态暂时不可用"})
			return
		}
		if mode != "register" {
			next(w, r)
			return
		}
		s.socialRegistrationCallback(w, r, provider, attemptProvider)
	}
}

func (s *server) socialRegistrationCallback(w http.ResponseWriter, r *http.Request, provider, attemptProvider string) {
	config, configured, err := s.socialProviderConfiguration(r.Context(), provider)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方登录配置暂时不可用"})
		return
	}
	if !configured {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该第三方登录方式已经停用"})
		return
	}
	loginType := ""
	if provider == "rainbow" {
		loginType = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
		if !validRainbowLoginType(loginType) || !s.rainbowLoginTypeExposed(r.Context(), loginType) {
			jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该聚合登录方式当前未开放"})
			return
		}
	}
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	stateCookie, stateErr := r.Cookie(socialStateCookie)
	nonceCookie, nonceErr := r.Cookie(socialNonceCookie)
	pkceCookie, pkceErr := r.Cookie(socialPKCECookie)
	if state == "" || stateErr != nil || nonceErr != nil || pkceErr != nil || subtle.ConstantTimeCompare([]byte(state), []byte(stateCookie.Value)) != 1 {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方注册状态验证失败"})
		return
	}
	returnTo, err := s.consumeSocialRegistrationAttempt(r.Context(), attemptProvider, state, nonceCookie.Value, pkceCookie.Value)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "第三方注册请求无效、已过期或已经使用"})
		return
	}
	clearSocialCookies(w)
	if strings.TrimSpace(r.URL.Query().Get("error")) != "" || strings.TrimSpace(r.URL.Query().Get("code")) == "" {
		redirectSocialError(w, r, "cancelled")
		return
	}
	profile, err := s.socialRegistrationProfile(r.Context(), r, provider, config, pkceCookie.Value)
	if err != nil {
		redirectSocialError(w, r, "provider_profile")
		return
	}
	if existing, found, findErr := s.identity.FindSocialUser(r.Context(), profile); findErr != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	} else if found {
		if err = s.completeSocialLogin(r.Context(), w, r, existing, provider, returnTo); err != nil {
			redirectSocialError(w, r, "provider_failed")
		}
		return
	}
	pending, err := randomURLToken(32)
	if err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	payload, _ := json.Marshal(socialRegistrationPayload{Profile: profile, Provider: provider, LoginType: loginType, ReturnTo: safeSocialReturn(returnTo)})
	if err = s.redis.Set(r.Context(), socialRegistrationKey(pending), payload, socialRegistrationTTL).Err(); err != nil {
		redirectSocialError(w, r, "provider_failed")
		return
	}
	http.Redirect(w, r, "/register#social_registration="+url.QueryEscape(pending), http.StatusFound)
}

func (s *server) consumeSocialRegistrationAttempt(ctx context.Context, provider, state, nonce, verifier string) (string, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil { return "", err }
	defer tx.Rollback()
	var id int64
	var nonceHash, verifierHash string
	var returnTo sql.NullString
	if err = tx.QueryRowContext(ctx, `SELECT id,nonce_hash,pkce_verifier_hash,return_to FROM social_auth_attempts WHERE state_hash=? AND provider=? AND mode='register' AND user_id IS NULL AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE`, hashText(state), provider).Scan(&id, &nonceHash, &verifierHash, &returnTo); err != nil {
		return "", err
	}
	if subtle.ConstantTimeCompare([]byte(nonceHash), []byte(hashText(nonce))) != 1 || subtle.ConstantTimeCompare([]byte(verifierHash), []byte(hashText(verifier))) != 1 {
		return "", errors.New("social registration browser binding mismatch")
	}
	result, err := tx.ExecContext(ctx, `UPDATE social_auth_attempts SET consumed_at=UTC_TIMESTAMP() WHERE id=? AND consumed_at IS NULL`, id)
	if err != nil { return "", err }
	changed, err := result.RowsAffected()
	if err != nil || changed != 1 { return "", errors.New("social registration attempt was already consumed") }
	if err = tx.Commit(); err != nil { return "", err }
	if returnTo.Valid { return safeSocialReturn(returnTo.String), nil }
	return "/app/dashboard", nil
}

func (s *server) socialRegistrationProfile(ctx context.Context, r *http.Request, provider string, config socialProviderConfig, verifier string) (identity.SocialProfile, error) {
	base, _, err := socialPublicBase()
	if err != nil { return identity.SocialProfile{}, err }
	callback := base + "/api/public/auth/" + url.PathEscape(provider) + "/callback"
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	var token string
	var profile identity.SocialProfile
	switch provider {
	case "google":
		token, err = exchangeGoogleCode(ctx, config, code, verifier, callback)
		if err == nil { profile, err = fetchGoogleSocialProfile(ctx, token) }
	case "github":
		token, err = exchangeGitHubCode(ctx, config, code, verifier, callback)
		if err == nil { profile, err = fetchGitHubSocialProfile(ctx, token) }
	case "facebook":
		profile, err = fetchFacebookProfileFromCode(ctx, config, code, callback)
	case "qq":
		token, err = exchangeQQCode(ctx, config, code, callback)
		if err == nil { profile, err = fetchQQSocialProfile(ctx, config, token) }
	case "wechat":
		profile, err = fetchWeChatProfileFromCode(ctx, config, code, callback)
	case "rainbow":
		profile, err = fetchRainbowSocialProfile(ctx, config, strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type"))), code)
	default:
		err = errors.New("provider adapter is not implemented")
	}
	token = ""
	return profile, err
}

func socialRegistrationKey(code string) string { return "auth:social:registration:" + hashText(strings.TrimSpace(code)) }
func socialRegistrationLockKey(code string) string { return socialRegistrationKey(code) + ":lock" }

func (s *server) readSocialRegistration(ctx context.Context, code string) (socialRegistrationPayload, error) {
	code = strings.TrimSpace(code)
	if len(code) < 32 || len(code) > 128 { return socialRegistrationPayload{}, redis.Nil }
	raw, err := s.redis.Get(ctx, socialRegistrationKey(code)).Bytes()
	if err != nil { return socialRegistrationPayload{}, err }
	var payload socialRegistrationPayload
	if json.Unmarshal(raw, &payload) != nil || payload.Provider == "" || payload.Profile.Provider == "" || payload.Profile.Subject == "" {
		return socialRegistrationPayload{}, errors.New("invalid social registration payload")
	}
	return payload, nil
}

func (s *server) socialRegistrationInfo(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	payload, err := s.readSocialRegistration(r.Context(), code)
	if errors.Is(err, redis.Nil) {
		jsonResponse(w, http.StatusGone, map[string]string{"error": "第三方注册凭据无效或已经过期，请重新发起"})
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方注册状态暂时不可用"})
		return
	}
	definition, _ := socialProviderDefinitionByID(payload.Provider)
	label := definition.Label
	if payload.Provider == "rainbow" { label = s.rainbowDisplayName(r.Context()) }
	if label == "" { label = payload.Provider }
	suggested := strings.TrimSpace(payload.Profile.DisplayName)
	if suggested == "" { suggested = strings.TrimSpace(payload.Profile.Login) }
	providerEmail := ""
	if payload.Profile.EmailVerified { providerEmail = strings.TrimSpace(payload.Profile.Email) }
	jsonResponse(w, http.StatusOK, map[string]any{
		"provider": payload.Provider, "provider_label": label, "suggested_display_name": suggested,
		"provider_email": providerEmail,
		"password_min_length": s.registrationInt(r.Context(), "registration.password_min_length", 10, 10, 72),
	})
}

func (s *server) socialRegistrationComplete(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Code        string `json:"code"`
		DisplayName string `json:"display_name"`
		Email       string `json:"email"`
		EmailCode   string `json:"email_code"`
		Password    string `json:"password"`
	}
	if decode(w, r, &in) != nil { return }
	in.Code = strings.TrimSpace(in.Code)
	ctx := r.Context()
	locked, err := s.redis.SetNX(ctx, socialRegistrationLockKey(in.Code), "1", 30*time.Second).Result()
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方注册状态暂时不可用"})
		return
	}
	if !locked {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "该注册请求正在处理中，请勿重复提交"})
		return
	}
	defer s.redis.Del(context.Background(), socialRegistrationLockKey(in.Code))
	payload, err := s.readSocialRegistration(ctx, in.Code)
	if errors.Is(err, redis.Nil) {
		jsonResponse(w, http.StatusGone, map[string]string{"error": "第三方注册凭据无效或已经过期，请重新发起"})
		return
	}
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方注册状态暂时不可用"})
		return
	}
	if !s.registrationBool(ctx, "registration.enabled", true) {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "当前暂未开放新用户注册"})
		return
	}
	_, configured, err := s.socialProviderConfiguration(ctx, payload.Provider)
	if err != nil || !configured {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该第三方登录方式已经停用，请重新选择注册方式"})
		return
	}
	if payload.Provider == "rainbow" && (!validRainbowLoginType(payload.LoginType) || !s.rainbowLoginTypeExposed(ctx, payload.LoginType)) {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "该聚合登录方式当前未开放"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	name := strings.TrimSpace(in.DisplayName)
	minPassword := s.registrationInt(ctx, "registration.password_min_length", 10, 10, 72)
	if !strings.Contains(email, "@") || len(email) > 320 || name == "" || len(name) > 120 || len(in.Password) < minPassword || len(in.Password) > 72 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": fmt.Sprintf("请填写有效邮箱、显示名称和 %d-72 位密码", minPassword)})
		return
	}
	if s.blockedRegistrationEmail(ctx, email) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "该邮箱域名不允许注册"})
		return
	}
	if _, found, findErr := s.identity.FindSocialUser(ctx, payload.Profile); findErr != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "第三方账户状态暂时不可用"})
		return
	} else if found {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": "该第三方账户已经绑定 GoJet 账户，请直接登录"})
		return
	}
	var existing int
	if err = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE email=?`, email).Scan(&existing); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "账户服务暂时不可用"})
		return
	}
	if existing > 0 {
		jsonResponse(w, http.StatusConflict, map[string]string{"error": identity.ErrSocialEmailCollision.Error()})
		return
	}
	if err = s.consumeAuthCode(email, "register", in.EmailCode); err != nil {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}
	user, token, err := s.identity.RegisterWithSocial(ctx, payload.Profile, email, in.Password, name, clientIP(r), r.UserAgent())
	if err != nil {
		switch {
		case errors.Is(err, identity.ErrSocialEmailCollision), errors.Is(err, identity.ErrSocialIdentityInUse):
			jsonResponse(w, http.StatusConflict, map[string]string{"error": err.Error()})
		default:
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "账户创建或第三方绑定未能完成，请重新获取邮箱验证码后重试"})
		}
		return
	}
	_ = s.redis.Del(ctx, socialRegistrationKey(in.Code)).Err()
	jsonResponse(w, http.StatusCreated, map[string]any{"user": user, "token": token, "redirect": safeSocialReturn(payload.ReturnTo), "social_bound": payload.Provider})
}
