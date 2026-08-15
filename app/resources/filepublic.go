package resources

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrFilePassword      = errors.New("file password required or invalid")
	ErrFileNotFound      = errors.New("file not found")
	ErrFileExpired       = errors.New("file expired")
	ErrFileDownloadLimit = errors.New("download limit reached")
	ErrFileSafetyReview  = errors.New("file safety review required")
)

type PublicFileMetadata struct {
	Slug         string     `json:"slug"`
	OriginalName string     `json:"original_name"`
	MIMEType     string     `json:"mime_type"`
	SizeBytes    int64      `json:"size_bytes"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	MaxDownloads *int64     `json:"max_downloads,omitempty"`
	Downloads    int64      `json:"downloads"`
	Protected    bool       `json:"protected"`
}

func (s *Service) FileProtectionMap(ctx context.Context, workspaceID int64) (map[int64]bool, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,(password_hash IS NOT NULL) FROM file_shares WHERE workspace_id=? AND deleted_at IS NULL`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := map[int64]bool{}
	for rows.Next() {
		var id int64
		var protected bool
		if err = rows.Scan(&id, &protected); err != nil {
			return nil, err
		}
		items[id] = protected
	}
	return items, rows.Err()
}

func (s *Service) SetFilePassword(ctx context.Context, user, workspaceID, id int64, password string) error {
	if err := s.canEdit(ctx, user, workspaceID); err != nil {
		return err
	}
	password = strings.TrimSpace(password)
	if password == "" {
		_, err := s.db.ExecContext(ctx, `UPDATE file_shares SET password_hash=NULL WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, id, workspaceID)
		return err
	}
	if len(password) < 6 || len(password) > 128 {
		return errors.New("文件访问密码必须为 6-128 位")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `UPDATE file_shares SET password_hash=? WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, hash, id, workspaceID)
	return err
}

func (s *Service) PublicFileMetadata(ctx context.Context, slug string) (PublicFileMetadata, error) {
	var item PublicFileMetadata
	var protected bool
	var scanStatus, status string
	var deletedAt sql.NullTime
	err := s.db.QueryRowContext(ctx, `
		SELECT slug,original_name,mime_type,size_bytes,expires_at,max_downloads,downloads,(password_hash IS NOT NULL),scan_status,status,deleted_at
		FROM file_shares WHERE slug=?`, slug).Scan(
		&item.Slug, &item.OriginalName, &item.MIMEType, &item.SizeBytes, &item.ExpiresAt, &item.MaxDownloads, &item.Downloads, &protected,
		&scanStatus, &status, &deletedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return PublicFileMetadata{}, ErrFileNotFound
		}
		return PublicFileMetadata{}, err
	}
	if deletedAt.Valid {
		return PublicFileMetadata{}, ErrFileNotFound
	}
	if item.ExpiresAt != nil && time.Now().After(*item.ExpiresAt) {
		_, _ = s.db.ExecContext(ctx, `UPDATE file_shares SET status='expired' WHERE slug=? AND status='active'`, slug)
		return PublicFileMetadata{}, ErrFileExpired
	}
	if status == "expired" {
		return PublicFileMetadata{}, ErrFileExpired
	}
	if status != "active" {
		return PublicFileMetadata{}, ErrFileNotFound
	}
	if scanStatus != "clean" {
		return PublicFileMetadata{}, ErrFileSafetyReview
	}
	if item.MaxDownloads != nil && item.Downloads >= *item.MaxDownloads {
		return PublicFileMetadata{}, ErrFileDownloadLimit
	}
	item.Protected = protected
	return item, nil
}

func (s *Service) OpenDownloadWithPassword(ctx context.Context, slug, password string) (Download, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Download{}, err
	}
	defer tx.Rollback()
	var item FileShare
	var passwordHash sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT id,slug,original_name,storage_name,mime_type,size_bytes,scan_status,status,expires_at,max_downloads,downloads,password_hash FROM file_shares WHERE slug=? AND deleted_at IS NULL FOR UPDATE`, slug).Scan(&item.ID, &item.Slug, &item.OriginalName, &item.StorageName, &item.MIMEType, &item.SizeBytes, &item.ScanStatus, &item.Status, &item.ExpiresAt, &item.MaxDownloads, &item.Downloads, &passwordHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Download{}, ErrFileNotFound
		}
		return Download{}, err
	}
	if item.Status == "expired" {
		return Download{}, ErrFileExpired
	}
	if item.Status != "active" {
		return Download{}, ErrFileNotFound
	}
	if item.ScanStatus != "clean" {
		return Download{}, ErrFileSafetyReview
	}
	if item.ExpiresAt != nil && time.Now().After(*item.ExpiresAt) {
		_, _ = tx.ExecContext(ctx, `UPDATE file_shares SET status='expired' WHERE id=?`, item.ID)
		_ = tx.Commit()
		return Download{}, ErrFileExpired
	}
	if item.MaxDownloads != nil && item.Downloads >= *item.MaxDownloads {
		return Download{}, ErrFileDownloadLimit
	}
	if passwordHash.Valid && bcrypt.CompareHashAndPassword([]byte(passwordHash.String), []byte(password)) != nil {
		return Download{}, ErrFilePassword
	}
	file, err := s.files.Open(ctx, "clean/"+filepath.Base(item.StorageName))
	if err != nil {
		return Download{}, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE file_shares SET downloads=downloads+1 WHERE id=?`, item.ID); err != nil {
		file.Close()
		return Download{}, err
	}
	if err = tx.Commit(); err != nil {
		file.Close()
		return Download{}, err
	}
	item.Downloads++
	return Download{File: file, FileShare: item}, nil
}
