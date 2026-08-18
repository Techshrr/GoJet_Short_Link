package identity

import (
    "context"
    "database/sql"
    "errors"
    "time"
)

// IssueSession creates a normal server-side session after an already-verified
// secondary authentication step. It deliberately reuses the same token format
// and session table as password login instead of creating a parallel auth path.
func (s *Service) IssueSession(ctx context.Context, userID int64, ip, userAgent string) (User, string, error) {
    var user User
    if err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,status,email_verified_at IS NOT NULL FROM users WHERE id=? AND status='active'`, userID).Scan(&user.ID,&user.Email,&user.DisplayName,&user.Status,&user.EmailVerified); err != nil {
        if errors.Is(err, sql.ErrNoRows) { return User{}, "", errors.New("账户不可用") }
        return User{}, "", err
    }
    token, tokenHash, err := newToken()
    if err != nil { return User{}, "", err }
    if _, err = s.db.ExecContext(ctx, `INSERT INTO user_sessions(id,user_id,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?)`, tokenHash, userID, nullable(ip), nullable(truncate(userAgent,500)), time.Now().Add(s.sessionTTL)); err != nil { return User{}, "", err }
    _, _ = s.db.ExecContext(ctx, `UPDATE users SET last_login_at=NOW() WHERE id=?`, userID)
    return user, token, nil
}
