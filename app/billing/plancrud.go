package billing

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

var planCodePattern = regexp.MustCompile(`^[a-z0-9_]{2,40}$`)

type PlanCreateInput struct {
	Code                   string          `json:"code"`
	Name                   string          `json:"name"`
	Description            string          `json:"description"`
	Currency               string          `json:"currency"`
	MonthlyPriceCents      int64           `json:"monthly_price_cents"`
	LinkLimit              int64           `json:"link_limit"`
	QRLimit                int64           `json:"qr_limit"`
	TextLimit              int64           `json:"text_limit"`
	BioLimit               int64           `json:"bio_limit"`
	FileStorageBytes       int64           `json:"file_storage_bytes"`
	MemberLimit            int64           `json:"member_limit"`
	AnalyticsRetentionDays int             `json:"analytics_retention_days"`
	Features               json.RawMessage `json:"features"`
}

func normalizePlanFeatures(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 {
		return json.RawMessage(`[]`), nil
	}
	var features []string
	if err := json.Unmarshal(raw, &features); err != nil {
		return nil, errors.New("套餐功能必须是文字列表")
	}
	clean := make([]string, 0, len(features))
	for _, value := range features {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if len([]rune(value)) > 120 {
			return nil, errors.New("单条套餐功能不能超过 120 个字符")
		}
		clean = append(clean, value)
	}
	if len(clean) > 20 {
		return nil, errors.New("套餐功能最多 20 条")
	}
	encoded, err := json.Marshal(clean)
	return encoded, err
}

func validatePlanValues(name string, price, links, qrs, texts, bios, storage, members int64, retention int) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("套餐名称不能为空")
	}
	if price < 0 {
		return errors.New("套餐价格不能为负数")
	}
	if links < 1 || qrs < 1 || texts < 1 || bios < 1 || storage < 1 || members < 1 || retention < 1 {
		return errors.New("套餐配额必须大于零")
	}
	return nil
}

func (s *Service) CreatePlan(ctx context.Context, in PlanCreateInput) (int64, error) {
	in.Code = strings.ToLower(strings.TrimSpace(in.Code))
	in.Name = strings.TrimSpace(in.Name)
	in.Description = strings.TrimSpace(in.Description)
	in.Currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	if !planCodePattern.MatchString(in.Code) {
		return 0, errors.New("套餐代码只能使用小写字母、数字和下划线，长度为 2 到 40 位")
	}
	if len(in.Currency) != 3 {
		return 0, errors.New("币种必须使用 3 位 ISO 代码")
	}
	if err := validatePlanValues(in.Name, in.MonthlyPriceCents, in.LinkLimit, in.QRLimit, in.TextLimit, in.BioLimit, in.FileStorageBytes, in.MemberLimit, in.AnalyticsRetentionDays); err != nil {
		return 0, err
	}
	features, err := normalizePlanFeatures(in.Features)
	if err != nil {
		return 0, err
	}
	result, err := s.db.ExecContext(ctx, `INSERT INTO plans(code,name,monthly_price_cents,currency,description,features,link_limit,qr_limit,text_limit,bio_limit,file_storage_bytes,member_limit,analytics_retention_days,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'active')`, in.Code, in.Name, in.MonthlyPriceCents, in.Currency, in.Description, features, in.LinkLimit, in.QRLimit, in.TextLimit, in.BioLimit, in.FileStorageBytes, in.MemberLimit, in.AnalyticsRetentionDays)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return 0, errors.New("套餐代码已经存在")
		}
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Service) UpdateManagedPlan(ctx context.Context, id int64, in PlanInput) error {
	if in.Status == "archived" {
		if err := s.CanArchivePlan(ctx, id); err != nil {
			return err
		}
	}
	features, err := normalizePlanFeatures(in.Features)
	if err != nil {
		return err
	}
	in.Features = features
	return s.UpdatePlan(ctx, id, in)
}

func (s *Service) CanArchivePlan(ctx context.Context, id int64) error {
	var code, status string
	if err := s.db.QueryRowContext(ctx, `SELECT code,status FROM plans WHERE id=?`, id).Scan(&code, &status); err != nil {
		if err == sql.ErrNoRows {
			return errors.New("套餐不存在")
		}
		return err
	}
	if status == "archived" {
		return nil
	}
	if code == "starter" {
		return errors.New("基础版是当前新账户默认套餐，不能归档")
	}
	var subscriptions int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM workspace_subscriptions WHERE plan_id=? AND status IN ('active','past_due')`, id).Scan(&subscriptions); err != nil {
		return err
	}
	if subscriptions > 0 {
		return errors.New("仍有客户正在使用该套餐，不能归档")
	}
	var active int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM plans WHERE status='active' AND id<>?`, id).Scan(&active); err != nil {
		return err
	}
	if active == 0 {
		return errors.New("至少需要保留一个可用套餐")
	}
	return nil
}

func (s *Service) ArchivePlan(ctx context.Context, id int64) error {
	if err := s.CanArchivePlan(ctx, id); err != nil {
		return err
	}
	result, err := s.db.ExecContext(ctx, `UPDATE plans SET status='archived' WHERE id=? AND status='active'`, id)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		var status string
		if err := s.db.QueryRowContext(ctx, `SELECT status FROM plans WHERE id=?`, id).Scan(&status); err != nil {
			return errors.New("套餐不存在")
		}
	}
	return nil
}
