package billing

import (
	"context"
	"database/sql"
	"errors"
)

type Service struct{ db *sql.DB }

type Usage struct {
	PlanName      string `json:"plan_name"`
	PlanCode      string `json:"plan_code"`
	Links         int64  `json:"links"`
	LinkLimit     int64  `json:"link_limit"`
	QRs           int64  `json:"qr_codes"`
	QRLimit       int64  `json:"qr_limit"`
	Texts         int64  `json:"text_shares"`
	TextLimit     int64  `json:"text_limit"`
	Bios          int64  `json:"bio_pages"`
	BioLimit      int64  `json:"bio_limit"`
	FileBytes     int64  `json:"file_bytes"`
	FileMax       int64  `json:"file_storage_bytes"`
	Members       int64  `json:"members"`
	MemberMax     int64  `json:"member_limit"`
	RetentionDays int    `json:"analytics_retention_days"`
}

func New(db *sql.DB) *Service { return &Service{db: db} }

func (s *Service) AssignStarter(ctx context.Context, tx *sql.Tx, workspaceID int64) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO workspace_subscriptions(workspace_id,plan_id) SELECT ?,id FROM plans WHERE code='starter' AND status='active'`, workspaceID)
	return err
}

func (s *Service) Usage(ctx context.Context, workspaceID int64) (Usage, error) {
	var out Usage
	err := s.db.QueryRowContext(ctx, `SELECT p.name,p.code,p.link_limit,p.qr_limit,p.text_limit,p.bio_limit,p.file_storage_bytes,p.member_limit,p.analytics_retention_days,
        (SELECT COUNT(*) FROM short_links WHERE workspace_id=? AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM qr_codes WHERE workspace_id=? AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM text_shares WHERE workspace_id=? AND deleted_at IS NULL),
        (SELECT COUNT(*) FROM bio_pages WHERE workspace_id=? AND deleted_at IS NULL),
        (SELECT COALESCE(SUM(size_bytes),0) FROM file_shares WHERE workspace_id=? AND status<>'expired'),
        (SELECT COUNT(*) FROM workspace_members WHERE workspace_id=? AND status='active')
        FROM workspace_subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.workspace_id=? AND s.status='active' AND p.status='active'`, workspaceID, workspaceID, workspaceID, workspaceID, workspaceID, workspaceID, workspaceID).Scan(&out.PlanName, &out.PlanCode, &out.LinkLimit, &out.QRLimit, &out.TextLimit, &out.BioLimit, &out.FileMax, &out.MemberMax, &out.RetentionDays, &out.Links, &out.QRs, &out.Texts, &out.Bios, &out.FileBytes, &out.Members)
	return out, err
}

func (s *Service) Check(ctx context.Context, workspaceID int64, resource string, delta int64) error {
	usage, err := s.Usage(ctx, workspaceID)
	if err != nil {
		return err
	}
	var used, limit int64
	switch resource {
	case "links":
		used, limit = usage.Links, usage.LinkLimit
	case "qr":
		used, limit = usage.QRs, usage.QRLimit
	case "texts":
		used, limit = usage.Texts, usage.TextLimit
	case "bios":
		used, limit = usage.Bios, usage.BioLimit
	case "files":
		used, limit = usage.FileBytes, usage.FileMax
	case "members":
		used, limit = usage.Members, usage.MemberMax
	default:
		return errors.New("未知套餐资源")
	}
	if delta < 0 || used+delta > limit {
		return errors.New("当前套餐配额不足，请升级套餐或清理资源")
	}
	return nil
}
