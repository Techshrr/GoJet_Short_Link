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

var ErrFilePassword = errors.New("file password required or invalid")

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
	err := s.db.QueryRowContext(ctx, `SELECT slug,original_name,mime_type,size_bytes,expires_at,max_downloads,downloads,(password_hash IS NOT NULL) FROM file_shares WHERE slug=? AND deleted_at IS NULL AND scan_status='clean' AND status='active'`, slug).Scan(&item.Slug, &item.OriginalName, &item.MIMEType, &item.SizeBytes, &item.ExpiresAt, &item.MaxDownloads, &item.Downloads, &protected)
	if err != nil {
		return item, err
	}
	if item.ExpiresAt != nil && time.Now().After(*item.ExpiresAt) {
		_, _ = s.db.ExecContext(ctx, `UPDATE file_shares SET status='expired' WHERE slug=? AND status='active'`, slug)
		return PublicFileMetadata{}, errors.New("file expired")
	}
	if item.MaxDownloads != nil && item.Downloads >= *item.MaxDownloads {
		return PublicFileMetadata{}, errors.New("download limit reached")
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
		return Download{}, err
	}
	if item.ScanStatus != "clean" || item.Status != "active" {
		return Download{}, errors.New("file unavailable")
	}
	if item.ExpiresAt != nil && time.Now().After(*item.ExpiresAt) {
		_, _ = tx.ExecContext(ctx, `UPDATE file_shares SET status='expired' WHERE id=?`, item.ID)
		_ = tx.Commit()
		return Download{}, errors.New("file expired")
	}
	if item.MaxDownloads != nil && item.Downloads >= *item.MaxDownloads {
		return Download{}, errors.New("download limit reached")
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
