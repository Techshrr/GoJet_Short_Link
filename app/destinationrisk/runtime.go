package destinationrisk

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/redis/go-redis/v9"
)

func RedisKey(linkID int64, targets []string) string {
	return "gojet:risk:" + fmt.Sprint(linkID) + ":" + Fingerprint(targets)
}

func legacyRedisKey(linkID int64) string { return "gojet:risk:" + fmt.Sprint(linkID) }

func SyncDecision(ctx context.Context, client *redis.Client, linkID int64, targets []string, decision Decision) error {
	if client == nil || linkID < 1 || len(targets) == 0 || !validDecision(decision) {
		return fmt.Errorf("invalid risk cache update")
	}
	pipe := client.Pipeline()
	pipe.Del(ctx, legacyRedisKey(linkID))
	pipe.Set(ctx, RedisKey(linkID, targets), string(decision), 0)
	_, err := pipe.Exec(ctx)
	return err
}

// BackfillRedis publishes persisted effective decisions at service startup. The
// key includes every currently reachable destination, so a stored ALLOW decision
// cannot be reused after the primary, routing or A/B target set changes.
func BackfillRedis(ctx context.Context, db *sql.DB, client *redis.Client) error {
	rows, err := db.QueryContext(ctx, `
		SELECT r.link_id,COALESCE(r.manual_decision,r.decision),l.destination,
		       COALESCE(l.routing_rules,JSON_ARRAY()),COALESCE(l.ab_destinations,JSON_ARRAY())
		FROM link_destination_risk r JOIN short_links l ON l.id=r.link_id
		WHERE l.deleted_at IS NULL`)
	if err != nil {
		return err
	}
	defer rows.Close()
	pipe := client.Pipeline()
	for rows.Next() {
		var item DueLink
		var decision Decision
		if err = rows.Scan(&item.LinkID, &decision, &item.Destination, &item.RoutingRules, &item.ABDestinations); err != nil {
			return err
		}
		if !validDecision(decision) {
			decision = Review
		}
		targets := Targets(item.Destination, item.RoutingRules, item.ABDestinations)
		if len(targets) == 0 {
			continue
		}
		pipe.Del(ctx, legacyRedisKey(item.LinkID))
		pipe.Set(ctx, RedisKey(item.LinkID, targets), string(decision), 0)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	_, err = pipe.Exec(ctx)
	return err
}

// Pending includes both due rescans and newly-created links that do not yet have
// a risk row. A target edit naturally invalidates the old Redis decision because
// redirectengine computes a different destination fingerprint, even before the
// persisted row becomes due again.
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
