package identity

import (
	"context"
	"errors"
	"strings"
	"time"
)

// LoginByEmailWithMetadata creates a normal user session after another trusted
// authentication factor (currently a short-lived email code) has been verified.
func (s *Service) LoginByEmailWithMetadata(ctx context.Context, email, ip, userAgent string) (User, string, error) {
	var user User
	err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,status,email_verified_at IS NOT NULL FROM users WHERE email=?`, strings.ToLower(strings.TrimSpace(email))).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Status, &user.EmailVerified)
	if err != nil || user.Status != "active" {
		return User{}, "", errors.New("账户不可用")
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
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_sessions(id,user_id,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?)`, tokenHash, user.ID, nullable(ip), nullable(truncate(userAgent, 500)), time.Now().Add(s.sessionTTL)); err != nil {
		return User{}, "", err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users SET last_login_at=NOW() WHERE id=?`, user.ID); err != nil {
		return User{}, "", err
	}
	if err = tx.Commit(); err != nil {
		return User{}, "", err
	}
	return user, token, nil
}
