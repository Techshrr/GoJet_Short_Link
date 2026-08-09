package adminauth

import (
	"context"
	"errors"
	"fmt"
)

// ValidateTOTP validates a fresh administrator TOTP code without deciding how
// long a privileged session should remain elevated. Session elevation is owned
// by the HTTP layer and persisted using database UTC time.
func (s *Service) ValidateTOTP(ctx context.Context, a Administrator, code string) error {
	if !a.TOTPEnabled {
		return errors.New("请先启用管理员二次验证")
	}
	secret, ok, err := s.settings.Get(ctx, fmt.Sprintf("admin.totp.%d", a.ID))
	if err != nil || !ok || !verifyTOTP(secret, code, s.now()) {
		return errors.New("敏感操作需要有效的二次验证码")
	}
	return nil
}
