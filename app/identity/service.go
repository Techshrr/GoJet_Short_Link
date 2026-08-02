package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"golang.org/x/crypto/bcrypt"
	"strings"
	"time"
)

type User struct {
	ID            int64  `json:"id"`
	Email         string `json:"email"`
	DisplayName   string `json:"display_name"`
	Status        string `json:"status"`
	EmailVerified bool   `json:"email_verified"`
}
type Service struct {
	db         *sql.DB
	sessionTTL time.Duration
}

func New(db *sql.DB) *Service { return &Service{db: db, sessionTTL: 30 * 24 * time.Hour} }
func (s *Service) Register(ctx context.Context, email, password, name string) (User, string, error) {
	return s.RegisterWithMetadata(ctx, email, password, name, "", "")
}
func (s *Service) RegisterWithMetadata(ctx context.Context, email, password, name, ip, userAgent string) (User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") || len(password) < 10 || name == "" {
		return User{}, "", errors.New("邮箱、显示名称和至少 10 位密码为必填项")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return User{}, "", err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, "", err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `INSERT INTO users(email,password_hash,display_name) VALUES(?,?,?)`, email, string(hash), name)
	if err != nil {
		return User{}, "", err
	}
	id, _ := result.LastInsertId()
	workspace, err := tx.ExecContext(ctx, `INSERT INTO workspaces(name,workspace_type,owner_id) VALUES(?,'personal',?)`, name+" 的工作区", id)
	if err != nil {
		return User{}, "", err
	}
	wid, _ := workspace.LastInsertId()
	if _, err = tx.ExecContext(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'owner')`, wid, id); err != nil {
		return User{}, "", err
	}
	token, tokenHash, err := newToken()
	if err != nil {
		return User{}, "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_sessions(id,user_id,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?)`, tokenHash, id, nullable(ip), nullable(truncate(userAgent, 500)), time.Now().Add(s.sessionTTL)); err != nil {
		return User{}, "", err
	}
	if err = tx.Commit(); err != nil {
		return User{}, "", err
	}
	return User{ID: id, Email: email, DisplayName: name, Status: "active"}, token, nil
}
func (s *Service) Login(ctx context.Context, email, password string) (User, string, error) {
	return s.LoginWithMetadata(ctx, email, password, "", "")
}
func (s *Service) LoginWithMetadata(ctx context.Context, email, password, ip, userAgent string) (User, string, error) {
	var user User
	var hash string
	err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,status,password_hash,email_verified_at IS NOT NULL FROM users WHERE email=?`, strings.ToLower(strings.TrimSpace(email))).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Status, &hash, &user.EmailVerified)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil || user.Status != "active" {
		return User{}, "", errors.New("邮箱或密码错误")
	}
	token, tokenHash, err := newToken()
	if err != nil {
		return User{}, "", err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO user_sessions(id,user_id,ip_address,user_agent,expires_at) VALUES(?,?,?,?,?)`, tokenHash, user.ID, nullable(ip), nullable(truncate(userAgent, 500)), time.Now().Add(s.sessionTTL))
	return user, token, err
}
func (s *Service) Authenticate(ctx context.Context, token string) (User, error) {
	sum := sha256.Sum256([]byte(token))
	var u User
	id := hex.EncodeToString(sum[:])
	err := s.db.QueryRowContext(ctx, `SELECT u.id,u.email,u.display_name,u.status,u.email_verified_at IS NOT NULL FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>NOW() AND s.revoked_at IS NULL AND u.status='active'`, id).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Status, &u.EmailVerified)
	if err == nil {
		_, _ = s.db.ExecContext(ctx, `UPDATE user_sessions SET last_seen_at=NOW() WHERE id=? AND last_seen_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)`, id)
	}
	return u, err
}
func (s *Service) CreateVerification(ctx context.Context, userID int64) (string, error) {
	token, hash, err := newToken()
	if err != nil {
		return "", err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))`, userID, hash)
	return token, err
}
func (s *Service) VerifyEmail(ctx context.Context, token string) error {
	sum := sha256.Sum256([]byte(token))
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id, userID int64
	err = tx.QueryRowContext(ctx, `SELECT id,user_id FROM email_verification_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>NOW() FOR UPDATE`, hex.EncodeToString(sum[:])).Scan(&id, &userID)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id=?`, userID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE email_verification_tokens SET used_at=NOW() WHERE id=?`, id); err != nil {
		return err
	}
	return tx.Commit()
}
func newToken() (string, string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(token))
	return token, hex.EncodeToString(sum[:]), nil
}

func nullable(value string) any {
	if value == "" {
		return nil
	}
	return value
}
func truncate(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}
