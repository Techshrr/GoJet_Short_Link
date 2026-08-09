package domains

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"database/sql"
	"encoding/hex"
	"errors"
	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
	"net"
	"strings"
	"time"
)

type Service struct {
	db         *sql.DB
	workspaces *workspace.Service
	resolver   *net.Resolver
}
type Domain struct {
	ID, WorkspaceID               int64 `json:",omitempty"`
	Hostname, Status, HTTPSStatus string
	LastError                     *string    `json:"last_error"`
	LastCheckedAt                 *time.Time `json:"last_checked_at"`
	CreatedAt                     time.Time  `json:"created_at"`
}

func New(db *sql.DB, w *workspace.Service) *Service {
	return &Service{db: db, workspaces: w, resolver: net.DefaultResolver}
}
func (s *Service) Create(ctx context.Context, userID, workspaceID int64, hostname string) (Domain, string, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "manage") {
		return Domain{}, "", errors.New("forbidden")
	}
	hostname = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(hostname), "."))
	if net.ParseIP(hostname) != nil || strings.ContainsAny(hostname, " /:") || !strings.Contains(hostname, ".") {
		return Domain{}, "", errors.New("域名格式无效")
	}
	raw := make([]byte, 24)
	if _, err = rand.Read(raw); err != nil {
		return Domain{}, "", err
	}
	token := hex.EncodeToString(raw)
	sum := sha256.Sum256([]byte(token))
	result, err := s.db.ExecContext(ctx, `INSERT INTO custom_domains(workspace_id,hostname,verification_token_hash) VALUES(?,?,?)`, workspaceID, hostname, hex.EncodeToString(sum[:]))
	if err != nil {
		return Domain{}, "", err
	}
	id, _ := result.LastInsertId()
	return Domain{ID: id, WorkspaceID: workspaceID, Hostname: hostname, Status: "pending", HTTPSStatus: "pending"}, token, nil
}
func (s *Service) List(ctx context.Context, userID, workspaceID int64) ([]Domain, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return nil, errors.New("forbidden")
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,workspace_id,hostname,status,https_status,last_error,last_checked_at,created_at FROM custom_domains WHERE workspace_id=? ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Domain{}
	for rows.Next() {
		var item Domain
		if err = rows.Scan(&item.ID, &item.WorkspaceID, &item.Hostname, &item.Status, &item.HTTPSStatus, &item.LastError, &item.LastCheckedAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
func (s *Service) Verify(ctx context.Context, userID, workspaceID, id int64) error {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "manage") {
		return errors.New("forbidden")
	}
	var hostname, tokenHash string
	if err = s.db.QueryRowContext(ctx, `SELECT hostname,verification_token_hash FROM custom_domains WHERE id=? AND workspace_id=?`, id, workspaceID).Scan(&hostname, &tokenHash); err != nil {
		return err
	}
	records, lookupErr := s.resolver.LookupTXT(ctx, "_gojet."+hostname)
	verified := false
	for _, record := range records {
		value := strings.TrimPrefix(record, "gojet-verification=")
		sum := sha256.Sum256([]byte(value))
		if value != "" && hex.EncodeToString(sum[:]) == tokenHash {
			verified = true
			break
		}
	}
	status, httpsStatus, lastError := "error", "pending", errorString(lookupErr)
	if verified {
		status = "active"
		dialer := net.Dialer{Timeout: 5 * time.Second}
		conn, tlsErr := tls.DialWithDialer(&dialer, "tcp", net.JoinHostPort(hostname, "443"), &tls.Config{ServerName: hostname, MinVersion: tls.VersionTLS12})
		if tlsErr == nil {
			httpsStatus = "active"
			_ = conn.Close()
			lastError = ""
		} else {
			httpsStatus = "error"
			lastError = tlsErr.Error()
		}
	} else if lookupErr == nil {
		lastError = "未找到匹配的 _gojet TXT 验证记录"
	}
	_, err = s.db.ExecContext(ctx, `UPDATE custom_domains SET status=?,https_status=?,last_error=NULLIF(?,''),last_checked_at=NOW() WHERE id=?`, status, httpsStatus, lastError, id)
	return err
}
func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
