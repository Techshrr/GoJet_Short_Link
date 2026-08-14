package destinationrisk

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
)

// SaveTx persists an automatic assessment inside the caller's link transaction.
// clearManual must be true whenever any reachable destination changes, because an
// administrator override made for the old target must never silently authorize a
// different target.
func (s *Store) SaveTx(ctx context.Context, tx *sql.Tx, linkID int64, assessment Assessment, clearManual bool) error {
	if tx == nil || linkID < 1 || !validDecision(assessment.Decision) {
		return errors.New("invalid transactional destination risk assessment")
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
	if clearManual {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO link_destination_risk(
				link_id,decision,score,categories,evidence,provider,scanned_url,final_url,scanned_at,next_scan_at,
				manual_decision,manual_reason,manual_administrator_id,manual_at
			) VALUES(?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL)
			ON DUPLICATE KEY UPDATE
				decision=VALUES(decision),score=VALUES(score),categories=VALUES(categories),evidence=VALUES(evidence),
				provider=VALUES(provider),scanned_url=VALUES(scanned_url),final_url=VALUES(final_url),
				scanned_at=VALUES(scanned_at),next_scan_at=VALUES(next_scan_at),
				manual_decision=NULL,manual_reason=NULL,manual_administrator_id=NULL,manual_at=NULL`,
			linkID, assessment.Decision, assessment.Score, categories, evidence, provider,
			assessment.ScannedURL, assessment.FinalURL, assessment.ScannedAt, assessment.NextScanAt)
		return err
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO link_destination_risk(
			link_id,decision,score,categories,evidence,provider,scanned_url,final_url,scanned_at,next_scan_at
		) VALUES(?,?,?,?,?,?,?,?,?,?)
		ON DUPLICATE KEY UPDATE
			decision=VALUES(decision),score=VALUES(score),categories=VALUES(categories),evidence=VALUES(evidence),
			provider=VALUES(provider),scanned_url=VALUES(scanned_url),final_url=VALUES(final_url),
			scanned_at=VALUES(scanned_at),next_scan_at=VALUES(next_scan_at)`,
		linkID, assessment.Decision, assessment.Score, categories, evidence, provider,
		assessment.ScannedURL, assessment.FinalURL, assessment.ScannedAt, assessment.NextScanAt)
	return err
}
