package links

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/Techshrr/GoJet_Short_Link/app/workspace"
)

// AnalyticsSafe is the canonical read path for link analytics. SQL aggregate
// functions return NULL on empty input; every aggregate is therefore made
// explicit so a new link with zero events still returns a valid zero-valued
// analytics payload instead of an API error.
func (s *Service) AnalyticsSafe(ctx context.Context, userID, workspaceID, linkID int64, from, to string) (Analytics, error) {
	role, err := s.workspaces.Role(ctx, workspaceID, userID)
	if err != nil || !workspace.Allowed(role, "analytics") {
		return Analytics{}, errors.New("forbidden")
	}
	var exists int
	if err = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM short_links WHERE id=? AND workspace_id=?`, linkID, workspaceID).Scan(&exists); err != nil || exists == 0 {
		return Analytics{}, sql.ErrNoRows
	}

	base := `link_id=? AND occurred_at>=? AND occurred_at<?`
	args := []any{fmt.Sprint(linkID), from, to}
	var out Analytics
	if err = s.db.QueryRowContext(ctx, `SELECT COUNT(*),COUNT(DISTINCT IF(is_bot=0,visitor_hash,NULL)),COALESCE(SUM(is_bot),0) FROM analytics_events WHERE `+base, args...).Scan(&out.Clicks, &out.UniqueVisitors, &out.BotVisits); err != nil {
		return out, err
	}

	dimension := func(column string) ([]Dimension, error) {
		rows, queryErr := s.db.QueryContext(ctx, `SELECT COALESCE(NULLIF(`+column+`,''),'Unknown'),COUNT(*) FROM analytics_events WHERE `+base+` GROUP BY 1 ORDER BY 2 DESC LIMIT 20`, args...)
		if queryErr != nil {
			return nil, queryErr
		}
		defer rows.Close()
		items := []Dimension{}
		for rows.Next() {
			var item Dimension
			if queryErr = rows.Scan(&item.Name, &item.Count); queryErr != nil {
				return nil, queryErr
			}
			items = append(items, item)
		}
		return items, rows.Err()
	}

	for column, target := range map[string]*[]Dimension{
		"source_type": &out.Sources,
		"country": &out.Countries,
		"region": &out.Regions,
		"city": &out.Cities,
		"device": &out.Devices,
		"browser": &out.Browsers,
		"operating_system": &out.OperatingSystems,
		"language": &out.Languages,
		"utm_source": &out.UTMSources,
		"destination_id": &out.Destinations,
	} {
		items, queryErr := dimension(column)
		if queryErr != nil {
			return out, queryErr
		}
		*target = items
	}

	rows, err := s.db.QueryContext(ctx, `SELECT occurred_at,source_type,COALESCE(country,''),device,browser,operating_system,is_bot FROM analytics_events WHERE `+base+` ORDER BY occurred_at DESC LIMIT 100`, args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	out.Recent = []map[string]any{}
	for rows.Next() {
		var at, source, country, device, browser, operatingSystem string
		var bot bool
		if err = rows.Scan(&at, &source, &country, &device, &browser, &operatingSystem, &bot); err != nil {
			return out, err
		}
		out.Recent = append(out.Recent, map[string]any{
			"timestamp": at,
			"source": source,
			"country": country,
			"device": device,
			"browser": browser,
			"operating_system": operatingSystem,
			"is_bot": bot,
		})
	}
	return out, rows.Err()
}
