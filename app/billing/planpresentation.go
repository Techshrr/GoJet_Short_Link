package billing

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
)

var supportedBillingPeriods = map[string]bool{
	"monthly": true, "quarterly": true, "semiannual": true, "annual": true,
}

type ManagedPlan struct {
	ID                     int64           `json:"id"`
	Code                   string          `json:"code"`
	Name                   string          `json:"name"`
	MonthlyPriceCents      int64           `json:"monthly_price_cents"`
	Currency               string          `json:"currency"`
	Description            string          `json:"description"`
	Status                 string          `json:"status"`
	IsPublic               bool            `json:"is_public"`
	DisplayOrder           int             `json:"display_order"`
	BillingPeriods         json.RawMessage `json:"billing_periods"`
	Features               json.RawMessage `json:"features"`
	LinkLimit              int64           `json:"link_limit"`
	QRLimit                int64           `json:"qr_limit"`
	TextLimit              int64           `json:"text_limit"`
	BioLimit               int64           `json:"bio_limit"`
	FileStorageBytes       int64           `json:"file_storage_bytes"`
	MemberLimit            int64           `json:"member_limit"`
	AnalyticsRetentionDays int             `json:"analytics_retention_days"`
}

type ManagedPlanInput struct {
	Code                   string          `json:"code"`
	Name                   string          `json:"name"`
	Description            string          `json:"description"`
	Status                 string          `json:"status"`
	Currency               string          `json:"currency"`
	IsPublic               bool            `json:"is_public"`
	DisplayOrder           int             `json:"display_order"`
	BillingPeriods         json.RawMessage `json:"billing_periods"`
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

func normalizeBillingPeriods(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 {
		return json.RawMessage(`["monthly","quarterly","semiannual","annual"]`), nil
	}
	var periods []string
	if err := json.Unmarshal(raw, &periods); err != nil {
		return nil, errors.New("套餐周期格式无效")
	}
	seen := map[string]bool{}
	clean := make([]string, 0, len(periods))
	for _, period := range periods {
		period = strings.ToLower(strings.TrimSpace(period))
		if !supportedBillingPeriods[period] {
			return nil, errors.New("套餐周期仅支持 monthly、quarterly、semiannual、annual")
		}
		if !seen[period] {
			seen[period] = true
			clean = append(clean, period)
		}
	}
	if len(clean) == 0 {
		return nil, errors.New("套餐至少需要一个可用账单周期")
	}
	return json.Marshal(clean)
}

func normalizeManagedPlan(in ManagedPlanInput, creating bool) (ManagedPlanInput, error) {
	in.Code = strings.ToLower(strings.TrimSpace(in.Code))
	in.Name = strings.TrimSpace(in.Name)
	in.Description = strings.TrimSpace(in.Description)
	in.Currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	if creating && !planCodePattern.MatchString(in.Code) {
		return in, errors.New("套餐代码只能使用小写字母、数字和下划线，长度为 2 到 40 位")
	}
	if len(in.Currency) != 3 {
		return in, errors.New("币种必须使用 3 位 ISO 代码")
	}
	if in.Status == "" {
		in.Status = "active"
	}
	if in.Status != "active" && in.Status != "archived" {
		return in, errors.New("套餐状态无效")
	}
	if in.DisplayOrder < 0 || in.DisplayOrder > 1000000 {
		return in, errors.New("套餐展示顺序超出允许范围")
	}
	if err := validatePlanValues(in.Name, in.MonthlyPriceCents, in.LinkLimit, in.QRLimit, in.TextLimit, in.BioLimit, in.FileStorageBytes, in.MemberLimit, in.AnalyticsRetentionDays); err != nil {
		return in, err
	}
	features, err := normalizePlanFeatures(in.Features)
	if err != nil {
		return in, err
	}
	periods, err := normalizeBillingPeriods(in.BillingPeriods)
	if err != nil {
		return in, err
	}
	in.Features = features
	in.BillingPeriods = periods
	return in, nil
}

const managedPlanSelect = `id,code,name,monthly_price_cents,currency,description,status,is_public,display_order,COALESCE(billing_periods,JSON_ARRAY('monthly','quarterly','semiannual','annual')),COALESCE(features,JSON_ARRAY()),link_limit,qr_limit,text_limit,bio_limit,file_storage_bytes,member_limit,analytics_retention_days`

func scanManagedPlan(scanner interface{ Scan(...any) error }, p *ManagedPlan) error {
	return scanner.Scan(&p.ID, &p.Code, &p.Name, &p.MonthlyPriceCents, &p.Currency, &p.Description, &p.Status, &p.IsPublic, &p.DisplayOrder, &p.BillingPeriods, &p.Features, &p.LinkLimit, &p.QRLimit, &p.TextLimit, &p.BioLimit, &p.FileStorageBytes, &p.MemberLimit, &p.AnalyticsRetentionDays)
}

func (s *Service) ManagedPlans(ctx context.Context, includeArchived bool) ([]ManagedPlan, error) {
	query := `SELECT ` + managedPlanSelect + ` FROM plans`
	if !includeArchived {
		query += ` WHERE status='active'`
	}
	query += ` ORDER BY display_order,monthly_price_cents,id`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil { return nil, err }
	defer rows.Close()
	items := []ManagedPlan{}
	for rows.Next() {
		var item ManagedPlan
		if err = scanManagedPlan(rows, &item); err != nil { return nil, err }
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) PublicPlans(ctx context.Context) ([]ManagedPlan, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+managedPlanSelect+` FROM plans WHERE status='active' AND is_public=TRUE ORDER BY display_order,monthly_price_cents,id`)
	if err != nil { return nil, err }
	defer rows.Close()
	items := []ManagedPlan{}
	for rows.Next() {
		var item ManagedPlan
		if err = scanManagedPlan(rows, &item); err != nil { return nil, err }
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateManagedPlan(ctx context.Context, input ManagedPlanInput) (int64, error) {
	in, err := normalizeManagedPlan(input, true)
	if err != nil { return 0, err }
	result, err := s.db.ExecContext(ctx, `INSERT INTO plans(code,name,monthly_price_cents,currency,description,status,is_public,display_order,billing_periods,features,link_limit,qr_limit,text_limit,bio_limit,file_storage_bytes,member_limit,analytics_retention_days) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, in.Code, in.Name, in.MonthlyPriceCents, in.Currency, in.Description, in.Status, in.IsPublic, in.DisplayOrder, in.BillingPeriods, in.Features, in.LinkLimit, in.QRLimit, in.TextLimit, in.BioLimit, in.FileStorageBytes, in.MemberLimit, in.AnalyticsRetentionDays)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") { return 0, errors.New("套餐代码已经存在") }
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Service) UpdateManagedPlanPresentation(ctx context.Context, id int64, input ManagedPlanInput) error {
	in, err := normalizeManagedPlan(input, false)
	if err != nil { return err }
	if in.Status == "archived" {
		if err = s.CanArchivePlan(ctx, id); err != nil { return err }
	}
	result, err := s.db.ExecContext(ctx, `UPDATE plans SET name=?,monthly_price_cents=?,currency=?,description=?,status=?,is_public=?,display_order=?,billing_periods=?,features=?,link_limit=?,qr_limit=?,text_limit=?,bio_limit=?,file_storage_bytes=?,member_limit=?,analytics_retention_days=? WHERE id=?`, in.Name, in.MonthlyPriceCents, in.Currency, in.Description, in.Status, in.IsPublic, in.DisplayOrder, in.BillingPeriods, in.Features, in.LinkLimit, in.QRLimit, in.TextLimit, in.BioLimit, in.FileStorageBytes, in.MemberLimit, in.AnalyticsRetentionDays, id)
	if err != nil { return err }
	affected, _ := result.RowsAffected()
	if affected == 0 {
		var exists int
		if err = s.db.QueryRowContext(ctx, `SELECT 1 FROM plans WHERE id=?`, id).Scan(&exists); err == sql.ErrNoRows { return errors.New("套餐不存在") }
	}
	return nil
}
