package resources

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image/color"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/billing"
	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
	"github.com/skip2/go-qrcode"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db         *sql.DB
	workspaces *workspace.Service
	uploadPath string
	filePath   string
	publicURL  string
	qrKey      string
	billing    *billing.Service
}

func (s *Service) WithBilling(quotas *billing.Service) *Service {
	s.billing = quotas
	return s
}

func New(db *sql.DB, w *workspace.Service, uploadPath, filePath, publicURL string, qrKey ...string) *Service {
	key := ""
	if len(qrKey) > 0 {
		key = qrKey[0]
	}
	return &Service{db: db, workspaces: w, uploadPath: uploadPath, filePath: filePath, publicURL: strings.TrimRight(publicURL, "/"), qrKey: key}
}

func NewFileWorker(db *sql.DB, path string) *Service {
	return &Service{db: db, filePath: path}
}

type TextShare struct {
	ID        int64      `json:"id"`
	Slug      string     `json:"slug"`
	Title     string     `json:"title"`
	Content   string     `json:"content,omitempty"`
	Format    string     `json:"format"`
	Status    string     `json:"status"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	OneTime   bool       `json:"one_time"`
	Protected bool       `json:"protected"`
	Views     int64      `json:"views"`
	CreatedAt string     `json:"created_at,omitempty"`
}
type BioPage struct {
	ID        int64           `json:"id"`
	Slug      string          `json:"slug"`
	Title     string          `json:"title"`
	Bio       string          `json:"bio"`
	Status    string          `json:"status"`
	Theme     json.RawMessage `json:"theme"`
	Blocks    json.RawMessage `json:"blocks"`
	Views     int64           `json:"views"`
	CreatedAt string          `json:"created_at,omitempty"`
}
type QRCode struct {
	ID         int64  `json:"id"`
	LinkID     int64  `json:"link_id"`
	Name       string `json:"name"`
	ImageURL   string `json:"image_url"`
	Foreground string `json:"foreground"`
	Background string `json:"background"`
	Size       int    `json:"size"`
	Code       string `json:"code,omitempty"`
	Domain     string `json:"domain,omitempty"`
	QRVisits   int64  `json:"qr_visits"`
	CreatedAt  string `json:"created_at,omitempty"`
}

func (s *Service) canEdit(ctx context.Context, user, wid int64) error {
	role, err := s.workspaces.Role(ctx, wid, user)
	if err != nil || !workspace.Allowed(role, "edit") {
		return errors.New("forbidden")
	}
	return nil
}
func (s *Service) CreateText(ctx context.Context, user, wid int64, item TextShare, password string) (TextShare, error) {
	if err := s.canEdit(ctx, user, wid); err != nil {
		return item, err
	}
	if s.billing != nil {
		if err := s.billing.Check(ctx, wid, "texts", 1); err != nil {
			return item, err
		}
	}
	item.Slug = cleanSlug(item.Slug)
	if item.Slug == "" {
		item.Slug = randomSlug()
	}
	if len(item.Title) < 1 || len(item.Content) < 1 || len(item.Content) > 1_000_000 {
		return item, errors.New("标题和不超过 1MB 的正文为必填项")
	}
	if item.Format != "plain" && item.Format != "markdown" && item.Format != "code" {
		return item, errors.New("文本格式无效")
	}
	if err := normalizeExpiry(item.ExpiresAt); err != nil {
		return item, err
	}
	var hash any
	if password != "" {
		if len(password) < 6 {
			return item, errors.New("密码至少 6 位")
		}
		value, err := bcrypt.GenerateFromPassword([]byte(password), 12)
		if err != nil {
			return item, err
		}
		hash = string(value)
	}
	item.Status = "active"
	result, err := s.db.ExecContext(ctx, `INSERT INTO text_shares(workspace_id,created_by,slug,title,content,format,password_hash,expires_at,one_time) VALUES(?,?,?,?,?,?,?,?,?)`, wid, user, item.Slug, item.Title, item.Content, item.Format, hash, item.ExpiresAt, item.OneTime)
	if err != nil {
		return item, err
	}
	item.ID, _ = result.LastInsertId()
	s.auditResource(ctx, user, wid, "text.created", "text_share", item.ID)
	return item, nil
}
func (s *Service) ReadText(ctx context.Context, slug, password string) (TextShare, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return TextShare{}, err
	}
	defer tx.Rollback()
	var item TextShare
	var hash sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT id,slug,title,content,format,status,expires_at,one_time,views,password_hash FROM text_shares WHERE slug=? AND deleted_at IS NULL FOR UPDATE`, slug).Scan(&item.ID, &item.Slug, &item.Title, &item.Content, &item.Format, &item.Status, &item.ExpiresAt, &item.OneTime, &item.Views, &hash)
	if err != nil {
		return item, err
	}
	if item.Status != "active" {
		return item, errors.New("share unavailable")
	}
	if item.ExpiresAt != nil {
		if time.Now().After(*item.ExpiresAt) {
			_, _ = tx.ExecContext(ctx, `UPDATE text_shares SET status='expired' WHERE id=?`, item.ID)
			_ = tx.Commit()
			return item, errors.New("share expired")
		}
	}
	if hash.Valid && bcrypt.CompareHashAndPassword([]byte(hash.String), []byte(password)) != nil {
		return item, errors.New("password required")
	}
	nextStatus := "active"
	if item.OneTime {
		nextStatus = "consumed"
	}
	if _, err = tx.ExecContext(ctx, `UPDATE text_shares SET views=views+1,status=? WHERE id=?`, nextStatus, item.ID); err != nil {
		return item, err
	}
	item.Views++
	return item, tx.Commit()
}
func (s *Service) CreateBio(ctx context.Context, user, wid int64, item BioPage) (BioPage, error) {
	if err := s.canEdit(ctx, user, wid); err != nil {
		return item, err
	}
	if s.billing != nil {
		if err := s.billing.Check(ctx, wid, "bios", 1); err != nil {
			return item, err
		}
	}
	item.Slug = cleanSlug(item.Slug)
	if item.Slug == "" {
		item.Slug = randomSlug()
	}
	if err := validateBio(item); err != nil {
		return item, err
	}
	if item.Status != "draft" && item.Status != "published" {
		item.Status = "draft"
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO bio_pages(workspace_id,created_by,slug,title,bio,theme,blocks,status) VALUES(?,?,?,?,?,?,?,?)`, wid, user, item.Slug, item.Title, item.Bio, item.Theme, item.Blocks, item.Status)
	if err != nil {
		return item, err
	}
	item.ID, _ = result.LastInsertId()
	s.auditResource(ctx, user, wid, "bio.created", "bio_page", item.ID)
	return item, nil
}
func (s *Service) ReadBio(ctx context.Context, slug string) (BioPage, error) {
	var item BioPage
	err := s.db.QueryRowContext(ctx, `SELECT id,slug,title,COALESCE(bio,''),theme,blocks,status,views FROM bio_pages WHERE slug=? AND status='published' AND deleted_at IS NULL`, slug).Scan(&item.ID, &item.Slug, &item.Title, &item.Bio, &item.Theme, &item.Blocks, &item.Status, &item.Views)
	if err != nil {
		return item, err
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE bio_pages SET views=views+1 WHERE id=?`, item.ID)
	item.Views++
	return item, nil
}
func (s *Service) CreateQR(ctx context.Context, user, wid, linkID int64, name, foreground, background string, size int) (QRCode, error) {
	if err := s.canEdit(ctx, user, wid); err != nil {
		return QRCode{}, err
	}
	if s.billing != nil {
		if err := s.billing.Check(ctx, wid, "qr", 1); err != nil {
			return QRCode{}, err
		}
	}
	if size < 256 || size > 2048 {
		size = 1024
	}
	if name == "" {
		return QRCode{}, errors.New("二维码名称必填")
	}
	if foreground == "" {
		foreground = "#10233f"
	}
	if background == "" {
		background = "#ffffff"
	}
	fg, err := parseHex(foreground)
	if err != nil {
		return QRCode{}, err
	}
	bg, err := parseHex(background)
	if err != nil {
		return QRCode{}, err
	}
	var code, domain string
	if err = s.db.QueryRowContext(ctx, `SELECT code,domain FROM short_links WHERE id=? AND workspace_id=? AND deleted_at IS NULL AND status='active'`, linkID, wid).Scan(&code, &domain); err != nil {
		return QRCode{}, err
	}
	target := s.publicURL + "/" + code
	if domain != "" {
		target = "https://" + domain + "/" + code
	}
	if len(s.qrKey) < 32 {
		return QRCode{}, errors.New("二维码追踪密钥未安全配置")
	}
	parsedTarget, parseErr := url.Parse(target)
	if parseErr == nil {
		query := parsedTarget.Query()
		mac := hmac.New(sha256.New, []byte(s.qrKey))
		_, _ = mac.Write([]byte(fmt.Sprintf("%d|%s|%s", linkID, domain, code)))
		query.Set("_gojet_qr", hex.EncodeToString(mac.Sum(nil)))
		parsedTarget.RawQuery = query.Encode()
		target = parsedTarget.String()
	}
	if parsed, parseErr := url.ParseRequestURI(target); parseErr != nil || parsed.Host == "" || parsed.Scheme == "" {
		return QRCode{}, errors.New("公开访问地址配置无效")
	}
	if err = os.MkdirAll(s.uploadPath, 0755); err != nil {
		return QRCode{}, err
	}
	filename := "qr-" + randomSlug() + ".png"
	path := filepath.Join(s.uploadPath, filename)
	qr, err := qrcode.New(target, qrcode.Medium)
	if err != nil {
		return QRCode{}, err
	}
	qr.ForegroundColor = fg
	qr.BackgroundColor = bg
	if err = qr.WriteFile(size, path); err != nil {
		return QRCode{}, err
	}
	url := "/uploads/" + filename
	result, err := s.db.ExecContext(ctx, `INSERT INTO qr_codes(workspace_id,created_by,link_id,name,image_url,foreground,background,size) VALUES(?,?,?,?,?,?,?,?)`, wid, user, linkID, name, url, foreground, background, size)
	if err != nil {
		_ = os.Remove(path)
		return QRCode{}, err
	}
	id, _ := result.LastInsertId()
	s.auditResource(ctx, user, wid, "qr.created", "qr_code", id)
	return QRCode{ID: id, LinkID: linkID, Name: name, ImageURL: url, Foreground: foreground, Background: background, Size: size}, nil
}
func cleanSlug(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	v = regexp.MustCompile(`[^a-z0-9_-]`).ReplaceAllString(v, "")
	if len(v) > 64 {
		v = v[:64]
	}
	return v
}
func randomSlug() string {
	raw := make([]byte, 8)
	_, _ = rand.Read(raw)
	return hex.EncodeToString(raw)
}
func parseHex(v string) (color.Color, error) {
	if v == "" {
		v = "#10233f"
	}
	var r, g, b uint8
	if _, err := fmt.Sscanf(v, "#%02x%02x%02x", &r, &g, &b); err != nil {
		return nil, errors.New("颜色必须为 #RRGGBB")
	}
	return color.RGBA{R: r, G: g, B: b, A: 255}, nil
}
