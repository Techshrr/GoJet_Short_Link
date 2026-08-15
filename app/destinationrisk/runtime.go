package destinationrisk

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/redis/go-redis/v9"
)

const redisCacheReadyKey = "gojet:risk:cache:ready:v1"

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

// EnsureRedisCache makes the SQL risk table authoritative after Redis restarts
// or is flushed. The marker is stored in Redis itself, so loss of volatile cache
// state automatically causes a complete exact-fingerprint republish on the next
// recovery check instead of leaving every redirect in a permanent cache miss.
func EnsureRedisCache(ctx context.Context, db *sql.DB, client *redis.Client) error {
	if db == nil || client == nil {
		return fmt.Errorf("risk cache dependencies are required")
	}
	exists, err := client.Exists(ctx, redisCacheReadyKey).Result()
	if err != nil {
		return err
	}
	if exists > 0 {
		return nil
	}
	if err = BackfillRedis(ctx, db, client); err != nil {
		return err
	}
	return client.Set(ctx, redisCacheReadyKey, "1", 0).Err()
}

// BackfillRedis only republishes a decision when it belongs to the exact current
// set of reachable destinations. Legacy migration rows have no fingerprint yet;
// their baseline is bound to the current target set exactly once at first boot.
func BackfillRedis(ctx context.Context, db *sql.DB, client *redis.Client) error {
	rows, err := db.QueryContext(ctx, `
		SELECT r.link_id,COALESCE(r.manual_decision,r.decision),r.provider,r.target_fingerprint,l.destination,
		       COALESCE(l.routing_rules,JSON_ARRAY()),COALESCE(l.ab_destinations,JSON_ARRAY())
		FROM link_destination_risk r JOIN short_links l ON l.id=r.link_id
		WHERE l.deleted_at IS NULL`)
	if err != nil {
		return err
	}
	defer rows.Close()
	type stale struct {
		id          int64
		fingerprint string
		legacy      bool
	}
	staleRows := []stale{}
	pipe := client.Pipeline()
	for rows.Next() {
		var item DueLink
		var decision Decision
		var provider, storedFingerprint string
		if err = rows.Scan(&item.LinkID, &decision, &provider, &storedFingerprint, &item.Destination, &item.RoutingRules, &item.ABDestinations); err != nil {
			return err
		}
		targets := Targets(item.Destination, item.RoutingRules, item.ABDestinations)
		if len(targets) == 0 {
			continue
		}
		currentFingerprint := Fingerprint(targets)
		if storedFingerprint == "" && provider == "migration_legacy" {
			storedFingerprint = currentFingerprint
			staleRows = append(staleRows, stale{id: item.LinkID, fingerprint: currentFingerprint, legacy: true})
		}
		if storedFingerprint != currentFingerprint {
			staleRows = append(staleRows, stale{id: item.LinkID})
			continue
		}
		if !validDecision(decision) {
			decision = Review
		}
		pipe.Del(ctx, legacyRedisKey(item.LinkID))
		pipe.Set(ctx, RedisKey(item.LinkID, targets), string(decision), 0)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	for _, item := range staleRows {
		if item.legacy {
			if _, err = db.ExecContext(ctx, `UPDATE link_destination_risk SET target_fingerprint=? WHERE link_id=? AND target_fingerprint='' AND provider='migration_legacy'`, item.fingerprint, item.id); err != nil {
				return err
			}
			continue
		}
		if _, err = db.ExecContext(ctx, `UPDATE link_destination_risk SET next_scan_at=UTC_TIMESTAMP(),manual_decision=NULL,manual_reason=NULL,manual_administrator_id=NULL,manual_at=NULL WHERE link_id=?`, item.id); err != nil {
			return err
		}
	}
	_, err = pipe.Exec(ctx)
	return err
}

// Pending includes newly-created links and all due rescans. Target edits are made
// due immediately by the short_links_destination_risk_invalidate database trigger.
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
