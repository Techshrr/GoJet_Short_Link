package adminauth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"database/sql"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/settings"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db       *sql.DB
	settings *settings.Store
	now      func() time.Time
}

type Administrator struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	TOTPEnabled bool   `json:"totp_enabled"`
}

type AdministratorRecord struct {
	Administrator
	Status      string     `json:"status"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

func New(db *sql.DB, store *settings.Store) *Service {
	return &Service{db: db, settings: store, now: time.Now}
}

var permissions = map[string]map[string]bool{
	"super_admin": {"platform.read": true, "users.manage": true, "content.manage": true, "security.manage": true, "settings.manage": true, "admins.manage": true},
	"operator":    {"platform.read": true, "users.manage": true, "content.manage": true},
	"security":    {"platform.read": true, "content.manage": true, "security.manage": true},
	"support":     {"platform.read": true, "users.manage": true},
	"analyst":     {"platform.read": true},
}

func Allowed(role, permission string) bool { return permissions[role][permission] }

func (s *Service) Bootstrap(ctx context.Context, email, password string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") || len(password) < 12 {
		return errors.New("administrator bootstrap email and 12+ character password are required")
	}
	var count int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM administrators`).Scan(&count); err != nil || count > 0 {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO administrators(email,display_name,password_hash,role) VALUES(?,? ,?,'super_admin')`, email, "平台所有者", hash)
	return err
}

func (s *Service) Login(ctx context.Context, email, password, code, ip, ua string) (Administrator, string, bool, error) {
	var a Administrator
	var failures int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM administrator_audit_logs WHERE action='admin.login' AND outcome='failure' AND ip_address=? AND created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 15 MINUTE)`, ip).Scan(&failures); err != nil {
		return a, "", false, err
	}
	if failures >= 10 {
		s.audit(ctx, 0, "admin.login", "POST", "/api/admin/auth/login", ip, ua, "failure", "rate limited")
		return a, "", false, errors.New("登录尝试过于频繁，请 15 分钟后重试")
	}
	var hash, status string
	err := s.db.QueryRowContext(ctx, `SELECT id,email,display_name,password_hash,role,status,totp_enabled FROM administrators WHERE email=?`, strings.ToLower(strings.TrimSpace(email))).Scan(&a.ID, &a.Email, &a.DisplayName, &hash, &a.Role, &status, &a.TOTPEnabled)
	if err != nil || status != "active" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		s.audit(ctx, 0, "admin.login", "POST", "/api/admin/auth/login", ip, ua, "failure", "invalid credentials")
		return a, "", false, errors.New("管理员邮箱或密码错误")
	}
	if a.TOTPEnabled {
		secret, ok, getErr := s.settings.Get(ctx, fmt.Sprintf("admin.totp.%d", a.ID))
		if getErr != nil || !ok || !verifyTOTP(secret, code, s.now()) {
			s.audit(ctx, a.ID, "admin.login", "POST", "/api/admin/auth/login", ip, ua, "failure", "two-factor code required or invalid")
			return a, "", true, errors.New("请输入有效的二次验证码")
		}
	}
	raw := make([]byte, 32)
	if _, err = rand.Read(raw); err != nil {
		return a, "", false, err
	}
	token := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(token))
	_, err = s.db.ExecContext(ctx, `INSERT INTO administrator_sessions(administrator_id,token_hash,ip_address,user_agent,expires_at,last_seen_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR),UTC_TIMESTAMP())`, a.ID, hex.EncodeToString(sum[:]), ip, truncate(ua, 500))
	if err != nil {
		return a, "", false, err
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE administrators SET last_login_at=UTC_TIMESTAMP() WHERE id=?`, a.ID)
	s.audit(ctx, a.ID, "admin.login", "POST", "/api/admin/auth/login", ip, ua, "success", "")
	return a, token, false, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (Administrator, int64, error) {
	var a Administrator
	var sessionID int64
	if len(token) != 64 {
		return a, 0, sql.ErrNoRows
	}
	sum := sha256.Sum256([]byte(token))
	err := s.db.QueryRowContext(ctx, `SELECT a.id,a.email,a.display_name,a.role,a.totp_enabled,s.id FROM administrator_sessions s JOIN administrators a ON a.id=s.administrator_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND a.status='active'`, hex.EncodeToString(sum[:])).Scan(&a.ID, &a.Email, &a.DisplayName, &a.Role, &a.TOTPEnabled, &sessionID)
	if err == nil {
		_, _ = s.db.ExecContext(ctx, `UPDATE administrator_sessions SET last_seen_at=UTC_TIMESTAMP() WHERE id=? AND last_seen_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE)`, sessionID)
	}
	return a, sessionID, err
}

func (s *Service) Logout(ctx context.Context, sessionID int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM administrator_sessions WHERE id=?`, sessionID)
	return err
}

func (s *Service) ChangePassword(ctx context.Context, administratorID, currentSessionID int64, oldPassword, newPassword string) error {
	if len(newPassword) < 12 {
		return errors.New("新密码至少需要 12 位")
	}
	var hash string
	if err := s.db.QueryRowContext(ctx, `SELECT password_hash FROM administrators WHERE id=? AND status='active'`, administratorID).Scan(&hash); err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(oldPassword)) != nil {
		return errors.New("当前密码错误")
	}
	next, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE administrators SET password_hash=? WHERE id=?`, next, administratorID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM administrator_sessions WHERE administrator_id=? AND id<>?`, administratorID, currentSessionID); err != nil {
		return err
	}
	return tx.Commit()
}
func (s *Service) RevokeAll(ctx context.Context, administratorID int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM administrator_sessions WHERE administrator_id=?`, administratorID)
	return err
}

func (s *Service) List(ctx context.Context) ([]AdministratorRecord, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,email,display_name,role,status,totp_enabled,last_login_at,created_at FROM administrators ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []AdministratorRecord{}
	for rows.Next() {
		var item AdministratorRecord
		if err = rows.Scan(&item.ID, &item.Email, &item.DisplayName, &item.Role, &item.Status, &item.TOTPEnabled, &item.LastLoginAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) Create(ctx context.Context, email, name, password, role string) (int64, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)
	if !strings.Contains(email, "@") || name == "" || len(password) < 12 || permissions[role] == nil {
		return 0, errors.New("管理员邮箱、名称、12 位以上密码和有效角色为必填项")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return 0, err
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO administrators(email,display_name,password_hash,role) VALUES(?,?,?,?)`, email, name, hash, role)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Service) Update(ctx context.Context, actorID, id int64, role, status string) error {
	if permissions[role] == nil || (status != "active" && status != "suspended") {
		return errors.New("管理员角色或状态无效")
	}
	if actorID == id && status != "active" {
		return errors.New("不能停用当前登录的管理员")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var oldRole string
	if err = tx.QueryRowContext(ctx, `SELECT role FROM administrators WHERE id=? FOR UPDATE`, id).Scan(&oldRole); err != nil {
		return err
	}
	if oldRole == "super_admin" && (role != "super_admin" || status != "active") {
		var active int
		if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM administrators WHERE role='super_admin' AND status='active'`).Scan(&active); err != nil {
			return err
		}
		if active <= 1 {
			return errors.New("平台必须保留至少一名正常的超级管理员")
		}
	}
	if _, err = tx.ExecContext(ctx, `UPDATE administrators SET role=?,status=? WHERE id=?`, role, status, id); err != nil {
		return err
	}
	if status == "suspended" {
		if _, err = tx.ExecContext(ctx, `DELETE FROM administrator_sessions WHERE administrator_id=?`, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Service) BeginTOTP(ctx context.Context, a Administrator) (string, string, error) {
	raw := make([]byte, 20)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw)
	if err := s.settings.Set(ctx, fmt.Sprintf("admin.totp.pending.%d", a.ID), secret, true); err != nil {
		return "", "", err
	}
	label := url.PathEscape("GoJet:" + a.Email)
	return secret, "otpauth://totp/" + label + "?secret=" + secret + "&issuer=GoJet&digits=6&period=30", nil
}

func (s *Service) ConfirmTOTP(ctx context.Context, a Administrator, code string) error {
	pendingKey := fmt.Sprintf("admin.totp.pending.%d", a.ID)
	secret, ok, err := s.settings.Get(ctx, pendingKey)
	if err != nil || !ok || !verifyTOTP(secret, code, s.now()) {
		return errors.New("二次验证码无效")
	}
	if err = s.settings.Set(ctx, fmt.Sprintf("admin.totp.%d", a.ID), secret, true); err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `UPDATE administrators SET totp_enabled=TRUE WHERE id=?`, a.ID)
	return err
}

func verifyTOTP(secret, code string, now time.Time) bool {
	decoded, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
	if err != nil || len(code) != 6 {
		return false
	}
	for offset := int64(-1); offset <= 1; offset++ {
		counter := uint64(now.Unix()/30 + offset)
		var message [8]byte
		binary.BigEndian.PutUint64(message[:], counter)
		mac := hmac.New(sha1.New, decoded)
		_, _ = mac.Write(message[:])
		digest := mac.Sum(nil)
		index := digest[len(digest)-1] & 0x0f
		value := (binary.BigEndian.Uint32(digest[index:index+4]) & 0x7fffffff) % 1_000_000
		if hmac.Equal([]byte(fmt.Sprintf("%06d", value)), []byte(code)) {
			return true
		}
	}
	return false
}

func (s *Service) AuditRequest(ctx context.Context, a Administrator, method, path, ip, ua string) {
	s.audit(ctx, a.ID, "admin.request", method, path, ip, ua, "success", "")
}
func (s *Service) AuditDenied(ctx context.Context, a Administrator, method, path, ip, ua, reason string) {
	s.audit(ctx, a.ID, "admin.request", method, path, ip, ua, "failure", reason)
}
func (s *Service) audit(ctx context.Context, id int64, action, method, path, ip, ua, outcome, reason string) {
	var actor any
	if id > 0 {
		actor = id
	}
	_, _ = s.db.ExecContext(ctx, `INSERT INTO administrator_audit_logs(administrator_id,action,method,path,ip_address,user_agent,outcome,reason) VALUES(?,?,?,?,?,?,?,?)`, actor, action, method, truncate(path, 500), ip, truncate(ua, 500), outcome, truncate(reason, 500))
}
func truncate(v string, n int) string {
	if len(v) > n {
		return v[:n]
	}
	return v
}
