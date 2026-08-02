package links

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/Techshrr/GoJet_Short_Link/app/billing"
	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Service struct {
	db         *sql.DB
	redis      *redis.Client
	workspaces *workspace.Service
	billing    *billing.Service
}
type Link struct {
	ID, WorkspaceID, CreatedBy               int64 `json:",omitempty"`
	Code, Domain, Destination, Title, Status string
	RedirectStatus                           int
	Password                                 string          `json:"password,omitempty"`
	PasswordHash                             string          `json:"-"`
	ClearPassword                            bool            `json:"clear_password,omitempty"`
	ExpiresAt                                *string         `json:"expires_at,omitempty"`
	MaxClicks                                *int64          `json:"max_clicks,omitempty"`
	OneTime                                  bool            `json:"one_time"`
	FolderID                                 *int64          `json:"folder_id,omitempty"`
	CampaignID                               *int64          `json:"campaign_id,omitempty"`
	TagIDs                                   []int64         `json:"tag_ids,omitempty"`
	FolderName, CampaignName                 string          `json:",omitempty"`
	TagNames                                 []string        `json:",omitempty"`
	UTM                                      json.RawMessage `json:"utm,omitempty"`
	RoutingRules                             json.RawMessage `json:"routing_rules,omitempty"`
	ABDestinations                           json.RawMessage `json:"ab_destinations,omitempty"`
	CreatedAt                                string          `json:"created_at,omitempty"`
	Clicks, Visitors                         int64           `json:",omitempty"`
}
type Filter struct {
	Search, Status, Domain      string
	FolderID, CampaignID, TagID int64
	Limit, Offset               int
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
type Version struct {
	ID           int64           `json:"id"`
	LinkID       int64           `json:"link_id"`
	CreatedBy    int64           `json:"created_by"`
	Revision     int             `json:"revision"`
	Snapshot     json.RawMessage `json:"snapshot"`
	ChangeReason string          `json:"change_reason"`
	CreatedAt    string          `json:"created_at"`
}

func New(db *sql.DB, r *redis.Client, w *workspace.Service, quotas ...*billing.Service) *Service {
	s := &Service{db: db, redis: r, workspaces: w}
	if len(quotas) > 0 {
		s.billing = quotas[0]
	}
	return s
}
func (s *Service) Create(ctx context.Context, userID, workspaceID int64, l Link) (Link, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return Link{}, errors.New("forbidden")
	}
	if s.billing != nil {
		if err = s.billing.Check(ctx, workspaceID, "links", 1); err != nil {
			return Link{}, err
		}
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
	if l.Domain != "" {
		l.Domain = strings.ToLower(strings.TrimSuffix(l.Domain, "."))
		var count int
		if err = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM custom_domains WHERE workspace_id=? AND hostname=? AND status='active' AND https_status='active'`, workspaceID, l.Domain).Scan(&count); err != nil || count == 0 {
			return Link{}, errors.New("自定义域名尚未完成 DNS 与 HTTPS 验证")
		}
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
	if err = s.validateOrganization(ctx, workspaceID, l.FolderID, l.CampaignID, l.TagIDs); err != nil {
		return Link{}, err
	}
	if err = validateRouting(l.RoutingRules, l.ABDestinations, l.UTM); err != nil {
		return Link{}, err
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
		l.Password = ""
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO short_links(workspace_id,created_by,code,domain,destination,title,status,redirect_status,password_hash,expires_at,max_clicks,one_time,folder_id,campaign_id,utm,routing_rules,ab_destinations) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, workspaceID, userID, l.Code, l.Domain, l.Destination, l.Title, l.Status, l.RedirectStatus, nullable(l.PasswordHash), l.ExpiresAt, l.MaxClicks, l.OneTime, l.FolderID, l.CampaignID, nullableJSON(l.UTM), nullableJSON(l.RoutingRules), nullableJSON(l.ABDestinations))
	if err != nil {
		return Link{}, err
	}
	l.ID, _ = result.LastInsertId()
	for _, tagID := range uniqueIDs(l.TagIDs) {
		if _, err = s.db.ExecContext(ctx, `INSERT INTO link_tags(link_id,tag_id) VALUES(?,?)`, l.ID, tagID); err != nil {
			_, _ = s.db.ExecContext(ctx, `DELETE FROM short_links WHERE id=?`, l.ID)
			return Link{}, err
		}
	}
	l.WorkspaceID = workspaceID
	l.CreatedBy = userID
	if _, err = s.db.ExecContext(ctx, `INSERT INTO link_versions(link_id,revision,snapshot,change_reason,created_by) VALUES(?,1,?,'创建链接',?)`, l.ID, snapshot(l), userID); err != nil {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM short_links WHERE id=?`, l.ID)
		return Link{}, err
	}
	if err = s.syncRedis(ctx, l); err != nil {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM short_links WHERE id=?`, l.ID)
		return Link{}, fmt.Errorf("redirect plane unavailable: %w", err)
	}
	return l, nil
}

func (s *Service) Get(ctx context.Context, userID, workspaceID, id int64) (Link, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return Link{}, errors.New("forbidden")
	}
	var l Link
	err := s.db.QueryRowContext(ctx, `SELECT id,workspace_id,created_by,code,domain,destination,title,status,redirect_status,COALESCE(password_hash,''),expires_at,max_clicks,one_time,folder_id,campaign_id,COALESCE(utm,JSON_OBJECT()),COALESCE(routing_rules,JSON_ARRAY()),COALESCE(ab_destinations,JSON_ARRAY()),created_at FROM short_links WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, id, workspaceID).Scan(&l.ID, &l.WorkspaceID, &l.CreatedBy, &l.Code, &l.Domain, &l.Destination, &l.Title, &l.Status, &l.RedirectStatus, &l.PasswordHash, &l.ExpiresAt, &l.MaxClicks, &l.OneTime, &l.FolderID, &l.CampaignID, &l.UTM, &l.RoutingRules, &l.ABDestinations, &l.CreatedAt)
	if err != nil {
		return l, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT tag_id FROM link_tags WHERE link_id=? ORDER BY tag_id`, id)
	if err != nil {
		return l, err
	}
	defer rows.Close()
	for rows.Next() {
		var tag int64
		if rows.Scan(&tag) == nil {
			l.TagIDs = append(l.TagIDs, tag)
		}
	}
	l.Password = ""
	return l, rows.Err()
}

func (s *Service) Versions(ctx context.Context, userID, workspaceID, id int64) ([]Version, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return nil, errors.New("forbidden")
	}
	rows, err := s.db.QueryContext(ctx, `SELECT v.id,v.link_id,v.revision,v.snapshot,v.change_reason,v.created_by,v.created_at FROM link_versions v JOIN short_links l ON l.id=v.link_id WHERE v.link_id=? AND l.workspace_id=? ORDER BY v.revision DESC`, id, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Version{}
	for rows.Next() {
		var item Version
		if err = rows.Scan(&item.ID, &item.LinkID, &item.Revision, &item.Snapshot, &item.ChangeReason, &item.CreatedBy, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) Update(ctx context.Context, userID, workspaceID, id int64, next Link, reason string) (Link, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return Link{}, errors.New("forbidden")
	}
	if strings.TrimSpace(reason) == "" || len(reason) > 255 {
		return Link{}, errors.New("请填写不超过 255 字的变更原因")
	}
	if err = validateEditableLink(&next); err != nil {
		return Link{}, err
	}
	if err = s.validateOrganization(ctx, workspaceID, next.FolderID, next.CampaignID, next.TagIDs); err != nil {
		return Link{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Link{}, err
	}
	defer tx.Rollback()
	var current Link
	err = tx.QueryRowContext(ctx, `SELECT id,workspace_id,created_by,code,domain,destination,title,status,redirect_status,COALESCE(password_hash,''),expires_at,max_clicks,one_time,folder_id,campaign_id,COALESCE(utm,JSON_OBJECT()),COALESCE(routing_rules,JSON_ARRAY()),COALESCE(ab_destinations,JSON_ARRAY()) FROM short_links WHERE id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE`, id, workspaceID).Scan(&current.ID, &current.WorkspaceID, &current.CreatedBy, &current.Code, &current.Domain, &current.Destination, &current.Title, &current.Status, &current.RedirectStatus, &current.PasswordHash, &current.ExpiresAt, &current.MaxClicks, &current.OneTime, &current.FolderID, &current.CampaignID, &current.UTM, &current.RoutingRules, &current.ABDestinations)
	if err != nil {
		return Link{}, err
	}
	next.ID, next.WorkspaceID, next.CreatedBy, next.Code, next.Domain = id, workspaceID, current.CreatedBy, current.Code, current.Domain
	next.PasswordHash = current.PasswordHash
	if next.ClearPassword {
		next.PasswordHash = ""
	}
	if next.Password != "" {
		if len(next.Password) < 6 {
			return Link{}, errors.New("访问密码至少需要 6 位")
		}
		hash, e := bcrypt.GenerateFromPassword([]byte(next.Password), 12)
		if e != nil {
			return Link{}, e
		}
		next.PasswordHash = string(hash)
		next.Password = ""
	}
	if _, err = tx.ExecContext(ctx, `UPDATE short_links SET destination=?,title=?,status=?,redirect_status=?,password_hash=?,expires_at=?,max_clicks=?,one_time=?,folder_id=?,campaign_id=?,utm=?,routing_rules=?,ab_destinations=? WHERE id=?`, next.Destination, next.Title, next.Status, next.RedirectStatus, nullable(next.PasswordHash), next.ExpiresAt, next.MaxClicks, next.OneTime, next.FolderID, next.CampaignID, nullableJSON(next.UTM), nullableJSON(next.RoutingRules), nullableJSON(next.ABDestinations), id); err != nil {
		return Link{}, err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM link_tags WHERE link_id=?`, id); err != nil {
		return Link{}, err
	}
	for _, tagID := range uniqueIDs(next.TagIDs) {
		if _, err = tx.ExecContext(ctx, `INSERT INTO link_tags(link_id,tag_id) VALUES(?,?)`, id, tagID); err != nil {
			return Link{}, err
		}
	}
	var revision int
	if err = tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(revision),0)+1 FROM link_versions WHERE link_id=?`, id).Scan(&revision); err != nil {
		return Link{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO link_versions(link_id,revision,snapshot,change_reason,created_by) VALUES(?,?,?,?,?)`, id, revision, snapshot(next), reason, userID); err != nil {
		return Link{}, err
	}
	if err = s.syncRedis(ctx, next); err != nil {
		return Link{}, fmt.Errorf("redirect plane unavailable: %w", err)
	}
	if err = tx.Commit(); err != nil {
		_ = s.syncRedis(ctx, current)
		return Link{}, err
	}
	return next, nil
}

func (s *Service) Restore(ctx context.Context, userID, workspaceID, id int64, revision int, reason string) (Link, error) {
	if strings.TrimSpace(reason) == "" {
		return Link{}, errors.New("恢复版本前必须填写原因")
	}
	var raw json.RawMessage
	if err := s.db.QueryRowContext(ctx, `SELECT v.snapshot FROM link_versions v JOIN short_links l ON l.id=v.link_id WHERE v.link_id=? AND v.revision=? AND l.workspace_id=?`, id, revision, workspaceID).Scan(&raw); err != nil {
		return Link{}, err
	}
	var next Link
	if err := json.Unmarshal(raw, &next); err != nil {
		return Link{}, err
	}
	return s.Update(ctx, userID, workspaceID, id, next, "恢复版本 "+strconv.Itoa(revision)+"："+reason)
}

func validateEditableLink(l *Link) error {
	u, err := url.ParseRequestURI(l.Destination)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return errors.New("目标地址必须是完整的 HTTP(S) URL")
	}
	if l.Status != "active" && l.Status != "paused" && l.Status != "expired" {
		return errors.New("链接状态无效")
	}
	if l.RedirectStatus == 0 {
		l.RedirectStatus = 302
	}
	if l.MaxClicks != nil && *l.MaxClicks < 1 {
		return errors.New("最大点击量必须大于零")
	}
	if l.RedirectStatus != 301 && l.RedirectStatus != 302 && l.RedirectStatus != 307 && l.RedirectStatus != 308 {
		return errors.New("跳转状态码无效")
	}
	if l.ExpiresAt != nil && *l.ExpiresAt != "" {
		parsed, e := time.Parse(time.RFC3339, *l.ExpiresAt)
		if e != nil {
			parsed, e = time.Parse("2006-01-02T15:04", *l.ExpiresAt)
		}
		if e != nil {
			return errors.New("有效期格式无效")
		}
		normalized := parsed.UTC().Format(time.RFC3339)
		l.ExpiresAt = &normalized
	}
	return validateRouting(l.RoutingRules, l.ABDestinations, l.UTM)
}

func snapshot(l Link) []byte {
	value := map[string]any{"destination": l.Destination, "title": l.Title, "status": l.Status, "redirect_status": l.RedirectStatus, "expires_at": l.ExpiresAt, "max_clicks": l.MaxClicks, "one_time": l.OneTime, "folder_id": l.FolderID, "campaign_id": l.CampaignID, "tag_ids": uniqueIDs(l.TagIDs), "utm": jsonValue(l.UTM, map[string]string{}), "routing_rules": jsonValue(l.RoutingRules, []any{}), "ab_destinations": jsonValue(l.ABDestinations, []any{}), "password_protected": l.PasswordHash != ""}
	encoded, _ := json.Marshal(value)
	return encoded
}
func (s *Service) syncRedis(ctx context.Context, l Link) error {
	payload, _ := json.Marshal(map[string]any{"id": fmt.Sprint(l.ID), "code": l.Code, "domain": l.Domain, "destination": l.Destination, "status_code": l.RedirectStatus, "active": l.Status == "active", "expires_at": l.ExpiresAt, "max_clicks": l.MaxClicks, "one_time": l.OneTime, "password_hash": l.PasswordHash, "utm": jsonValue(l.UTM, map[string]string{}), "routing_rules": jsonValue(l.RoutingRules, []any{}), "ab_destinations": jsonValue(l.ABDestinations, []any{})})
	key := l.Code
	if l.Domain != "" {
		key = l.Domain + "|" + l.Code
	}
	return s.redis.Set(ctx, "gojet:link:"+key, payload, 0).Err()
}
func (s *Service) SyncByID(ctx context.Context, id int64) error {
	var l Link
	err := s.db.QueryRowContext(ctx, `SELECT id,code,domain,destination,redirect_status,status,COALESCE(password_hash,''),expires_at,max_clicks,one_time,COALESCE(utm,JSON_OBJECT()),COALESCE(routing_rules,JSON_ARRAY()),COALESCE(ab_destinations,JSON_ARRAY()) FROM short_links WHERE id=?`, id).Scan(&l.ID, &l.Code, &l.Domain, &l.Destination, &l.RedirectStatus, &l.Status, &l.PasswordHash, &l.ExpiresAt, &l.MaxClicks, &l.OneTime, &l.UTM, &l.RoutingRules, &l.ABDestinations)
	if err != nil {
		return err
	}
	return s.syncRedis(ctx, l)
}
func (s *Service) List(ctx context.Context, userID, workspaceID int64, f Filter) ([]Link, int64, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return nil, 0, errors.New("forbidden")
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 25
	}
	where := `l.workspace_id=? AND l.deleted_at IS NULL`
	args := []any{workspaceID}
	if f.Status != "" {
		where += ` AND l.status=?`
		args = append(args, f.Status)
	}
	if f.Search != "" {
		where += ` AND (l.code LIKE ? OR l.title LIKE ? OR l.destination LIKE ?)`
		q := "%" + f.Search + "%"
		args = append(args, q, q, q)
	}
	if f.Domain != "" {
		where += ` AND l.domain=?`
		args = append(args, f.Domain)
	}
	if f.FolderID > 0 {
		where += ` AND l.folder_id=?`
		args = append(args, f.FolderID)
	}
	if f.CampaignID > 0 {
		where += ` AND l.campaign_id=?`
		args = append(args, f.CampaignID)
	}
	if f.TagID > 0 {
		where += ` AND EXISTS(SELECT 1 FROM link_tags selected_tag WHERE selected_tag.link_id=l.id AND selected_tag.tag_id=?)`
		args = append(args, f.TagID)
	}
	var total int64
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM short_links l WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, f.Limit, f.Offset)
	rows, err := s.db.QueryContext(ctx, `SELECT l.id,l.workspace_id,l.created_by,l.code,l.domain,l.destination,l.title,l.status,l.redirect_status,l.one_time,l.folder_id,l.campaign_id,COALESCE(f.name,''),COALESCE(c.name,''),COALESCE((SELECT GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR 0x1F) FROM link_tags lt JOIN tags t ON t.id=lt.tag_id WHERE lt.link_id=l.id),''),l.created_at FROM short_links l LEFT JOIN folders f ON f.id=l.folder_id LEFT JOIN campaigns c ON c.id=l.campaign_id WHERE `+where+` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Link{}
	for rows.Next() {
		var l Link
		var created string
		var tagNames string
		if err = rows.Scan(&l.ID, &l.WorkspaceID, &l.CreatedBy, &l.Code, &l.Domain, &l.Destination, &l.Title, &l.Status, &l.RedirectStatus, &l.OneTime, &l.FolderID, &l.CampaignID, &l.FolderName, &l.CampaignName, &tagNames, &created); err != nil {
			return nil, 0, err
		}
		if tagNames != "" {
			l.TagNames = strings.Split(tagNames, "\x1f")
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

func (s *Service) BulkMove(ctx context.Context, userID, workspaceID int64, ids []int64, folderID, campaignID *int64) (int64, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return 0, errors.New("forbidden")
	}
	if err = s.validateOrganization(ctx, workspaceID, folderID, campaignID, nil); err != nil {
		return 0, err
	}
	if len(ids) == 0 || len(ids) > 100 {
		return 0, errors.New("请选择 1 到 100 条链接")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var affected int64
	for _, id := range uniqueIDs(ids) {
		result, updateErr := tx.ExecContext(ctx, `UPDATE short_links SET folder_id=?,campaign_id=? WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, folderID, campaignID, id, workspaceID)
		if updateErr != nil {
			return 0, updateErr
		}
		count, _ := result.RowsAffected()
		affected += count
	}
	if err = tx.Commit(); err == nil {
		s.audit(ctx, userID, workspaceID, "links.bulk_moved", affected)
	}
	return affected, err
}

func (s *Service) BulkTags(ctx context.Context, userID, workspaceID int64, ids, tagIDs []int64) (int64, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return 0, errors.New("forbidden")
	}
	if len(ids) == 0 || len(ids) > 100 {
		return 0, errors.New("请选择 1 到 100 条链接")
	}
	if err = s.validateOrganization(ctx, workspaceID, nil, nil, tagIDs); err != nil {
		return 0, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var affected int64
	for _, id := range uniqueIDs(ids) {
		var exists int
		if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM short_links WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, id, workspaceID).Scan(&exists); err != nil {
			return 0, err
		}
		if exists == 0 {
			continue
		}
		if _, err = tx.ExecContext(ctx, `DELETE FROM link_tags WHERE link_id=?`, id); err != nil {
			return 0, err
		}
		for _, tagID := range uniqueIDs(tagIDs) {
			if _, err = tx.ExecContext(ctx, `INSERT INTO link_tags(link_id,tag_id) VALUES(?,?)`, id, tagID); err != nil {
				return 0, err
			}
		}
		affected++
	}
	if err = tx.Commit(); err == nil {
		s.audit(ctx, userID, workspaceID, "links.bulk_tagged", affected)
	}
	return affected, err
}

func (s *Service) BulkDelete(ctx context.Context, userID, workspaceID int64, ids []int64) (int64, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return 0, errors.New("forbidden")
	}
	ids = uniqueIDs(ids)
	if len(ids) == 0 || len(ids) > 100 {
		return 0, errors.New("请选择 1 到 100 条链接")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var affected int64
	for _, id := range ids {
		result, updateErr := tx.ExecContext(ctx, `UPDATE short_links SET status='paused',deleted_at=NOW() WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, id, workspaceID)
		if updateErr != nil {
			return 0, updateErr
		}
		count, _ := result.RowsAffected()
		affected += count
	}
	if err = tx.Commit(); err != nil {
		return 0, err
	}
	for _, id := range ids {
		_ = s.SyncByID(ctx, id)
	}
	s.audit(ctx, userID, workspaceID, "links.bulk_deleted", affected)
	return affected, nil
}

func (s *Service) validateOrganization(ctx context.Context, workspaceID int64, folderID, campaignID *int64, tagIDs []int64) error {
	checks := []struct {
		id    *int64
		table string
		name  string
	}{{folderID, "folders", "文件夹"}, {campaignID, "campaigns", "活动"}}
	for _, check := range checks {
		if check.id == nil {
			continue
		}
		var count int
		query := `SELECT COUNT(*) FROM ` + check.table + ` WHERE id=? AND workspace_id=?`
		if err := s.db.QueryRowContext(ctx, query, *check.id, workspaceID).Scan(&count); err != nil || count != 1 {
			return errors.New(check.name + "不属于当前工作区")
		}
	}
	for _, tagID := range uniqueIDs(tagIDs) {
		var count int
		if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM tags WHERE id=? AND workspace_id=?`, tagID, workspaceID).Scan(&count); err != nil || count != 1 {
			return errors.New("标签不属于当前工作区")
		}
	}
	return nil
}

func (s *Service) audit(ctx context.Context, userID, workspaceID int64, action string, affected int64) {
	_, _ = s.db.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,workspace_id,action,target_type,target_id,metadata) VALUES(?,?,?,'links','bulk',JSON_OBJECT('affected',?))`, userID, workspaceID, action, affected)
}

func uniqueIDs(ids []int64) []int64 {
	seen := map[int64]bool{}
	out := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id > 0 && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
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
		result, err := tx.ExecContext(ctx, `UPDATE short_links SET status=? WHERE id=? AND workspace_id=? AND deleted_at IS NULL`, status, id, workspaceID)
		if err != nil {
			return 0, err
		}
		n, _ := result.RowsAffected()
		affected += n
	}
	if err = tx.Commit(); err != nil {
		return 0, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id,code,domain,destination,redirect_status,status,COALESCE(password_hash,''),expires_at,max_clicks,one_time FROM short_links WHERE workspace_id=?`, workspaceID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var l Link
			_ = rows.Scan(&l.ID, &l.Code, &l.Domain, &l.Destination, &l.RedirectStatus, &l.Status, &l.PasswordHash, &l.ExpiresAt, &l.MaxClicks, &l.OneTime)
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

func jsonValue(raw json.RawMessage, fallback any) any {
	if len(raw) == 0 {
		return fallback
	}
	var value any
	if json.Unmarshal(raw, &value) != nil {
		return fallback
	}
	return value
}

type routingRule struct {
	Dimension, Value, Destination string
}
type abDestination struct {
	ID, Destination string
	Weight          int
}

func validateRouting(rulesRaw, destinationsRaw, utmRaw json.RawMessage) error {
	validURL := func(value string) bool {
		u, err := url.ParseRequestURI(value)
		return err == nil && u.Host != "" && (u.Scheme == "http" || u.Scheme == "https")
	}
	if len(rulesRaw) > 0 {
		var rules []routingRule
		if json.Unmarshal(rulesRaw, &rules) != nil || len(rules) > 20 {
			return errors.New("路由规则格式无效或超过 20 条")
		}
		for _, rule := range rules {
			if !map[string]bool{"device": true, "country": true, "language": true, "source": true}[rule.Dimension] || strings.TrimSpace(rule.Value) == "" || !validURL(rule.Destination) {
				return errors.New("路由规则必须包含有效维度、匹配值和 HTTP(S) 目标地址")
			}
		}
	}
	if len(destinationsRaw) > 0 {
		var destinations []abDestination
		if json.Unmarshal(destinationsRaw, &destinations) != nil || len(destinations) < 2 || len(destinations) > 10 {
			return errors.New("A/B 测试需要 2 到 10 个目标版本")
		}
		total, ids := 0, map[string]bool{}
		for _, item := range destinations {
			if item.ID == "" || ids[item.ID] || item.Weight < 1 || !validURL(item.Destination) {
				return errors.New("A/B 版本必须具有唯一编号、正权重和 HTTP(S) 目标地址")
			}
			ids[item.ID], total = true, total+item.Weight
		}
		if total != 100 {
			return errors.New("A/B 版本权重总和必须为 100")
		}
	}
	if len(utmRaw) > 0 {
		var values map[string]string
		if json.Unmarshal(utmRaw, &values) != nil {
			return errors.New("UTM 参数格式无效")
		}
		for key, value := range values {
			if !map[string]bool{"utm_source": true, "utm_medium": true, "utm_campaign": true, "utm_content": true, "utm_term": true}[key] || len(value) > 255 {
				return errors.New("UTM 参数名称或长度无效")
			}
		}
	}
	return nil
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
