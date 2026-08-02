package organization

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
	"github.com/redis/go-redis/v9"
)

type Service struct {
	db         *sql.DB
	redis      *redis.Client
	workspaces *workspace.Service
}

type Campaign struct {
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	Status          string `json:"status"`
	ConversionCount int64  `json:"conversions"`
	ConversionToken string `json:"conversion_token,omitempty"`
	LinkCount       int64  `json:"links"`
	Clicks          int64  `json:"clicks"`
}

type Folder struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	LinkCount int64  `json:"links"`
}

type Tag struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	LinkCount int64  `json:"links"`
}

type Snapshot struct {
	Campaigns []Campaign `json:"campaigns"`
	Folders   []Folder   `json:"folders"`
	Tags      []Tag      `json:"tags"`
}

func New(db *sql.DB, redis *redis.Client, workspaces *workspace.Service) *Service {
	return &Service{db: db, redis: redis, workspaces: workspaces}
}

func (s *Service) Snapshot(ctx context.Context, userID, workspaceID int64) (Snapshot, error) {
	if _, err := s.workspaces.Role(ctx, workspaceID, userID); err != nil {
		return Snapshot{}, errors.New("forbidden")
	}
	out := Snapshot{Campaigns: []Campaign{}, Folders: []Folder{}, Tags: []Tag{}}
	rows, err := s.db.QueryContext(ctx, `SELECT c.id,c.name,c.status,c.conversion_count,COUNT(l.id) FROM campaigns c LEFT JOIN short_links l ON l.campaign_id=c.id AND l.deleted_at IS NULL WHERE c.workspace_id=? GROUP BY c.id ORDER BY c.created_at DESC`, workspaceID)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var item Campaign
		if err = rows.Scan(&item.ID, &item.Name, &item.Status, &item.ConversionCount, &item.LinkCount); err != nil {
			rows.Close()
			return out, err
		}
		out.Campaigns = append(out.Campaigns, item)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return out, err
	}
	rows.Close()
	campaignIndex := map[int64]int{}
	for index := range out.Campaigns {
		campaignIndex[out.Campaigns[index].ID] = index
	}
	rows, err = s.db.QueryContext(ctx, `SELECT id,campaign_id FROM short_links WHERE workspace_id=? AND campaign_id IS NOT NULL AND deleted_at IS NULL`, workspaceID)
	if err != nil {
		return out, err
	}
	type campaignLink struct{ id, campaignID int64 }
	links := []campaignLink{}
	keys := []string{}
	for rows.Next() {
		var linkID, campaignID int64
		if rows.Scan(&linkID, &campaignID) == nil {
			links = append(links, campaignLink{linkID, campaignID})
			keys = append(keys, "gojet:clicks:"+itoa(linkID))
		}
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return out, err
	}
	rows.Close()
	if len(keys) > 0 {
		values, redisErr := s.redis.MGet(ctx, keys...).Result()
		if redisErr != nil {
			return out, redisErr
		}
		for index, value := range values {
			if value == nil {
				continue
			}
			text, ok := value.(string)
			if !ok {
				continue
			}
			clicks, _ := strconv.ParseInt(text, 10, 64)
			if campaignPosition, ok := campaignIndex[links[index].campaignID]; ok {
				out.Campaigns[campaignPosition].Clicks += clicks
			}
		}
	}
	rows, err = s.db.QueryContext(ctx, `SELECT f.id,f.name,COUNT(l.id) FROM folders f LEFT JOIN short_links l ON l.folder_id=f.id AND l.deleted_at IS NULL WHERE f.workspace_id=? GROUP BY f.id ORDER BY f.name`, workspaceID)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var item Folder
		if err = rows.Scan(&item.ID, &item.Name, &item.LinkCount); err != nil {
			rows.Close()
			return out, err
		}
		out.Folders = append(out.Folders, item)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return out, err
	}
	rows.Close()
	rows, err = s.db.QueryContext(ctx, `SELECT t.id,t.name,t.color,COUNT(l.id) FROM tags t LEFT JOIN link_tags lt ON lt.tag_id=t.id LEFT JOIN short_links l ON l.id=lt.link_id AND l.deleted_at IS NULL WHERE t.workspace_id=? GROUP BY t.id ORDER BY t.name`, workspaceID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var item Tag
		if err = rows.Scan(&item.ID, &item.Name, &item.Color, &item.LinkCount); err != nil {
			return out, err
		}
		out.Tags = append(out.Tags, item)
	}
	return out, rows.Err()
}

func (s *Service) CreateCampaign(ctx context.Context, userID, workspaceID int64, name string) (Campaign, error) {
	if err := s.canEdit(ctx, userID, workspaceID); err != nil {
		return Campaign{}, err
	}
	name, err := validName(name, 120)
	if err != nil {
		return Campaign{}, err
	}
	raw := make([]byte, 32)
	if _, err = rand.Read(raw); err != nil {
		return Campaign{}, err
	}
	token := hex.EncodeToString(raw)
	hash := sha256.Sum256([]byte(token))
	result, err := s.db.ExecContext(ctx, `INSERT INTO campaigns(workspace_id,name,conversion_token_hash) VALUES(?,?,?)`, workspaceID, name, hex.EncodeToString(hash[:]))
	if err != nil {
		return Campaign{}, err
	}
	id, _ := result.LastInsertId()
	s.audit(ctx, userID, workspaceID, "campaign.created", "campaign", id)
	return Campaign{ID: id, Name: name, Status: "active", ConversionToken: token}, nil
}

func (s *Service) RecordConversion(ctx context.Context, campaignID int64, token, visitor string) (bool, error) {
	hash := sha256.Sum256([]byte(token))
	var exists int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM campaigns WHERE id=? AND status='active' AND conversion_token_hash=?`, campaignID, hex.EncodeToString(hash[:])).Scan(&exists); err != nil || exists != 1 {
		return false, errors.New("活动转化凭据无效")
	}
	visitorHash := sha256.Sum256([]byte(visitor))
	dedupKey := "gojet:conversion:" + itoa(campaignID) + ":" + hex.EncodeToString(visitorHash[:])
	first, err := s.redis.SetNX(ctx, dedupKey, "1", 24*time.Hour).Result()
	if err != nil {
		return false, err
	}
	if !first {
		return false, nil
	}
	result, err := s.db.ExecContext(ctx, `UPDATE campaigns SET conversion_count=conversion_count+1 WHERE id=? AND status='active'`, campaignID)
	if err != nil {
		_ = s.redis.Del(ctx, dedupKey).Err()
		return false, err
	}
	count, _ := result.RowsAffected()
	return count == 1, nil
}

func (s *Service) SetCampaignStatus(ctx context.Context, userID, workspaceID, campaignID int64, status string) error {
	if err := s.canEdit(ctx, userID, workspaceID); err != nil {
		return err
	}
	if status != "active" && status != "paused" && status != "completed" {
		return errors.New("活动状态无效")
	}
	result, err := s.db.ExecContext(ctx, `UPDATE campaigns SET status=? WHERE id=? AND workspace_id=?`, status, campaignID, workspaceID)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count != 1 {
		return sql.ErrNoRows
	}
	s.audit(ctx, userID, workspaceID, "campaign.status_changed", "campaign", campaignID)
	return nil
}

func (s *Service) CreateFolder(ctx context.Context, userID, workspaceID int64, name string) (Folder, error) {
	if err := s.canEdit(ctx, userID, workspaceID); err != nil {
		return Folder{}, err
	}
	name, err := validName(name, 120)
	if err != nil {
		return Folder{}, err
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO folders(workspace_id,name) VALUES(?,?)`, workspaceID, name)
	if err != nil {
		return Folder{}, err
	}
	id, _ := result.LastInsertId()
	s.audit(ctx, userID, workspaceID, "folder.created", "folder", id)
	return Folder{ID: id, Name: name}, nil
}

func (s *Service) CreateTag(ctx context.Context, userID, workspaceID int64, name, color string) (Tag, error) {
	if err := s.canEdit(ctx, userID, workspaceID); err != nil {
		return Tag{}, err
	}
	name, err := validName(name, 80)
	if err != nil {
		return Tag{}, err
	}
	color = strings.ToLower(strings.TrimSpace(color))
	if !regexp.MustCompile(`^#[0-9a-f]{6}$`).MatchString(color) {
		return Tag{}, errors.New("标签颜色必须为 #RRGGBB")
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO tags(workspace_id,name,color) VALUES(?,?,?)`, workspaceID, name, color)
	if err != nil {
		return Tag{}, err
	}
	id, _ := result.LastInsertId()
	s.audit(ctx, userID, workspaceID, "tag.created", "tag", id)
	return Tag{ID: id, Name: name, Color: color}, nil
}

func (s *Service) canEdit(ctx context.Context, userID, workspaceID int64) error {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "edit") {
		return errors.New("forbidden")
	}
	return nil
}

func (s *Service) audit(ctx context.Context, userID, workspaceID int64, action, target string, id int64) {
	_, _ = s.db.ExecContext(ctx, `INSERT INTO audit_logs(actor_user_id,workspace_id,action,target_type,target_id,metadata) VALUES(?,?,?,?,?,JSON_OBJECT())`, userID, workspaceID, action, target, id)
}

func validName(value string, max int) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len([]rune(value)) > max {
		return "", errors.New("名称不能为空或过长")
	}
	return value, nil
}

func itoa(value int64) string {
	const digits = "0123456789"
	if value == 0 {
		return "0"
	}
	var out [20]byte
	index := len(out)
	for value > 0 {
		index--
		out[index] = digits[value%10]
		value /= 10
	}
	return string(out[index:])
}
