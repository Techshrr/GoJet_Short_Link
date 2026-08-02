package links

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"net/url"
	"strings"
	"time"
)

type Service struct {
	db         *sql.DB
	redis      *redis.Client
	workspaces *workspace.Service
}
type Link struct {
	ID, WorkspaceID, CreatedBy               int64 `json:",omitempty"`
	Code, Domain, Destination, Title, Status string
	RedirectStatus                           int
	Password                                 string          `json:"password,omitempty"`
	PasswordHash                             string          `json:"-"`
	ExpiresAt                                *string         `json:"expires_at,omitempty"`
	MaxClicks                                *int64          `json:"max_clicks,omitempty"`
	OneTime                                  bool            `json:"one_time"`
	FolderID, CampaignID                     *int64          `json:",omitempty"`
	UTM, RoutingRules, ABDestinations        json.RawMessage `json:",omitempty"`
	CreatedAt                                string          `json:"created_at,omitempty"`
	Clicks, Visitors                         int64           `json:",omitempty"`
}
type Filter struct {
	Search, Status string
	Limit, Offset  int
}
type Dimension struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}
type Analytics struct {
	Clicks, UniqueVisitors, BotVisits                                                                             int64 `json:",omitempty"`
	Sources, Countries, Regions, Cities, Devices, Browsers, OperatingSystems, Languages, UTMSources, Destinations []Dimension
	Recent                                                                                                        []map[string]any
}

func New(db *sql.DB, r *redis.Client, w *workspace.Service) *Service {
	return &Service{db: db, redis: r, workspaces: w}
}
func (s *Service) Create(ctx context.Context, userID, workspaceID int64, l Link) (Link, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return Link{}, errors.New("forbidden")
	}
	u, err := url.ParseRequestURI(l.Destination)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return Link{}, errors.New("目标地址必须是完整的 HTTP(S) URL")
	}
	if l.Code == "" {
		l.Code = randomCode(7)
	}
	if len(l.Code) < 3 || len(l.Code) > 64 || strings.ContainsAny(l.Code, " /?#") {
		return Link{}, errors.New("短码格式无效")
	}
	if l.RedirectStatus == 0 {
		l.RedirectStatus = 302
	}
	if l.RedirectStatus != 301 && l.RedirectStatus != 302 && l.RedirectStatus != 307 && l.RedirectStatus != 308 {
		return Link{}, errors.New("跳转状态码无效")
	}
	if l.ExpiresAt != nil && *l.ExpiresAt != "" {
		parsed, parseErr := time.Parse(time.RFC3339, *l.ExpiresAt)
		if parseErr != nil {
			parsed, parseErr = time.Parse("2006-01-02T15:04", *l.ExpiresAt)
		}
		if parseErr != nil {
			return Link{}, errors.New("有效期格式无效")
		}
		normalized := parsed.UTC().Format(time.RFC3339)
		l.ExpiresAt = &normalized
	}
	l.Status = "active"
	if l.Password != "" {
		if len(l.Password) < 6 {
			return Link{}, errors.New("访问密码至少需要 6 位")
		}
		hash, hashErr := bcrypt.GenerateFromPassword([]byte(l.Password), 12)
		if hashErr != nil {
			return Link{}, hashErr
		}
		l.PasswordHash = string(hash)
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO short_links(workspace_id,created_by,code,domain,destination,title,status,redirect_status,password_hash,expires_at,max_clicks,one_time,folder_id,campaign_id,utm,routing_rules,ab_destinations) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, workspaceID, userID, l.Code, l.Domain, l.Destination, l.Title, l.Status, l.RedirectStatus, nullable(l.PasswordHash), l.ExpiresAt, l.MaxClicks, l.OneTime, l.FolderID, l.CampaignID, nullableJSON(l.UTM), nullableJSON(l.RoutingRules), nullableJSON(l.ABDestinations))
	if err != nil {
		return Link{}, err
	}
	l.ID, _ = result.LastInsertId()
	l.WorkspaceID = workspaceID
	l.CreatedBy = userID
	if err = s.syncRedis(ctx, l); err != nil {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM short_links WHERE id=?`, l.ID)
		return Link{}, fmt.Errorf("redirect plane unavailable: %w", err)
	}
	return l, nil
}
func (s *Service) syncRedis(ctx context.Context, l Link) error {
	payload, _ := json.Marshal(map[string]any{"id": fmt.Sprint(l.ID), "code": l.Code, "destination": l.Destination, "status_code": l.RedirectStatus, "active": l.Status == "active", "expires_at": l.ExpiresAt, "max_clicks": l.MaxClicks, "one_time": l.OneTime, "password_hash": l.PasswordHash})
	return s.redis.Set(ctx, "gojet:link:"+l.Code, payload, 0).Err()
}
func (s *Service) List(ctx context.Context, userID, workspaceID int64, f Filter) ([]Link, int64, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return nil, 0, errors.New("forbidden")
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 25
	}
	where := `workspace_id=?`
	args := []any{workspaceID}
	if f.Status != "" {
		where += ` AND status=?`
		args = append(args, f.Status)
	}
	if f.Search != "" {
		where += ` AND (code LIKE ? OR title LIKE ? OR destination LIKE ?)`
		q := "%" + f.Search + "%"
		args = append(args, q, q, q)
	}
	var total int64
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM short_links WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, f.Limit, f.Offset)
	rows, err := s.db.QueryContext(ctx, `SELECT id,workspace_id,created_by,code,domain,destination,title,status,redirect_status,one_time,created_at FROM short_links WHERE `+where+` ORDER BY created_at DESC LIMIT ? OFFSET ?`, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Link{}
	for rows.Next() {
		var l Link
		var created string
		if err = rows.Scan(&l.ID, &l.WorkspaceID, &l.CreatedBy, &l.Code, &l.Domain, &l.Destination, &l.Title, &l.Status, &l.RedirectStatus, &l.OneTime, &created); err != nil {
			return nil, 0, err
		}
		l.CreatedAt = created
		clicks, _ := s.redis.Get(ctx, "gojet:clicks:"+fmt.Sprint(l.ID)).Int64()
		visitors, _ := s.redis.PFCount(ctx, "gojet:visitors:"+fmt.Sprint(l.ID)).Result()
		l.Clicks = clicks
		l.Visitors = visitors
		out = append(out, l)
	}
	return out, total, rows.Err()
}
func (s *Service) BulkStatus(ctx context.Context, userID, workspaceID int64, ids []int64, status string) (int64, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return 0, errors.New("forbidden")
	}
	if status != "active" && status != "paused" {
		return 0, errors.New("invalid status")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	affected := int64(0)
	for _, id := range ids {
		result, err := tx.ExecContext(ctx, `UPDATE short_links SET status=? WHERE id=? AND workspace_id=?`, status, id, workspaceID)
		if err != nil {
			return 0, err
		}
		n, _ := result.RowsAffected()
		affected += n
	}
	if err = tx.Commit(); err != nil {
		return 0, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,code,destination,redirect_status,status,COALESCE(password_hash,''),expires_at,max_clicks,one_time FROM short_links WHERE workspace_id=?`, workspaceID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var l Link
			_ = rows.Scan(&l.ID, &l.Code, &l.Destination, &l.RedirectStatus, &l.Status, &l.PasswordHash, &l.ExpiresAt, &l.MaxClicks, &l.OneTime)
			_ = s.syncRedis(ctx, l)
		}
	}
	return affected, nil
}
func (s *Service) Analytics(ctx context.Context, userID, workspaceID, linkID int64, from, to string) (Analytics, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "analytics") {
		return Analytics{}, errors.New("forbidden")
	}
	var exists int
	if err = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM short_links WHERE id=? AND workspace_id=?`, linkID, workspaceID).Scan(&exists); err != nil || exists == 0 {
		return Analytics{}, sql.ErrNoRows
	}
	base := `link_id=? AND occurred_at>=? AND occurred_at<?`
	args := []any{fmt.Sprint(linkID), from, to}
	var out Analytics
	if err = s.db.QueryRowContext(ctx, `SELECT COUNT(*),COUNT(DISTINCT IF(is_bot=0,visitor_hash,NULL)),SUM(is_bot) FROM analytics_events WHERE `+base, args...).Scan(&out.Clicks, &out.UniqueVisitors, &out.BotVisits); err != nil {
		return out, err
	}
	dimension := func(column string) ([]Dimension, error) {
		rows, e := s.db.QueryContext(ctx, `SELECT COALESCE(NULLIF(`+column+`,''),'Unknown'),COUNT(*) FROM analytics_events WHERE `+base+` GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, args...)
		if e != nil {
			return nil, e
		}
		defer rows.Close()
		items := []Dimension{}
		for rows.Next() {
			var d Dimension
			if e = rows.Scan(&d.Name, &d.Count); e != nil {
				return nil, e
			}
			items = append(items, d)
		}
		return items, rows.Err()
	}
	for column, target := range map[string]*[]Dimension{"source_type": &out.Sources, "country": &out.Countries, "region": &out.Regions, "city": &out.Cities, "device": &out.Devices, "browser": &out.Browsers, "operating_system": &out.OperatingSystems, "language": &out.Languages, "utm_source": &out.UTMSources, "destination_id": &out.Destinations} {
		items, e := dimension(column)
		if e != nil {
			return out, e
		}
		*target = items
	}
	rows, err := s.db.QueryContext(ctx, `SELECT occurred_at,source_type,COALESCE(country,''),device,browser,operating_system,is_bot FROM analytics_events WHERE `+base+` ORDER BY occurred_at DESC LIMIT 100`, args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	out.Recent = []map[string]any{}
	for rows.Next() {
		var at, source, country, device, browser, os string
		var bot bool
		if rows.Scan(&at, &source, &country, &device, &browser, &os, &bot) != nil {
			continue
		}
		out.Recent = append(out.Recent, map[string]any{"timestamp": at, "source": source, "country": country, "device": device, "browser": browser, "operating_system": os, "is_bot": bot})
	}
	return out, rows.Err()
}
func nullableJSON(v json.RawMessage) any {
	if len(v) == 0 {
		return nil
	}
	return v
}
func nullable(value string) any {
	if value == "" {
		return nil
	}
	return value
}

const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func randomCode(n int) string {
	b := make([]byte, n)
	raw := make([]byte, n)
	_, _ = rand.Read(raw)
	for i := range b {
		b[i] = alphabet[int(raw[i])%len(alphabet)]
	}
	return string(b)
}
