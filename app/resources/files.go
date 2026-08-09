package resources

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const MaxFileSize int64 = 100 << 20

type FileShare struct {
	ID           int64      `json:"id"`
	WorkspaceID  int64      `json:"workspace_id,omitempty"`
	Slug         string     `json:"slug"`
	OriginalName string     `json:"original_name"`
	StorageName  string     `json:"-"`
	MIMEType     string     `json:"mime_type"`
	SizeBytes    int64      `json:"size_bytes"`
	ScanStatus   string     `json:"scan_status"`
	ScanResult   string     `json:"scan_result,omitempty"`
	Status       string     `json:"status"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	MaxDownloads *int64     `json:"max_downloads,omitempty"`
	Downloads    int64      `json:"downloads"`
}

type Download struct {
	File io.ReadCloser
	FileShare
}

func (s *Service) ListFiles(ctx context.Context, user, workspaceID int64) ([]FileShare, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, user); err != nil {
		return nil, errors.New("forbidden")
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,workspace_id,slug,original_name,mime_type,size_bytes,scan_status,COALESCE(scan_result,''),status,expires_at,max_downloads,downloads FROM file_shares WHERE workspace_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []FileShare{}
	for rows.Next() {
		var item FileShare
		if err = rows.Scan(&item.ID, &item.WorkspaceID, &item.Slug, &item.OriginalName, &item.MIMEType, &item.SizeBytes, &item.ScanStatus, &item.ScanResult, &item.Status, &item.ExpiresAt, &item.MaxDownloads, &item.Downloads); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateFile(ctx context.Context, user, workspaceID int64, originalName, mime string, source io.Reader, expiresAt *time.Time, maxDownloads *int64) (FileShare, error) {
	if err := s.canEdit(ctx, user, workspaceID); err != nil {
		return FileShare{}, err
	}
	name := filepath.Base(strings.TrimSpace(originalName))
	if name == "." || name == "" || len(name) > 255 {
		return FileShare{}, errors.New("文件名无效")
	}
	if expiresAt != nil && !expiresAt.After(time.Now()) {
		return FileShare{}, errors.New("有效期必须晚于当前时间")
	}
	if maxDownloads != nil && *maxDownloads < 1 {
		return FileShare{}, errors.New("最大下载次数必须大于零")
	}
	storageDir := filepath.Join(os.TempDir(), "gojet-upload")
	if err := os.MkdirAll(storageDir, 0700); err != nil {
		return FileShare{}, err
	}
	storageName := "file-" + randomSlug()
	buffered := bufio.NewReader(source)
	signature, _ := buffered.Peek(512)
	mime = http.DetectContentType(signature)
	temporary, err := os.CreateTemp(storageDir, ".upload-*")
	if err != nil {
		return FileShare{}, err
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	written, copyErr := io.Copy(temporary, io.LimitReader(buffered, MaxFileSize+1))
	closeErr := temporary.Close()
	if copyErr != nil || closeErr != nil {
		return FileShare{}, errors.Join(copyErr, closeErr)
	}
	if written == 0 || written > MaxFileSize {
		return FileShare{}, errors.New("文件必须大于零且不超过 100MB")
	}
	if s.billing != nil {
		if err = s.billing.Check(ctx, workspaceID, "files", written); err != nil {
			return FileShare{}, err
		}
	}
	file, err := os.Open(temporaryName)
	if err != nil {
		return FileShare{}, err
	}
	if err = s.files.Put(ctx, "quarantine/"+storageName, file, written, mime); err != nil {
		file.Close()
		return FileShare{}, err
	}
	_ = file.Close()
	item := FileShare{WorkspaceID: workspaceID, Slug: randomSlug(), OriginalName: name, StorageName: storageName, MIMEType: mime, SizeBytes: written, ScanStatus: "pending", Status: "quarantined", ExpiresAt: expiresAt, MaxDownloads: maxDownloads}
	result, err := s.db.ExecContext(ctx, `INSERT INTO file_shares(workspace_id,created_by,slug,original_name,storage_name,mime_type,size_bytes,expires_at,max_downloads) VALUES(?,?,?,?,?,?,?,?,?)`, workspaceID, user, item.Slug, name, storageName, mime, written, expiresAt, maxDownloads)
	if err != nil {
		_ = s.files.Delete(ctx, "quarantine/"+storageName)
		return FileShare{}, err
	}
	item.ID, _ = result.LastInsertId()
	return item, nil
}

func (s *Service) ClaimFileScan(ctx context.Context) (FileShare, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FileShare{}, false, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE file_shares SET scan_status='pending',scan_result='scanner lease expired; automatically requeued' WHERE scan_status='scanning' AND next_scan_at<=NOW()`); err != nil {
		return FileShare{}, false, err
	}
	var item FileShare
	err = tx.QueryRowContext(ctx, `SELECT id,workspace_id,slug,original_name,storage_name,mime_type,size_bytes,scan_status,status FROM file_shares WHERE scan_status='pending' AND deleted_at IS NULL AND next_scan_at<=NOW() ORDER BY next_scan_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`).Scan(&item.ID, &item.WorkspaceID, &item.Slug, &item.OriginalName, &item.StorageName, &item.MIMEType, &item.SizeBytes, &item.ScanStatus, &item.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return FileShare{}, false, tx.Commit()
	}
	if err != nil {
		return FileShare{}, false, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE file_shares SET scan_status='scanning',scan_attempts=scan_attempts+1,next_scan_at=DATE_ADD(NOW(),INTERVAL 10 MINUTE) WHERE id=?`, item.ID); err != nil {
		return FileShare{}, false, err
	}
	item.ScanStatus = "scanning"
	return item, true, tx.Commit()
}

func (s *Service) ScanPath(item FileShare) string {
	return filepath.Join(s.filePath, "quarantine", filepath.Base(item.StorageName))
}

func (s *Service) MaterializeForScan(ctx context.Context, item FileShare) (string, func(), error) {
	return s.files.Materialize(ctx, "quarantine/"+filepath.Base(item.StorageName))
}

func (s *Service) FinishFileScan(ctx context.Context, id int64, clean bool, result string, scanErr error) error {
	if scanErr != nil {
		_, err := s.db.ExecContext(ctx, `UPDATE file_shares SET scan_status=IF(scan_attempts>=5,'error','pending'),scan_result=?,next_scan_at=DATE_ADD(NOW(),INTERVAL LEAST(300,POW(2,scan_attempts)) SECOND),last_scanned_at=NOW() WHERE id=? AND scan_status='scanning'`, truncate(scanErr.Error(), 2000), id)
		return err
	}
	status, scanStatus := "quarantined", "infected"
	movedName := ""
	if clean {
		status, scanStatus = "active", "clean"
		var storageName string
		if err := s.db.QueryRowContext(ctx, `SELECT storage_name FROM file_shares WHERE id=? AND scan_status='scanning'`, id).Scan(&storageName); err != nil {
			return err
		}
		movedName = filepath.Base(storageName)
		if err := s.files.Move(ctx, "quarantine/"+movedName, "clean/"+movedName); err != nil {
			return err
		}
	}
	_, err := s.db.ExecContext(ctx, `UPDATE file_shares SET scan_status=?,scan_result=?,status=?,last_scanned_at=NOW() WHERE id=? AND scan_status='scanning'`, scanStatus, truncate(result, 2000), status, id)
	if err != nil && movedName != "" {
		_ = s.files.Move(ctx, "clean/"+movedName, "quarantine/"+movedName)
	}
	return err
}

func (s *Service) OpenDownload(ctx context.Context, slug string) (Download, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Download{}, err
	}
	defer tx.Rollback()
	var item FileShare
	err = tx.QueryRowContext(ctx, `SELECT id,slug,original_name,storage_name,mime_type,size_bytes,scan_status,status,expires_at,max_downloads,downloads FROM file_shares WHERE slug=? AND deleted_at IS NULL FOR UPDATE`, slug).Scan(&item.ID, &item.Slug, &item.OriginalName, &item.StorageName, &item.MIMEType, &item.SizeBytes, &item.ScanStatus, &item.Status, &item.ExpiresAt, &item.MaxDownloads, &item.Downloads)
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

// DeleteFile immediately removes a file from public access while retaining its
// object in an isolated tombstone prefix until the configured recovery window
// expires. Moving the object before committing the row prevents a deleted file
// from remaining downloadable if the database operation fails.
func (s *Service) DeleteFile(ctx context.Context, user, workspaceID, id int64, retention time.Duration) error {
	if err := s.canEdit(ctx, user, workspaceID); err != nil {
		return err
	}
	if retention < 0 {
		return errors.New("retention must not be negative")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var storageName, scanStatus string
	if err = tx.QueryRowContext(ctx, `SELECT storage_name,scan_status FROM file_shares WHERE id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE`, id, workspaceID).Scan(&storageName, &scanStatus); err != nil {
		return err
	}
	storageName = filepath.Base(storageName)
	sourcePrefix := "quarantine/"
	if scanStatus == "clean" {
		sourcePrefix = "clean/"
	}
	tombstone := fmt.Sprintf("deleted/%d-%s", id, storageName)
	if err = s.files.Move(ctx, sourcePrefix+storageName, tombstone); err != nil {
		return err
	}
	purgeAt := time.Now().Add(retention)
	result, err := tx.ExecContext(ctx, `UPDATE file_shares SET status='deleted',deleted_at=NOW(),purge_after=?,deleted_object_key=? WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, purgeAt, tombstone, id, workspaceID)
	if err == nil {
		err = requireChanged(result)
	}
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		_ = s.files.Move(ctx, tombstone, sourcePrefix+storageName)
		return err
	}
	s.auditResource(ctx, user, workspaceID, "file.deleted", "file_share", id)
	return nil
}

// PurgeDeletedFiles permanently removes expired tombstones. Object deletion is
// deliberately performed first and is idempotent, so a database failure is
// safe to retry on the next worker pass.
func (s *Service) PurgeDeletedFiles(ctx context.Context, limit int) (int, error) {
	if limit < 1 || limit > 1000 {
		limit = 100
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,deleted_object_key FROM file_shares WHERE status='deleted' AND purge_after<=NOW() ORDER BY purge_after,id LIMIT ?`, limit)
	if err != nil {
		return 0, err
	}
	type expired struct {
		id  int64
		key string
	}
	var items []expired
	for rows.Next() {
		var item expired
		if err = rows.Scan(&item.id, &item.key); err != nil {
			rows.Close()
			return 0, err
		}
		items = append(items, item)
	}
	err = rows.Close()
	if err != nil {
		return 0, err
	}
	purged := 0
	for _, item := range items {
		if item.key == "" {
			continue
		}
		if err = s.files.Delete(ctx, item.key); err != nil {
			return purged, err
		}
		result, deleteErr := s.db.ExecContext(ctx, `DELETE FROM file_shares WHERE id=? AND status='deleted' AND purge_after<=NOW()`, item.id)
		if deleteErr != nil {
			return purged, deleteErr
		}
		changed, _ := result.RowsAffected()
		purged += int(changed)
	}
	return purged, nil
}

func ScanClamAV(ctx context.Context, address, path string) (bool, string, error) {
	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return false, "", fmt.Errorf("clamd connection: %w", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(2 * time.Minute))
	file, err := os.Open(path)
	if err != nil {
		return false, "", err
	}
	defer file.Close()
	if _, err = conn.Write([]byte("zINSTREAM\x00")); err != nil {
		return false, "", err
	}
	buffer := make([]byte, 32*1024)
	for {
		n, readErr := file.Read(buffer)
		if n > 0 {
			var size [4]byte
			binary.BigEndian.PutUint32(size[:], uint32(n))
			if _, err = conn.Write(size[:]); err == nil {
				_, err = conn.Write(buffer[:n])
			}
			if err != nil {
				return false, "", err
			}
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return false, "", readErr
		}
	}
	if _, err = conn.Write([]byte{0, 0, 0, 0}); err != nil {
		return false, "", err
	}
	response, err := bufio.NewReader(conn).ReadString(0)
	response = strings.TrimSpace(strings.TrimSuffix(response, "\x00"))
	if err != nil && !errors.Is(err, io.EOF) {
		return false, response, err
	}
	if strings.HasSuffix(response, " OK") {
		return true, response, nil
	}
	if strings.Contains(response, " FOUND") {
		return false, response, nil
	}
	return false, response, errors.New("clamd returned an unknown response")
}

func truncate(value string, max int) string {
	if len(value) > max {
		return value[:max]
	}
	return value
}
