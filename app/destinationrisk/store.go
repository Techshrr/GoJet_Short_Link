package destinationrisk

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type Record struct {
	LinkID                int64           `json:"link_id"`
	Decision              Decision        `json:"decision"`
	EffectiveDecision     Decision        `json:"effective_decision"`
	Score                 int             `json:"score"`
	Categories            []Category      `json:"categories"`
	Evidence              json.RawMessage `json:"evidence"`
	Provider              string          `json:"provider"`
	TargetFingerprint     string          `json:"target_fingerprint"`
	ScannedURL            string          `json:"scanned_url"`
	FinalURL              string          `json:"final_url"`
	ScannedAt             *time.Time      `json:"scanned_at,omitempty"`
	NextScanAt            *time.Time      `json:"next_scan_at,omitempty"`
	ManualDecision        *Decision       `json:"manual_decision,omitempty"`
	ManualReason          string          `json:"manual_reason,omitempty"`
	ManualAdministratorID *int64          `json:"manual_administrator_id,omitempty"`
	ManualAt              *time.Time      `json:"manual_at,omitempty"`
}

type ReviewItem struct {
	Record
	WorkspaceID int64  `json:"workspace_id"`
	Code        string `json:"code"`
	Domain      string `json:"domain"`
	Destination string `json:"destination"`
	Title       string `json:"title"`
	LinkStatus  string `json:"link_status"`
}

type DueLink struct {
	LinkID         int64
	Destination    string
	RoutingRules   json.RawMessage
	ABDestinations json.RawMessage
}

type Store struct{ db *sql.DB }

func NewStore(db *sql.DB) *Store { return &Store{db: db} }

func validDecision(value Decision) bool {
	return value == Allow || value == Review || value == Block
}

func (s *Store) Save(ctx context.Context, linkID int64, targets []string, assessment Assessment) error {
	if linkID < 1 || len(targets) == 0 || !validDecision(assessment.Decision) {
		return errors.New("invalid destination risk assessment")
	}
	categories, err := json.Marshal(assessment.Categories)
	if err != nil {
		return err
	}
	evidence, err := json.Marshal(assessment.Evidence)
	if err != nil {
		return err
	}
	provider := strings.TrimSpace(assessment.Provider)
	if provider == "" {
		provider = "builtin"
	}
	fingerprint := Fingerprint(targets)
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO link_destination_risk(
			link_id,decision,score,categories,evidence,provider,target_fingerprint,scanned_url,final_url,scanned_at,next_scan_at
		) VALUES(?,?,?,?,?,?,?,?,?,?,?)
		ON DUPLICATE KEY UPDATE
			decision=VALUES(decision),score=VALUES(score),categories=VALUES(categories),evidence=VALUES(evidence),provider=VALUES(provider),
			manual_decision=IF(link_destination_risk.target_fingerprint=VALUES(target_fingerprint),manual_decision,NULL),
			manual_reason=IF(link_destination_risk.target_fingerprint=VALUES(target_fingerprint),manual_reason,NULL),
			manual_administrator_id=IF(link_destination_risk.target_fingerprint=VALUES(target_fingerprint),manual_administrator_id,NULL),
			manual_at=IF(link_destination_risk.target_fingerprint=VALUES(target_fingerprint),manual_at,NULL),
			target_fingerprint=VALUES(target_fingerprint),scanned_url=VALUES(scanned_url),final_url=VALUES(final_url),
			scanned_at=VALUES(scanned_at),next_scan_at=VALUES(next_scan_at)`,
		linkID, assessment.Decision, assessment.Score, categories, evidence, provider, fingerprint,
		assessment.ScannedURL, assessment.FinalURL, assessment.ScannedAt, assessment.NextScanAt)
	return err
}

func (s *Store) Get(ctx context.Context, linkID int64) (Record, error) {
	var record Record
	var categories, evidence []byte
	var scannedAt, nextScanAt, manualAt sql.NullTime
	var manualDecision, manualReason sql.NullString
	var manualAdmin sql.NullInt64
	err := s.db.QueryRowContext(ctx, `
		SELECT link_id,decision,score,COALESCE(categories,JSON_ARRAY()),COALESCE(evidence,JSON_ARRAY()),provider,target_fingerprint,
		       scanned_url,final_url,scanned_at,next_scan_at,manual_decision,manual_reason,manual_administrator_id,manual_at
		FROM link_destination_risk WHERE link_id=?`, linkID).Scan(
		&record.LinkID, &record.Decision, &record.Score, &categories, &evidence, &record.Provider, &record.TargetFingerprint,
		&record.ScannedURL, &record.FinalURL, &scannedAt, &nextScanAt, &manualDecision, &manualReason, &manualAdmin, &manualAt)
	if err != nil {
		return record, err
	}
	_ = json.Unmarshal(categories, &record.Categories)
	record.Evidence = append(record.Evidence[:0], evidence...)
	if scannedAt.Valid {
		value := scannedAt.Time.UTC()
		record.ScannedAt = &value
	}
	if nextScanAt.Valid {
		value := nextScanAt.Time.UTC()
		record.NextScanAt = &value
	}
	record.EffectiveDecision = record.Decision
	if manualDecision.Valid {
		value := Decision(manualDecision.String)
		record.ManualDecision = &value
		record.EffectiveDecision = value
	}
	if manualReason.Valid {
		record.ManualReason = manualReason.String
	}
	if manualAdmin.Valid {
		value := manualAdmin.Int64
		record.ManualAdministratorID = &value
	}
	if manualAt.Valid {
		value := manualAt.Time.UTC()
		record.ManualAt = &value
	}
	return record, nil
}

func (s *Store) EffectiveDecision(ctx context.Context, linkID int64) Decision {
	record, err := s.Get(ctx, linkID)
	if err != nil || !validDecision(record.EffectiveDecision) {
		return Review
	}
	return record.EffectiveDecision
}

func (s *Store) Override(ctx context.Context, linkID, administratorID int64, decision Decision, reason string) (Record, error) {
	if !validDecision(decision) || administratorID < 1 {
		return Record{}, errors.New("invalid destination risk override")
	}
	reason = strings.TrimSpace(reason)
	if len(reason) < 3 || len(reason) > 500 {
		return Record{}, errors.New("manual override reason must contain 3 to 500 characters")
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE link_destination_risk
		SET manual_decision=?,manual_reason=?,manual_administrator_id=?,manual_at=UTC_TIMESTAMP()
		WHERE link_id=?`, decision, reason, administratorID, linkID)
	if err != nil {
		return Record{}, err
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return Record{}, sql.ErrNoRows
	}
	return s.Get(ctx, linkID)
}

func (s *Store) ClearOverride(ctx context.Context, linkID int64) (Record, error) {
	result, err := s.db.ExecContext(ctx, `
		UPDATE link_destination_risk
		SET manual_decision=NULL,manual_reason=NULL,manual_administrator_id=NULL,manual_at=NULL
		WHERE link_id=?`, linkID)
	if err != nil {
		return Record{}, err
	}
	if affected, _ := result.RowsAffected(); affected != 1 {
		return Record{}, sql.ErrNoRows
	}
	return s.Get(ctx, linkID)
}

func (s *Store) List(ctx context.Context, decision string, limit, offset int) ([]ReviewItem, int64, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	where := `l.deleted_at IS NULL`
	args := []any{}
	if decision != "" {
		if !validDecision(Decision(decision)) {
			return nil, 0, errors.New("invalid risk decision filter")
		}
		where += ` AND COALESCE(r.manual_decision,r.decision)=?`
		args = append(args, decision)
	}
	var total int64
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM link_destination_risk r JOIN short_links l ON l.id=r.link_id WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	queryArgs := append(append([]any{}, args...), limit, offset)
	rows, err := s.db.QueryContext(ctx, `
		SELECT r.link_id,l.workspace_id,l.code,l.domain,l.destination,l.title,l.status,
		       r.decision,r.score,COALESCE(r.categories,JSON_ARRAY()),COALESCE(r.evidence,JSON_ARRAY()),r.provider,r.target_fingerprint,
		       r.scanned_url,r.final_url,r.scanned_at,r.next_scan_at,r.manual_decision,r.manual_reason,r.manual_administrator_id,r.manual_at
		FROM link_destination_risk r JOIN short_links l ON l.id=r.link_id
		WHERE `+where+`
		ORDER BY FIELD(COALESCE(r.manual_decision,r.decision),'block','review','allow'),r.score DESC,r.updated_at DESC
		LIMIT ? OFFSET ?`, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []ReviewItem{}
	for rows.Next() {
		var item ReviewItem
		var categories, evidence []byte
		var scannedAt, nextScanAt, manualAt sql.NullTime
		var manualDecision, manualReason sql.NullString
		var manualAdmin sql.NullInt64
		if err = rows.Scan(&item.LinkID, &item.WorkspaceID, &item.Code, &item.Domain, &item.Destination, &item.Title, &item.LinkStatus,
			&item.Decision, &item.Score, &categories, &evidence, &item.Provider, &item.TargetFingerprint, &item.ScannedURL, &item.FinalURL,
			&scannedAt, &nextScanAt, &manualDecision, &manualReason, &manualAdmin, &manualAt); err != nil {
			return nil, 0, err
		}
		_ = json.Unmarshal(categories, &item.Categories)
		item.Evidence = append(item.Evidence[:0], evidence...)
		item.EffectiveDecision = item.Decision
		if scannedAt.Valid {
			value := scannedAt.Time.UTC()
			item.ScannedAt = &value
		}
		if nextScanAt.Valid {
			value := nextScanAt.Time.UTC()
			item.NextScanAt = &value
		}
		if manualDecision.Valid {
			value := Decision(manualDecision.String)
			item.ManualDecision = &value
			item.EffectiveDecision = value
		}
		if manualReason.Valid {
			item.ManualReason = manualReason.String
		}
		if manualAdmin.Valid {
			value := manualAdmin.Int64
			item.ManualAdministratorID = &value
		}
		if manualAt.Valid {
			value := manualAt.Time.UTC()
			item.ManualAt = &value
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (s *Store) Due(ctx context.Context, limit int) ([]DueLink, error) {
	if limit < 1 || limit > 500 {
		limit = 100
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT l.id,l.destination,COALESCE(l.routing_rules,JSON_ARRAY()),COALESCE(l.ab_destinations,JSON_ARRAY())
		FROM link_destination_risk r JOIN short_links l ON l.id=r.link_id
		WHERE l.deleted_at IS NULL AND (
			l.updated_at>COALESCE(r.scanned_at,'1970-01-01 00:00:00') OR
			(r.manual_decision IS NULL AND r.next_scan_at IS NOT NULL AND r.next_scan_at<=UTC_TIMESTAMP())
		)
		ORDER BY CASE WHEN l.updated_at>COALESCE(r.scanned_at,'1970-01-01 00:00:00') THEN 0 ELSE 1 END,r.next_scan_at ASC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []DueLink{}
	for rows.Next() {
		var item DueLink
		if err = rows.Scan(&item.LinkID, &item.Destination, &item.RoutingRules, &item.ABDestinations); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
