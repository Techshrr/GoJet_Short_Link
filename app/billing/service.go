package billing

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Service struct{ db *sql.DB }

type Plan struct {
	ID                     int64           `json:"id"`
	MonthlyPriceCents      int64           `json:"monthly_price_cents"`
	LinkLimit              int64           `json:"link_limit"`
	QRLimit                int64           `json:"qr_limit"`
	TextLimit              int64           `json:"text_limit"`
	BioLimit               int64           `json:"bio_limit"`
	FileStorageBytes       int64           `json:"file_storage_bytes"`
	MemberLimit            int64           `json:"member_limit"`
	Code                   string          `json:"code"`
	Name                   string          `json:"name"`
	Currency               string          `json:"currency"`
	Description            string          `json:"description"`
	Status                 string          `json:"status"`
	Features               json.RawMessage `json:"features"`
	AnalyticsRetentionDays int             `json:"analytics_retention_days"`
}

type Invoice struct {
	ID            int64  `json:"id"`
	WorkspaceID   int64  `json:"workspace_id"`
	PlanID        int64  `json:"plan_id"`
	RequestedBy   int64  `json:"requested_by"`
	AmountCents   int64  `json:"amount_cents"`
	InvoiceNumber string `json:"invoice_number"`
	PlanName      string `json:"plan_name"`
	PlanCode      string `json:"plan_code"`
	InvoiceType   string `json:"invoice_type"`
	Currency      string `json:"currency"`
	Status        string `json:"status"`
	DueAt         string `json:"due_at"`
	PaidAt        string `json:"paid_at,omitempty"`
	AdminNote     string `json:"admin_note,omitempty"`
	CreatedAt     string `json:"created_at"`
}

type Subscription struct {
	WorkspaceID       int64  `json:"workspace_id"`
	PlanID            int64  `json:"plan_id"`
	PlanCode          string `json:"plan_code"`
	PlanName          string `json:"plan_name"`
	Status            string `json:"status"`
	PeriodStartedAt   string `json:"period_started_at"`
	PeriodEndsAt      string `json:"period_ends_at,omitempty"`
	CancelAtPeriodEnd bool   `json:"cancel_at_period_end"`
}

type PlanInput struct {
	Name, Description, Status                                                                 string
	MonthlyPriceCents, LinkLimit, QRLimit, TextLimit, BioLimit, FileStorageBytes, MemberLimit int64
	AnalyticsRetentionDays                                                                    int
	Features                                                                                  json.RawMessage
}

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

func (s *Service) Plans(ctx context.Context, includeArchived bool) ([]Plan, error) {
	query := `SELECT id,code,name,monthly_price_cents,currency,description,COALESCE(features,JSON_ARRAY()),link_limit,qr_limit,text_limit,bio_limit,file_storage_bytes,member_limit,analytics_retention_days,status FROM plans`
	if !includeArchived {
		query += ` WHERE status='active'`
	}
	query += ` ORDER BY monthly_price_cents,id`
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Plan{}
	for rows.Next() {
		var p Plan
		if err = rows.Scan(&p.ID, &p.Code, &p.Name, &p.MonthlyPriceCents, &p.Currency, &p.Description, &p.Features, &p.LinkLimit, &p.QRLimit, &p.TextLimit, &p.BioLimit, &p.FileStorageBytes, &p.MemberLimit, &p.AnalyticsRetentionDays, &p.Status); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

func (s *Service) Subscription(ctx context.Context, workspaceID int64) (Subscription, []Invoice, error) {
	if err := s.Reconcile(ctx); err != nil {
		return Subscription{}, nil, err
	}
	var sub Subscription
	var started time.Time
	var ended sql.NullTime
	err := s.db.QueryRowContext(ctx, `SELECT s.workspace_id,s.plan_id,p.code,p.name,s.status,s.period_started_at,s.period_ends_at,s.cancel_at_period_end FROM workspace_subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.workspace_id=?`, workspaceID).Scan(&sub.WorkspaceID, &sub.PlanID, &sub.PlanCode, &sub.PlanName, &sub.Status, &started, &ended, &sub.CancelAtPeriodEnd)
	if err != nil {
		return sub, nil, err
	}
	sub.PeriodStartedAt = started.UTC().Format(time.RFC3339)
	if ended.Valid {
		sub.PeriodEndsAt = ended.Time.UTC().Format(time.RFC3339)
	}
	rows, err := s.db.QueryContext(ctx, `SELECT i.id,i.invoice_number,i.workspace_id,i.plan_id,i.requested_by,p.name,p.code,i.invoice_type,i.amount_cents,i.currency,i.status,i.due_at,i.paid_at,i.admin_note,i.created_at FROM billing_invoices i JOIN plans p ON p.id=i.plan_id WHERE i.workspace_id=? ORDER BY i.created_at DESC LIMIT 100`, workspaceID)
	if err != nil {
		return sub, nil, err
	}
	defer rows.Close()
	invoices := []Invoice{}
	for rows.Next() {
		var i Invoice
		var due, created time.Time
		var paid sql.NullTime
		if err = rows.Scan(&i.ID, &i.InvoiceNumber, &i.WorkspaceID, &i.PlanID, &i.RequestedBy, &i.PlanName, &i.PlanCode, &i.InvoiceType, &i.AmountCents, &i.Currency, &i.Status, &due, &paid, &i.AdminNote, &created); err != nil {
			return sub, nil, err
		}
		i.DueAt = due.UTC().Format(time.RFC3339)
		i.CreatedAt = created.UTC().Format(time.RFC3339)
		if paid.Valid {
			i.PaidAt = paid.Time.UTC().Format(time.RFC3339)
		}
		invoices = append(invoices, i)
	}
	return sub, invoices, rows.Err()
}

func (s *Service) Request(ctx context.Context, userID, workspaceID int64, planCode, kind string) (Invoice, error) {
	if err := s.Reconcile(ctx); err != nil {
		return Invoice{}, err
	}
	if kind != "purchase" && kind != "upgrade" && kind != "renewal" {
		return Invoice{}, errors.New("账单类型无效")
	}
	var role string
	if err := s.db.QueryRowContext(ctx, `SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=? AND status='active'`, workspaceID, userID).Scan(&role); err != nil || !canManage(role) {
		return Invoice{}, errors.New("只有工作区所有者或管理员可以管理套餐")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Invoice{}, err
	}
	defer tx.Rollback()
	var plan Plan
	if err = tx.QueryRowContext(ctx, `SELECT id,code,name,monthly_price_cents,currency FROM plans WHERE code=? AND status='active' FOR SHARE`, strings.TrimSpace(planCode)).Scan(&plan.ID, &plan.Code, &plan.Name, &plan.MonthlyPriceCents, &plan.Currency); err != nil {
		return Invoice{}, errors.New("套餐不存在或已下架")
	}
	var currentPlan int64
	if err = tx.QueryRowContext(ctx, `SELECT plan_id FROM workspace_subscriptions WHERE workspace_id=? FOR UPDATE`, workspaceID).Scan(&currentPlan); err != nil {
		return Invoice{}, err
	}
	if kind == "renewal" && currentPlan != plan.ID {
		return Invoice{}, errors.New("续费必须使用当前套餐")
	}
	if kind != "renewal" && currentPlan == plan.ID {
		return Invoice{}, errors.New("当前已经使用该套餐；如需延长周期请选择续费")
	}
	var pending int
	if err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM billing_invoices WHERE workspace_id=? AND status IN ('pending','overdue')`, workspaceID).Scan(&pending); err != nil {
		return Invoice{}, err
	}
	if pending > 0 {
		return Invoice{}, errors.New("已有待处理账单，请先完成或作废")
	}
	number, err := invoiceNumber()
	if err != nil {
		return Invoice{}, err
	}
	due := time.Now().UTC().Add(72 * time.Hour)
	result, err := tx.ExecContext(ctx, `INSERT INTO billing_invoices(invoice_number,workspace_id,plan_id,requested_by,invoice_type,amount_cents,currency,due_at) VALUES(?,?,?,?,?,?,?,?)`, number, workspaceID, plan.ID, userID, kind, plan.MonthlyPriceCents, plan.Currency, due)
	if err != nil {
		return Invoice{}, err
	}
	id, _ := result.LastInsertId()
	_, err = tx.ExecContext(ctx, `INSERT INTO subscription_events(workspace_id,invoice_id,actor_type,actor_id,event_type,from_plan_id,to_plan_id,metadata) VALUES(?,?,'user',?,'invoice.requested',?,?,JSON_OBJECT('invoice_number',?))`, workspaceID, id, userID, currentPlan, plan.ID, number)
	if err != nil {
		return Invoice{}, err
	}
	if err = tx.Commit(); err != nil {
		return Invoice{}, err
	}
	return Invoice{ID: id, InvoiceNumber: number, WorkspaceID: workspaceID, PlanID: plan.ID, RequestedBy: userID, PlanName: plan.Name, PlanCode: plan.Code, InvoiceType: kind, AmountCents: plan.MonthlyPriceCents, Currency: plan.Currency, Status: "pending", DueAt: due.Format(time.RFC3339)}, nil
}

func (s *Service) CancelAtPeriodEnd(ctx context.Context, userID, workspaceID int64, cancel bool) error {
	var role string
	if err := s.db.QueryRowContext(ctx, `SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=? AND status='active'`, workspaceID, userID).Scan(&role); err != nil || !canManage(role) {
		return errors.New("只有工作区所有者或管理员可以管理套餐")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(ctx, `UPDATE workspace_subscriptions SET cancel_at_period_end=? WHERE workspace_id=?`, cancel, workspaceID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return errors.New("订阅不存在")
	}
	event := "subscription.cancellation_scheduled"
	if !cancel {
		event = "subscription.cancellation_revoked"
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO subscription_events(workspace_id,actor_type,actor_id,event_type) VALUES(?,'user',?,?)`, workspaceID, userID, event)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) Settle(ctx context.Context, administratorID, invoiceID int64, status, note string) error {
	if status != "paid" && status != "void" {
		return errors.New("账单只能标记为已支付或作废")
	}
	if strings.TrimSpace(note) == "" {
		return errors.New("必须填写处理备注")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var workspaceID, planID int64
	var current, invoiceType string
	if err = tx.QueryRowContext(ctx, `SELECT workspace_id,plan_id,status,invoice_type FROM billing_invoices WHERE id=? FOR UPDATE`, invoiceID).Scan(&workspaceID, &planID, &current, &invoiceType); err != nil {
		return err
	}
	if current != "pending" && current != "overdue" {
		return errors.New("账单已经处理")
	}
	if status == "void" {
		_, err = tx.ExecContext(ctx, `UPDATE billing_invoices SET status='void',voided_at=NOW(),admin_note=? WHERE id=?`, note, invoiceID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE billing_invoices SET status='paid',paid_at=NOW(),admin_note=? WHERE id=?`, note, invoiceID)
		if err == nil && invoiceType == "renewal" {
			_, err = tx.ExecContext(ctx, `UPDATE workspace_subscriptions SET status='active',period_ends_at=DATE_ADD(GREATEST(COALESCE(period_ends_at,NOW()),NOW()),INTERVAL 30 DAY),cancel_at_period_end=FALSE WHERE workspace_id=?`, workspaceID)
		} else if err == nil {
			_, err = tx.ExecContext(ctx, `UPDATE workspace_subscriptions SET plan_id=?,status='active',period_started_at=NOW(),period_ends_at=DATE_ADD(NOW(),INTERVAL 30 DAY),cancel_at_period_end=FALSE WHERE workspace_id=?`, planID, workspaceID)
		}
	}
	if err != nil {
		return err
	}
	event := "invoice." + status
	_, err = tx.ExecContext(ctx, `INSERT INTO subscription_events(workspace_id,invoice_id,actor_type,actor_id,event_type,to_plan_id,metadata) VALUES(?,?,'administrator',?,?,?,JSON_OBJECT('note',?))`, workspaceID, invoiceID, administratorID, event, planID, note)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) Invoices(ctx context.Context, status string, limit, offset int) ([]Invoice, error) {
	if err := s.Reconcile(ctx); err != nil {
		return nil, err
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	if offset < 0 {
		offset = 0
	}
	query := `SELECT i.id,i.invoice_number,i.workspace_id,i.plan_id,i.requested_by,p.name,p.code,i.invoice_type,i.amount_cents,i.currency,i.status,i.due_at,i.paid_at,i.admin_note,i.created_at FROM billing_invoices i JOIN plans p ON p.id=i.plan_id`
	args := []any{}
	if status != "" {
		query += ` WHERE i.status=?`
		args = append(args, status)
	}
	query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Invoice{}
	for rows.Next() {
		var i Invoice
		var due, created time.Time
		var paid sql.NullTime
		if err = rows.Scan(&i.ID, &i.InvoiceNumber, &i.WorkspaceID, &i.PlanID, &i.RequestedBy, &i.PlanName, &i.PlanCode, &i.InvoiceType, &i.AmountCents, &i.Currency, &i.Status, &due, &paid, &i.AdminNote, &created); err != nil {
			return nil, err
		}
		i.DueAt = due.UTC().Format(time.RFC3339)
		i.CreatedAt = created.UTC().Format(time.RFC3339)
		if paid.Valid {
			i.PaidAt = paid.Time.UTC().Format(time.RFC3339)
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

func (s *Service) Reconcile(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE billing_invoices SET status='overdue' WHERE status='pending' AND due_at<NOW()`); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE workspace_subscriptions SET status='cancelled' WHERE status='active' AND cancel_at_period_end=TRUE AND period_ends_at IS NOT NULL AND period_ends_at<=NOW()`); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) UpdatePlan(ctx context.Context, id int64, in PlanInput) error {
	if strings.TrimSpace(in.Name) == "" || (in.Status != "active" && in.Status != "archived") {
		return errors.New("套餐名称和有效状态必填")
	}
	if in.MonthlyPriceCents < 0 || in.LinkLimit < 1 || in.QRLimit < 1 || in.TextLimit < 1 || in.BioLimit < 1 || in.FileStorageBytes < 1 || in.MemberLimit < 1 || in.AnalyticsRetentionDays < 1 {
		return errors.New("价格不能为负数，配额必须大于零")
	}
	if len(in.Features) == 0 {
		in.Features = []byte(`[]`)
	}
	_, err := s.db.ExecContext(ctx, `UPDATE plans SET name=?,monthly_price_cents=?,description=?,features=?,link_limit=?,qr_limit=?,text_limit=?,bio_limit=?,file_storage_bytes=?,member_limit=?,analytics_retention_days=?,status=? WHERE id=?`, in.Name, in.MonthlyPriceCents, in.Description, in.Features, in.LinkLimit, in.QRLimit, in.TextLimit, in.BioLimit, in.FileStorageBytes, in.MemberLimit, in.AnalyticsRetentionDays, in.Status, id)
	return err
}

func invoiceNumber() (string, error) {
	var b [6]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return fmt.Sprintf("GJ-%s-%s", time.Now().UTC().Format("20060102"), strings.ToUpper(hex.EncodeToString(b[:]))), nil
}
func canManage(role string) bool { return role == "owner" || role == "admin" }

func (s *Service) AssignStarter(ctx context.Context, tx *sql.Tx, workspaceID int64) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO workspace_subscriptions(workspace_id,plan_id) SELECT ?,id FROM plans WHERE code='starter' AND status='active'`, workspaceID)
	return err
}

func (s *Service) Usage(ctx context.Context, workspaceID int64) (Usage, error) {
	if err := s.Reconcile(ctx); err != nil {
		return Usage{}, err
	}
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
