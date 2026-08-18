package billing

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
)

func (s *Service) ValidatePlanSelection(ctx context.Context, planCode, kind, billingCycle string) error {
	planCode = strings.ToLower(strings.TrimSpace(planCode))
	kind = strings.ToLower(strings.TrimSpace(kind))
	billingCycle = strings.ToLower(strings.TrimSpace(billingCycle))
	var status string
	var isPublic bool
	var raw json.RawMessage
	err := s.db.QueryRowContext(ctx, `SELECT status,is_public,COALESCE(billing_periods,JSON_ARRAY('monthly','quarterly','semiannual','annual')) FROM plans WHERE code=?`, planCode).Scan(&status, &isPublic, &raw)
	if err != nil {
		if err == sql.ErrNoRows { return errors.New("套餐不存在") }
		return err
	}
	if status != "active" { return errors.New("套餐当前不可购买") }
	if kind != "renewal" && !isPublic { return errors.New("该套餐当前不公开销售") }
	var periods []string
	if err = json.Unmarshal(raw, &periods); err != nil { return errors.New("套餐周期配置无效") }
	for _, period := range periods {
		if strings.EqualFold(strings.TrimSpace(period), billingCycle) { return nil }
	}
	return errors.New("该套餐不支持所选账单周期")
}
