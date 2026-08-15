package destinationrisk

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
)

// ListByLinkIDs returns the authoritative risk records for the exact links a
// product surface is rendering. It avoids coupling link-management state to the
// review queue's severity ordering or first 100 rows.
func (s *Store) ListByLinkIDs(ctx context.Context, linkIDs []int64) ([]ReviewItem, error) {
	if len(linkIDs) == 0 {
		return []ReviewItem{}, nil
	}
	if len(linkIDs) > 100 {
		return nil, errors.New("too many link ids")
	}
	seen := make(map[int64]struct{}, len(linkIDs))
	ids := make([]int64, 0, len(linkIDs))
	for _, id := range linkIDs {
		if id < 1 {
			return nil, errors.New("invalid link id")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return []ReviewItem{}, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT r.link_id,l.workspace_id,l.code,l.domain,l.destination,l.title,l.status,
		       r.decision,r.score,COALESCE(r.categories,JSON_ARRAY()),COALESCE(r.evidence,JSON_ARRAY()),r.provider,r.target_fingerprint,
		       r.scanned_url,r.final_url,r.scanned_at,r.next_scan_at,r.manual_decision,r.manual_reason,r.manual_administrator_id,r.manual_at
		FROM link_destination_risk r JOIN short_links l ON l.id=r.link_id
		WHERE l.deleted_at IS NULL AND r.link_id IN (`+strings.Join(placeholders, ",")+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ReviewItem, 0, len(ids))
	for rows.Next() {
		var item ReviewItem
		var categories, evidence []byte
		var scannedAt, nextScanAt, manualAt sql.NullTime
		var manualDecision, manualReason sql.NullString
		var manualAdmin sql.NullInt64
		if err = rows.Scan(
			&item.LinkID, &item.WorkspaceID, &item.Code, &item.Domain, &item.Destination, &item.Title, &item.LinkStatus,
			&item.Decision, &item.Score, &categories, &evidence, &item.Provider, &item.TargetFingerprint,
			&item.ScannedURL, &item.FinalURL, &scannedAt, &nextScanAt, &manualDecision, &manualReason, &manualAdmin, &manualAt,
		); err != nil {
			return nil, err
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
	return items, rows.Err()
}
