package main

import (
	"errors"
	"net/http"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/monitoring"
	"github.com/redis/go-redis/v9"
)

// adminRuntimeServicesV503 reports only observed runtime evidence. A service is
// healthy when its heartbeat is recent, offline when its TTL has expired, and
// unavailable when the health registry itself cannot be read. No state is
// synthesized from the fact that the service is expected to exist.
func (s *server) adminRuntimeServicesV503(w http.ResponseWriter, r *http.Request) {
	now := time.Now().UTC()
	items := make([]map[string]any, 0, len(p17Services))
	for _, name := range p17Services {
		item := map[string]any{
			"service": name,
			"status": "offline",
			"health": "no recent heartbeat",
			"version": "unknown",
			"last_seen_at": nil,
			"started_at": nil,
			"uptime_seconds": nil,
		}
		heartbeat, err := monitoring.ReadRuntimeHeartbeat(r.Context(), s.redis, name)
		if err == nil {
			age := now.Sub(heartbeat.LastSeen)
			status := "healthy"
			health := "heartbeat received"
			if age > 35*time.Second {
				status = "degraded"
				health = "heartbeat is stale"
			}
			item["status"] = status
			item["health"] = health
			item["version"] = heartbeat.Version
			item["last_seen_at"] = heartbeat.LastSeen
			item["started_at"] = heartbeat.StartedAt
			if !heartbeat.StartedAt.IsZero() && now.After(heartbeat.StartedAt) {
				item["uptime_seconds"] = int64(now.Sub(heartbeat.StartedAt).Seconds())
			}
		} else if !errors.Is(err, redis.Nil) {
			item["status"] = "unavailable"
			item["health"] = "health registry unavailable"
		}
		items = append(items, item)
	}
	jsonResponse(w, http.StatusOK, map[string]any{
		"data": items,
		"expected_services": len(p17Services),
		"generated_at": now,
	})
}
