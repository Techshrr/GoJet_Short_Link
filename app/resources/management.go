package resources

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func (s *Service) TextMetadata(ctx context.Context, slug string) (TextShare, error) {
	var item TextShare
	err := s.db.QueryRowContext(ctx, `SELECT id,slug,title,format,status,expires_at,one_time,views,password_hash IS NOT NULL FROM text_shares WHERE slug=? AND deleted_at IS NULL`, slug).Scan(&item.ID, &item.Slug, &item.Title, &item.Format, &item.Status, &item.ExpiresAt, &item.OneTime, &item.Views, &item.Protected)
	if err != nil {
		return item, err
	}
	if item.Status != "active" || (item.ExpiresAt != nil && time.Now().After(*item.ExpiresAt)) {
		return item, errors.New("share unavailable")
	}
	return item, nil
}

func (s *Service) ListTexts(ctx context.Context, userID, workspaceID int64) ([]TextShare, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return nil, errors.New("forbidden")
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,slug,title,format,status,expires_at,one_time,views,password_hash IS NOT NULL,created_at FROM text_shares WHERE workspace_id=? AND deleted_at IS NULL ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []TextShare{}
	for rows.Next() {
		var item TextShare
		if err = rows.Scan(&item.ID, &item.Slug, &item.Title, &item.Format, &item.Status, &item.ExpiresAt, &item.OneTime, &item.Views, &item.Protected, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) GetText(ctx context.Context, userID, workspaceID, id int64) (TextShare, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return TextShare{}, errors.New("forbidden")
	}
	var item TextShare
	err := s.db.QueryRowContext(ctx, `SELECT id,slug,title,content,format,status,expires_at,one_time,views,password_hash IS NOT NULL,created_at FROM text_shares WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, id, workspaceID).Scan(&item.ID, &item.Slug, &item.Title, &item.Content, &item.Format, &item.Status, &item.ExpiresAt, &item.OneTime, &item.Views, &item.Protected, &item.CreatedAt)
	return item, err
}

func (s *Service) UpdateText(ctx context.Context, userID, workspaceID, id int64, item TextShare, password *string) error {
	if err := s.canEdit(ctx, userID, workspaceID); err != nil {
		return err
	}
	if item.Title == "" || item.Content == "" || len(item.Content) > 1_000_000 || (item.Format != "plain" && item.Format != "markdown" && item.Format != "code") {
		return errors.New("文本标题、格式或正文无效")
	}
	if item.Status != "active" && item.Status != "paused" {
		return errors.New("文本状态无效")
	}
	if err := normalizeExpiry(item.ExpiresAt); err != nil {
		return err
	}
	query := `UPDATE text_shares SET title=?,content=?,format=?,status=?,expires_at=?,one_time=?`
	args := []any{item.Title, item.Content, item.Format, item.Status, item.ExpiresAt, item.OneTime}
	if password != nil {
		var hash any
		if *password != "" {
			if len(*password) < 6 {
				return errors.New("密码至少 6 位")
			}
			value, err := bcrypt.GenerateFromPassword([]byte(*password), 12)
			if err != nil {
				return err
			}
			hash = string(value)
		}
		query += `,password_hash=?`
		args = append(args, hash)
	}
	query += ` WHERE id=? AND workspace_id=? AND deleted_at IS NULL`
	args = append(args, id, workspaceID)
	result, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	if err = requireChanged(result); err == nil {
		s.auditResource(ctx, userID, workspaceID, "text.updated", "text_share", id)
	}
	return err
}

func (s *Service) DeleteText(ctx context.Context, userID, workspaceID, id int64) error {
	return s.softDelete(ctx, userID, workspaceID, "text_shares", id)
}

func (s *Service) ListBios(ctx context.Context, userID, workspaceID int64) ([]BioPage, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return nil, errors.New("forbidden")
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,slug,title,COALESCE(bio,''),theme,blocks,status,views,created_at FROM bio_pages WHERE workspace_id=? AND deleted_at IS NULL ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []BioPage{}
	for rows.Next() {
		var item BioPage
		if err = rows.Scan(&item.ID, &item.Slug, &item.Title, &item.Bio, &item.Theme, &item.Blocks, &item.Status, &item.Views, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) UpdateBio(ctx context.Context, userID, workspaceID, id int64, item BioPage) error {
	if err := s.canEdit(ctx, userID, workspaceID); err != nil {
		return err
	}
	if err := validateBio(item); err != nil {
		return err
	}
	if item.Status != "draft" && item.Status != "published" && item.Status != "paused" {
		return errors.New("主页状态无效")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE bio_pages SET title=?,bio=?,theme=?,blocks=?,status=? WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, item.Title, item.Bio, item.Theme, item.Blocks, item.Status, id, workspaceID)
	if err != nil {
		return err
	}
	if err = requireChanged(result); err == nil {
		s.auditResource(ctx, userID, workspaceID, "bio.updated", "bio_page", id)
	}
	return err
}

func (s *Service) DeleteBio(ctx context.Context, userID, workspaceID, id int64) error {
	return s.softDelete(ctx, userID, workspaceID, "bio_pages", id)
}

func (s *Service) ListQRs(ctx context.Context, userID, workspaceID int64) ([]QRCode, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return nil, errors.New("forbidden")
	}
	rows, err := s.db.QueryContext(ctx, `SELECT q.id,q.link_id,q.name,q.image_url,q.foreground,q.background,q.size,l.code,l.domain,COUNT(a.id),q.created_at FROM qr_codes q JOIN short_links l ON l.id=q.link_id LEFT JOIN analytics_events a ON a.link_id=CAST(q.link_id AS CHAR) AND a.visit_type='qr' WHERE q.workspace_id=? AND q.deleted_at IS NULL GROUP BY q.id ORDER BY q.created_at DESC`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []QRCode{}
	for rows.Next() {
		var item QRCode
		if err = rows.Scan(&item.ID, &item.LinkID, &item.Name, &item.ImageURL, &item.Foreground, &item.Background, &item.Size, &item.Code, &item.Domain, &item.QRVisits, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) DeleteQR(ctx context.Context, userID, workspaceID, id int64) error {
	if err := s.canEdit(ctx, userID, workspaceID); err != nil {
		return err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var imageURL string
	if err = tx.QueryRowContext(ctx, `SELECT image_url FROM qr_codes WHERE id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE`, id, workspaceID).Scan(&imageURL); err != nil {
		return err
	}
	var originalPath, deletingPath string
	if strings.HasPrefix(imageURL, "/uploads/qr-") {
		originalPath = filepath.Join(s.uploadPath, filepath.Base(imageURL))
		deletingPath = originalPath + ".deleting"
		if err = os.Rename(originalPath, deletingPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	result, err := tx.ExecContext(ctx, `UPDATE qr_codes SET deleted_at=NOW() WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, id, workspaceID)
	if err != nil {
		if deletingPath != "" {
			_ = os.Rename(deletingPath, originalPath)
		}
		return err
	}
	if err = requireChanged(result); err != nil {
		if deletingPath != "" {
			_ = os.Rename(deletingPath, originalPath)
		}
		return err
	}
	if err = tx.Commit(); err != nil {
		if deletingPath != "" {
			_ = os.Rename(deletingPath, originalPath)
		}
		return err
	}
	if deletingPath != "" {
		_ = os.Remove(deletingPath)
	}
	s.auditResource(ctx, userID, workspaceID, "qr.deleted", "qr_code", id)
	return nil
}

func (s *Service) softDelete(ctx context.Context, userID, workspaceID int64, table string, id int64) error {
	if err := s.canEdit(ctx, userID, workspaceID); err != nil {
		return err
	}
	if table != "text_shares" && table != "bio_pages" {
		return errors.New("invalid resource")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE `+table+` SET status='paused',deleted_at=NOW() WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, id, workspaceID)
	if err != nil {
		return err
	}
	if err = requireChanged(result); err != nil {
		return err
	}
	s.auditResource(ctx, userID, workspaceID, strings.TrimSuffix(table, "s")+".deleted", strings.TrimSuffix(table, "s"), id)
	return nil
}

func (s *Service) auditResource(ctx context.Context, userID, workspaceID int64, action, target string, id int64) {
	_, _ = s.db.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,workspace_id,action,target_type,target_id,metadata) VALUES(?,?,?,?,?,JSON_OBJECT())`, userID, workspaceID, action, target, id)
}

func requireChanged(result sql.Result) error {
	changed, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if changed != 1 {
		return sql.ErrNoRows
	}
	return nil
}

func normalizeExpiry(value *time.Time) error {
	if value != nil && value.Before(time.Now()) {
		return errors.New("有效期必须晚于当前时间")
	}
	return nil
}

func validateBio(item BioPage) error {
	if strings.TrimSpace(item.Title) == "" || len([]rune(item.Title)) > 120 || len([]rune(item.Bio)) > 2000 || !json.Valid(item.Theme) || !json.Valid(item.Blocks) {
		return errors.New("主页标题、简介、主题或模块无效")
	}
	var theme struct{ Primary, Background string }
	if json.Unmarshal(item.Theme, &theme) != nil || (theme.Primary != "" && !regexpColor(theme.Primary)) || (theme.Background != "" && !regexpColor(theme.Background)) {
		return errors.New("主页主题颜色必须为 #RRGGBB")
	}
	var blocks []struct{ Label, URL string }
	if json.Unmarshal(item.Blocks, &blocks) != nil || len(blocks) > 50 {
		return errors.New("主页链接模块无效或超过 50 个")
	}
	for _, block := range blocks {
		parsed, err := url.ParseRequestURI(block.URL)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || strings.TrimSpace(block.Label) == "" || len([]rune(block.Label)) > 120 {
			return errors.New("主页链接必须包含名称和完整 HTTP(S) 地址")
		}
	}
	return nil
}

func regexpColor(value string) bool {
	if len(value) != 7 || value[0] != '#' {
		return false
	}
	for _, char := range value[1:] {
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')) {
			return false
		}
	}
	return true
}
