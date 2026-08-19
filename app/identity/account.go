package identity

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func (s *Service) UpdateDisplayName(ctx context.Context, userID int64, displayName string) error {
	displayName = strings.TrimSpace(displayName)
	if displayName == "" || len(displayName) > 120 {
		return errors.New("显示名称不能为空且不能超过 120 个字符")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE users SET display_name=? WHERE id=? AND status='active'`, displayName, userID)
	if err != nil {
		return err
	}
	if n, _ := result.RowsAffected(); n != 1 {
		return errors.New("账户不可用")
	}
	return nil
}

// ChangePassword deliberately revokes every user session, including the
// current session. The browser must return to /login after success.
func (s *Service) ChangePassword(ctx context.Context, userID int64, currentPassword, newPassword string) error {
	if len(newPassword) < 10 {
		return errors.New("新密码至少需要 10 位")
	}
	var currentHash string
	if err := s.db.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id=? AND status='active'`, userID).Scan(&currentHash); err != nil {
		return errors.New("账户不可用")
	}
	if bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(currentPassword)) != nil {
		return errors.New("当前密码错误")
	}
	nextHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE users SET password_hash=?,password_login_enabled=TRUE WHERE id=?`, string(nextHash), userID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE user_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=?`, userID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) RevokeToken(ctx context.Context, token string) error {
	if len(token) != 64 {
		return nil
	}
	sum := sha256.Sum256([]byte(token))
	_, err := s.db.ExecContext(ctx, `UPDATE user_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE id=?`, hex.EncodeToString(sum[:]))
	return err
}
