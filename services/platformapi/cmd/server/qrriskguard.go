package main

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// requireQRLinkRiskAllow is the server-side enforcement for QR creation. UI
// filtering is only presentation; a crafted API request must not be able to
// generate distribution assets for a pending or blocked destination.
func (s *server) requireQRLinkRiskAllow(ctx context.Context, workspaceID, linkID int64) error {
	var automatic string
	var manual sql.NullString
	var scannedAt, nextScanAt sql.NullTime
	err := s.db.QueryRowContext(ctx, `
SELECT COALESCE(r.decision,'review'), r.manual_decision, r.scanned_at, r.next_scan_at
FROM short_links l
LEFT JOIN link_destination_risk r ON r.link_id=l.id
WHERE l.id=? AND l.workspace_id=? AND l.deleted_at IS NULL AND l.status='active'`, linkID, workspaceID).
		Scan(&automatic, &manual, &scannedAt, &nextScanAt)
	if err != nil {
		return errors.New("短链接不存在、已暂停或无法确认安全状态")
	}
	effective := automatic
	manualEffective := manual.Valid && manual.String != ""
	if manualEffective {
		effective = manual.String
	}
	pending := !scannedAt.Valid || (!manualEffective && nextScanAt.Valid && !nextScanAt.Time.After(time.Now().UTC()))
	if pending || effective != "allow" {
		return errors.New("该短链接尚未通过当前目标的安全审核，暂不能生成二维码")
	}
	return nil
}
