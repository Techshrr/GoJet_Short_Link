package identity

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
)

func tokenDigest(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (s *Service) VerificationUser(ctx context.Context, token string) (User, error) {
	var user User
	err := s.db.QueryRowContext(ctx, `SELECT u.id,u.email,u.display_name,u.status,u.email_verified_at IS NOT NULL FROM email_verification_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>NOW()`, tokenDigest(token)).Scan(&user.ID,&user.Email,&user.DisplayName,&user.Status,&user.EmailVerified)
	return user, err
}

func (s *Service) PasswordResetUser(ctx context.Context, token string) (User, error) {
	var user User
	err := s.db.QueryRowContext(ctx, `SELECT u.id,u.email,u.display_name,u.status,u.email_verified_at IS NOT NULL FROM password_reset_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>NOW()`, tokenDigest(token)).Scan(&user.ID,&user.Email,&user.DisplayName,&user.Status,&user.EmailVerified)
	return user, err
}
