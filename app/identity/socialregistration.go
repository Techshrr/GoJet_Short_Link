package identity

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// FindSocialUser resolves an already-bound third-party identity without ever
// creating an account. Registration callbacks use this before creating a
// pending GoJet registration so an existing binding remains a login path.
func (s *Service) FindSocialUser(ctx context.Context, profile SocialProfile) (User, bool, error) {
	profile = normalizeSocialProfile(profile)
	if profile.Provider == "" || profile.Subject == "" || len(profile.Subject) > 255 {
		return User{}, false, errors.New("第三方账户身份标识无效")
	}
	var user User
	err := s.db.QueryRowContext(ctx, `SELECT u.id,u.email,u.display_name,u.status,u.email_verified_at IS NOT NULL FROM user_social_identities si JOIN users u ON u.id=si.user_id WHERE si.provider=? AND si.provider_subject=?`, profile.Provider, profile.Subject).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Status, &user.EmailVerified)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, false, nil
	}
	if err != nil {
		return User{}, false, err
	}
	if user.Status != "active" {
		return User{}, false, ErrSocialAccountUnavailable
	}
	return user, true, nil
}

// RegisterWithSocial creates the password account and its third-party binding
// in one database transaction. The caller has already verified the chosen
// GoJet email with an email code; provider email is metadata only and is never
// used to silently merge accounts.
func (s *Service) RegisterWithSocial(ctx context.Context, profile SocialProfile, email, password, name, ip, userAgent string) (User, string, error) {
	profile = normalizeSocialProfile(profile)
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)
	if profile.Provider == "" || profile.Subject == "" || len(profile.Subject) > 255 {
		return User{}, "", errors.New("第三方账户身份标识无效")
	}
	if !strings.Contains(email, "@") || len(email) > 320 || name == "" || len(password) < 10 || len(password) > 72 {
		return User{}, "", errors.New("请填写有效邮箱、显示名称和 10-72 位密码")
	}
	if len(name) > 120 {
		return User{}, "", errors.New("显示名称不能超过 120 个字符")
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return User{}, "", err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, "", err
	}
	defer tx.Rollback()

	var existingID int64
	err = tx.QueryRowContext(ctx, `SELECT user_id FROM user_social_identities WHERE provider=? AND provider_subject=? FOR UPDATE`, profile.Provider, profile.Subject).Scan(&existingID)
	if err == nil {
		return User{}, "", ErrSocialIdentityInUse
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return User{}, "", err
	}
	err = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email=? FOR UPDATE`, email).Scan(&existingID)
	if err == nil {
		return User{}, "", ErrSocialEmailCollision
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return User{}, "", err
	}

	result, err := tx.ExecContext(ctx, `INSERT INTO users(email,password_hash,password_login_enabled,display_name,email_verified_at) VALUES(?,?,TRUE,?,UTC_TIMESTAMP())`, email, string(passwordHash), name)
	if err != nil {
		return User{}, "", err
	}
	userID, err := result.LastInsertId()
	if err != nil {
		return User{}, "", err
	}
	workspaceResult, err := tx.ExecContext(ctx, `INSERT INTO workspaces(name,workspace_type,owner_id) VALUES(?,'personal',?)`, socialTruncate(name+" 的工作区", 120), userID)
	if err != nil {
		return User{}, "", err
	}
	workspaceID, err := workspaceResult.LastInsertId()
	if err != nil {
		return User{}, "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO workspace_subscriptions(workspace_id,plan_id) SELECT ?,id FROM plans WHERE code='starter' AND status='active'`, workspaceID); err != nil {
		return User{}, "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner')`, workspaceID, userID); err != nil {
		return User{}, "", err
	}
	profileJSON, _ := json.Marshal(map[string]any{"login": profile.Login, "provider_email_verified": profile.EmailVerified})
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_social_identities(user_id,provider,provider_subject,provider_email,email_verified,display_name,avatar_url,profile_json,last_login_at) VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`, userID, profile.Provider, profile.Subject, socialNullable(profile.Email), profile.EmailVerified, socialNullable(profile.DisplayName), socialNullable(profile.AvatarURL), string(profileJSON)); err != nil {
		return User{}, "", err
	}
	token, tokenHash, err := newToken()
	if err != nil {
		return User{}, "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_sessions(id,user_id,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?)`, tokenHash, userID, socialNullable(ip), socialNullable(socialTruncate(userAgent, 500)), time.Now().Add(s.sessionTTL)); err != nil {
		return User{}, "", err
	}
	metadata, _ := json.Marshal(map[string]any{"provider": profile.Provider, "registration_flow": "verified_email_completion"})
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,workspace_id,action,target_type,target_id,metadata,ip_address) VALUES(?,?,'auth.social.register.complete','user',?,?,?)`, userID, workspaceID, strconv.FormatInt(userID, 10), string(metadata), socialNullable(ip)); err != nil {
		return User{}, "", err
	}
	if err = tx.Commit(); err != nil {
		return User{}, "", err
	}
	return User{ID: userID, Email: email, DisplayName: name, Status: "active", EmailVerified: true}, token, nil
}
