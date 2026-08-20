package main

import (
	"database/sql"
	"net/http"
	"time"
)

type userLinkRiskState struct {
	LinkID            int64      `json:"link_id"`
	EffectiveDecision string     `json:"effective_decision"`
	ScannedAt         *time.Time `json:"scanned_at,omitempty"`
	NextScanAt        *time.Time `json:"next_scan_at,omitempty"`
	Pending           bool       `json:"pending"`
}

// workspaceLinkRisks exposes only the minimum customer-facing state required
// to explain whether a link is usable, under review or blocked. Provider names,
// scores, evidence, administrator identity and manual-review notes are strictly
// admin-only and are never serialized to Workspace clients.
func (s *server) workspaceLinkRisks(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := pathID(r, "id")
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "工作区编号无效"})
		return
	}
	if _, err = s.workspace.Role(r.Context(), workspaceID, currentUser(r).ID); err != nil {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "无权查看该工作区的安全状态"})
		return
	}
	rows, err := s.db.QueryContext(r.Context(), `
SELECT l.id,
       COALESCE(r.decision,'review'),
       r.scanned_at,
       r.next_scan_at,
       r.manual_decision
FROM short_links l
LEFT JOIN link_destination_risk r ON r.link_id=l.id
WHERE l.workspace_id=? AND l.deleted_at IS NULL
ORDER BY l.id DESC`, workspaceID)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接安全状态暂时不可用"})
		return
	}
	defer rows.Close()

	now := time.Now().UTC()
	items := make([]userLinkRiskState, 0)
	for rows.Next() {
		var item userLinkRiskState
		var automaticDecision string
		var scannedAt, nextScanAt sql.NullTime
		var manual sql.NullString
		if err = rows.Scan(&item.LinkID, &automaticDecision, &scannedAt, &nextScanAt, &manual); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接安全状态暂时不可用"})
			return
		}
		item.EffectiveDecision = automaticDecision
		if manual.Valid && manual.String != "" {
			item.EffectiveDecision = manual.String
		}
		if scannedAt.Valid {
			value := scannedAt.Time.UTC()
			item.ScannedAt = &value
		}
		if nextScanAt.Valid {
			value := nextScanAt.Time.UTC()
			item.NextScanAt = &value
		}
		item.Pending = !scannedAt.Valid || (!manual.Valid && nextScanAt.Valid && !nextScanAt.Time.After(now))
		if item.Pending && !manual.Valid {
			item.EffectiveDecision = "review"
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "链接安全状态暂时不可用"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"data": items})
}
