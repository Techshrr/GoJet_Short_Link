package main

import (
	"context"

	"github.com/Techshrr/GoJet_Short_Link/app/links"
)

func linkDestinationRiskInputsChanged(current, next links.Link) bool {
	return current.Destination != next.Destination ||
		string(current.RoutingRules) != string(next.RoutingRules) ||
		string(current.ABDestinations) != string(next.ABDestinations)
}

// invalidateLinkDestinationRiskFailClosed runs before a destination-affecting
// link mutation. If the following link update fails, the only side effect is an
// extra rescan and cleared manual override; that is intentionally safer than
// allowing a new destination to inherit an ALLOW decision for the old one.
func (s *server) invalidateLinkDestinationRiskFailClosed(ctx context.Context, workspaceID, linkID int64) error {
	_, err := s.db.ExecContext(ctx, `
UPDATE link_destination_risk dr
JOIN short_links l ON l.id=dr.link_id
SET dr.next_scan_at=UTC_TIMESTAMP(),
    dr.manual_decision=NULL,
    dr.manual_reason=NULL,
    dr.manual_administrator_id=NULL,
    dr.manual_at=NULL
WHERE dr.link_id=?
  AND l.workspace_id=?
  AND l.deleted_at IS NULL`, linkID, workspaceID)
	return err
}
