package identity

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrSocialEmailCollision          = errors.New("该邮箱已经存在 GoJet 账户，请先使用原登录方式进入账户后再绑定第三方身份")
	ErrSocialRegistrationClosed      = errors.New("当前暂未开放新用户注册")
	ErrSocialEmailBlocked            = errors.New("该邮箱域名不允许注册")
	ErrSocialAccountUnavailable      = errors.New("账户当前不可用")
	ErrSocialIdentityInUse           = errors.New("该第三方账户已经绑定到其他 GoJet 账户")
	ErrSocialProviderAlreadyLinked   = errors.New("当前 GoJet 账户已经绑定了该第三方平台的另一个账户")
	ErrSocialIdentityNotLinked       = errors.New("当前账户尚未绑定该第三方登录方式")
	ErrLastLoginCredential           = errors.New("不能解除最后一个可用登录凭据，请先设置密码或绑定另一种第三方登录方式")
)

type SocialProfile struct {
	Provider      string
	Subject       string
	Email         string
	EmailVerified bool
	DisplayName   string
	AvatarURL     string
	Login         string
}

func normalizeSocialProfile(profile SocialProfile) SocialProfile {
	profile.Provider = strings.ToLower(strings.TrimSpace(profile.Provider))
	profile.Subject = strings.TrimSpace(profile.Subject)
	profile.Email = strings.ToLower(strings.TrimSpace(profile.Email))
	profile.DisplayName = strings.TrimSpace(profile.DisplayName)
	profile.Login = strings.TrimSpace(profile.Login)
	profile.AvatarURL = strings.TrimSpace(profile.AvatarURL)
	if profile.DisplayName == "" {
		profile.DisplayName = profile.Login
	}
	profile.DisplayName = socialTruncate(profile.DisplayName, 120)
	profile.AvatarURL = socialTruncate(profile.AvatarURL, 1024)
	return profile
}

func (s *Service) ResolveOrRegisterSocial(ctx context.Context, profile SocialProfile, allowRegister, emailAllowed bool) (User, bool, error) {
	profile = normalizeSocialProfile(profile)
	if profile.Provider == "" || profile.Subject == "" || len(profile.Subject) > 255 {
		return User{}, false, errors.New("第三方账户身份标识无效")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, false, err
	}
	defer tx.Rollback()

	var user User
	err = tx.QueryRowContext(ctx, `SELECT u.id,u.email,u.display_name,u.status,u.email_verified_at IS NOT NULL FROM user_social_identities si JOIN users u ON u.id=si.user_id WHERE si.provider=? AND si.provider_subject=? FOR UPDATE`, profile.Provider, profile.Subject).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Status, &user.EmailVerified)
	if err == nil {
		if user.Status != "active" {
			return User{}, false, ErrSocialAccountUnavailable
		}
		profileJSON, _ := json.Marshal(map[string]any{"login": profile.Login, "email_verified": profile.EmailVerified})
		if _, err = tx.ExecContext(ctx, `UPDATE user_social_identities SET provider_email=COALESCE(?,provider_email),email_verified=IF(?,TRUE,email_verified),display_name=COALESCE(?,display_name),avatar_url=COALESCE(?,avatar_url),profile_json=?,last_login_at=UTC_TIMESTAMP() WHERE provider=? AND provider_subject=?`, socialNullable(profile.Email), profile.EmailVerified, socialNullable(profile.DisplayName), socialNullable(profile.AvatarURL), string(profileJSON), profile.Provider, profile.Subject); err != nil {
			return User{}, false, err
		}
		if err = tx.Commit(); err != nil {
			return User{}, false, err
		}
		return user, false, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return User{}, false, err
	}
	if profile.Email == "" || !profile.EmailVerified || !strings.Contains(profile.Email, "@") {
		return User{}, false, errors.New("第三方账户没有可用的已验证邮箱")
	}
	if !allowRegister {
		return User{}, false, ErrSocialRegistrationClosed
	}
	if !emailAllowed {
		return User{}, false, ErrSocialEmailBlocked
	}
	if profile.DisplayName == "" {
		profile.DisplayName = socialTruncate(strings.Split(profile.Email, "@")[0], 120)
	}

	var existingID int64
	err = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email=? FOR UPDATE`, profile.Email).Scan(&existingID)
	if err == nil {
		return User{}, false, ErrSocialEmailCollision
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return User{}, false, err
	}

	randomPassword, err := socialPassword()
	if err != nil {
		return User{}, false, err
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(randomPassword), 12)
	if err != nil {
		return User{}, false, err
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO users(email,password_hash,password_login_enabled,display_name,email_verified_at) VALUES(?,?,FALSE,?,UTC_TIMESTAMP())`, profile.Email, string(passwordHash), profile.DisplayName)
	if err != nil {
		return User{}, false, err
	}
	userID, err := result.LastInsertId()
	if err != nil {
		return User{}, false, err
	}
	workspaceResult, err := tx.ExecContext(ctx, `INSERT INTO workspaces(name,workspace_type,owner_id) VALUES(?,'personal',?)`, socialTruncate(profile.DisplayName+" 的工作区", 120), userID)
	if err != nil {
		return User{}, false, err
	}
	workspaceID, err := workspaceResult.LastInsertId()
	if err != nil {
		return User{}, false, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO workspace_subscriptions(workspace_id,plan_id) SELECT ?,id FROM plans WHERE code='starter' AND status='active'`, workspaceID); err != nil {
		return User{}, false, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner')`, workspaceID, userID); err != nil {
		return User{}, false, err
	}
	profileJSON, _ := json.Marshal(map[string]any{"login": profile.Login, "email_verified": profile.EmailVerified})
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_social_identities(user_id,provider,provider_subject,provider_email,email_verified,display_name,avatar_url,profile_json,last_login_at) VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`, userID, profile.Provider, profile.Subject, profile.Email, profile.EmailVerified, socialNullable(profile.DisplayName), socialNullable(profile.AvatarURL), string(profileJSON)); err != nil {
		return User{}, false, err
	}
	metadata, _ := json.Marshal(map[string]any{"provider": profile.Provider, "provider_subject": profile.Subject})
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,workspace_id,action,target_type,target_id,metadata) VALUES(?,?,'auth.social.register','user',?,?)`, userID, workspaceID, strconv.FormatInt(userID, 10), string(metadata)); err != nil {
		return User{}, false, err
	}
	if err = tx.Commit(); err != nil {
		return User{}, false, err
	}
	return User{ID: userID, Email: profile.Email, DisplayName: profile.DisplayName, Status: "active", EmailVerified: true}, true, nil
}

func (s *Service) CreateSessionForUser(ctx context.Context, userID int64, ip, userAgent string) (User, string, error) {
	var user User
	if err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,status,email_verified_at IS NOT NULL FROM users WHERE id=?`, userID).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Status, &user.EmailVerified); err != nil {
		return User{}, "", err
	}
	if user.Status != "active" {
		return User{}, "", ErrSocialAccountUnavailable
	}
	token, tokenHash, err := newToken()
	if err != nil {
		return User{}, "", err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, "", err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_sessions(id,user_id,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?)`, tokenHash, user.ID, socialNullable(ip), socialNullable(socialTruncate(userAgent, 500)), time.Now().Add(s.sessionTTL)); err != nil {
		return User{}, "", err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users SET last_login_at=UTC_TIMESTAMP() WHERE id=?`, user.ID); err != nil {
		return User{}, "", err
	}
	if err = tx.Commit(); err != nil {
		return User{}, "", err
	}
	return user, token, nil
}

func socialPassword() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func socialTruncate(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit]
}

func socialNullable(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
