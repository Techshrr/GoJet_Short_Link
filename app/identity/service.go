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
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Status      string `json:"status"`
}
type Service struct {
	db         *sql.DB
	sessionTTL time.Duration
}

func New(db *sql.DB) *Service { return &Service{db: db, sessionTTL: 30 * 24 * time.Hour} }
func (s *Service) Register(ctx context.Context, email, password, name string) (User, string, error) {
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
	if _, err = tx.ExecContext(ctx, `INSERT INTO user_sessions(id,user_id,expires_at) VALUES(?,?,?)`, tokenHash, id, time.Now().Add(s.sessionTTL)); err != nil {
		return User{}, "", err
	}
	if err = tx.Commit(); err != nil {
		return User{}, "", err
	}
	return User{ID: id, Email: email, DisplayName: name, Status: "active"}, token, nil
}
func (s *Service) Login(ctx context.Context, email, password string) (User, string, error) {
	var user User
	var hash string
	err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,status,password_hash FROM users WHERE email=?`, strings.ToLower(strings.TrimSpace(email))).Scan(&user.ID, &user.Email, &user.DisplayName, &user.Status, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil || user.Status != "active" {
		return User{}, "", errors.New("邮箱或密码错误")
	}
	token, tokenHash, err := newToken()
	if err != nil {
		return User{}, "", err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO user_sessions(id,user_id,expires_at) VALUES(?,?,?)`, tokenHash, user.ID, time.Now().Add(s.sessionTTL))
	return user, token, err
}
func (s *Service) Authenticate(ctx context.Context, token string) (User, error) {
	sum := sha256.Sum256([]byte(token))
	var u User
	err := s.db.QueryRowContext(ctx, `SELECT u.id,u.email,u.display_name,u.status FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>NOW() AND u.status='active'`, hex.EncodeToString(sum[:])).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Status)
	return u, err
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
