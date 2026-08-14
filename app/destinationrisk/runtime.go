package destinationrisk

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/redis/go-redis/v9"
)

func RedisKey(linkID int64) string { return "gojet:risk:" + fmt.Sprint(linkID) }

func SyncDecision(ctx context.Context, client *redis.Client, linkID int64, decision Decision) error {
	if client == nil || linkID < 1 || !validDecision(decision) {
		return fmt.Errorf("invalid risk cache update")
	}
	return client.Set(ctx, RedisKey(linkID), string(decision), 0).Err()
}

// BackfillRedis publishes persisted effective decisions at service startup. This
// keeps legacy links available after the migration while redirectengine remains
// fail-closed for links whose risk key truly does not exist yet.
func BackfillRedis(ctx context.Context, db *sql.DB, client *redis.Client) error {
	rows, err := db.QueryContext(ctx, `
		SELECT link_id,COALESCE(manual_decision,decision)
		FROM link_destination_risk`)
	if err != nil {
		return err
	}
	defer rows.Close()
	pipe := client.Pipeline()
	for rows.Next() {
		var linkID int64
		var decision Decision
		if err = rows.Scan(&linkID, &decision); err != nil {
			return err
		}
		if !validDecision(decision) {
			decision = Review
		}
		pipe.Set(ctx, RedisKey(linkID), string(decision), 0)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	_, err = pipe.Exec(ctx)
	return err
}

// Pending includes both due rescans and newly-created links that do not yet have
// a risk row. The latter are blocked by redirectengine's missing-key fail-closed
// rule until this queue produces the first assessment.
func (s *Store) Pending(ctx context.Context, limit int) ([]DueLink, error) {
	if limit < 1 || limit > 500 {
		limit = 100
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT l.id,l.destination,COALESCE(l.routing_rules,JSON_ARRAY()),COALESCE(l.ab_destinations,JSON_ARRAY())
		FROM short_links l LEFT JOIN link_destination_risk r ON r.link_id=l.id
		WHERE l.deleted_at IS NULL AND (
			r.link_id IS NULL OR
			(r.manual_decision IS NULL AND r.next_scan_at IS NOT NULL AND r.next_scan_at<=UTC_TIMESTAMP())
		)
		ORDER BY CASE WHEN r.link_id IS NULL THEN 0 ELSE 1 END,r.next_scan_at ASC,l.id ASC
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
