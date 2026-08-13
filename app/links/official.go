package links

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
	"golang.org/x/crypto/bcrypt"
)

func (s *Service) CreateOfficialWithPolicy(ctx context.Context, userID, workspaceID int64, l Link, policy CreatePolicy) (Link, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return Link{}, errors.New("forbidden")
	}
	if s.billing != nil {
		if err = s.billing.Check(ctx, workspaceID, "links", 1); err != nil {
			return Link{}, err
		}
	}
	l, err = applyCreatePolicy(l, policy, time.Now().UTC())
	if err != nil {
		return Link{}, err
	}
	u, err := url.ParseRequestURI(l.Destination)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return Link{}, errors.New("目标地址必须是完整的 HTTP(S) URL")
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
	l.Domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(l.Domain), "."))
	var available int
	if l.Domain == "" || s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM official_short_domains WHERE hostname=? AND status='active'`, l.Domain).Scan(&available) != nil || available == 0 {
		return Link{}, errors.New("所选官方短链域名不可用")
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
	l.WorkspaceID, l.CreatedBy = workspaceID, userID
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
