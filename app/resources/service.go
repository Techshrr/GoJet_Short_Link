package resources

import (
	"context"
	"crypto/rand"
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
}

func New(db *sql.DB, w *workspace.Service, uploadPath, filePath, publicURL string) *Service {
	return &Service{db: db, workspaces: w, uploadPath: uploadPath, filePath: filePath, publicURL: strings.TrimRight(publicURL, "/")}
}

func NewFileWorker(db *sql.DB, path string) *Service {
	return &Service{db: db, filePath: path}
}

type TextShare struct {
	ID                                   int64 `json:"id"`
	Slug, Title, Content, Format, Status string
	ExpiresAt                            *time.Time `json:"expires_at"`
	OneTime                              bool       `json:"one_time"`
	Views                                int64      `json:"views"`
}
type BioPage struct {
	ID                       int64 `json:"id"`
	Slug, Title, Bio, Status string
	Theme, Blocks            json.RawMessage
	Views                    int64 `json:"views"`
}
type QRCode struct {
	ID, LinkID                             int64 `json:",omitempty"`
	Name, ImageURL, Foreground, Background string
	Size                                   int
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
	err = tx.QueryRowContext(ctx, `SELECT id,slug,title,content,format,status,expires_at,one_time,views,password_hash FROM text_shares WHERE slug=? FOR UPDATE`, slug).Scan(&item.ID, &item.Slug, &item.Title, &item.Content, &item.Format, &item.Status, &item.ExpiresAt, &item.OneTime, &item.Views, &hash)
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
	item.Slug = cleanSlug(item.Slug)
	if item.Slug == "" {
		item.Slug = randomSlug()
	}
	if !json.Valid(item.Theme) || !json.Valid(item.Blocks) || len(item.Title) < 1 {
		return item, errors.New("主页标题、主题和内容模块无效")
	}
	if item.Status != "draft" && item.Status != "published" {
		item.Status = "draft"
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO bio_pages(workspace_id,created_by,slug,title,bio,theme,blocks,status) VALUES(?,?,?,?,?,?,?,?)`, wid, user, item.Slug, item.Title, item.Bio, item.Theme, item.Blocks, item.Status)
	if err != nil {
		return item, err
	}
	item.ID, _ = result.LastInsertId()
	return item, nil
}
func (s *Service) ReadBio(ctx context.Context, slug string) (BioPage, error) {
	var item BioPage
	err := s.db.QueryRowContext(ctx, `SELECT id,slug,title,COALESCE(bio,''),theme,blocks,status,views FROM bio_pages WHERE slug=? AND status='published'`, slug).Scan(&item.ID, &item.Slug, &item.Title, &item.Bio, &item.Theme, &item.Blocks, &item.Status, &item.Views)
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
	if err = s.db.QueryRowContext(ctx, `SELECT code,domain FROM short_links WHERE id=? AND workspace_id=?`, linkID, wid).Scan(&code, &domain); err != nil {
		return QRCode{}, err
	}
	target := s.publicURL + "/" + code
	if domain != "" {
		target = "https://" + domain + "/" + code
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
