package main

import (
	"context"
	"os"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/monitoring"
	"github.com/redis/go-redis/v9"
)

// Platform API owns the Admin service-health view, so its heartbeat starts at
// process initialization and is independent from a particular HTTP request.
func init() {
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" { return }
	go func() {
		rdb := redis.NewClient(&redis.Options{Addr: getenv("REDIS_ADDRESS", "redis:6379"), Username: os.Getenv("REDIS_USERNAME"), Password: os.Getenv("REDIS_PASSWORD")})
		ctx := context.Background()
		for attempt := 0; attempt < 20; attempt++ {
			pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			err := rdb.Ping(pingCtx).Err()
			cancel()
			if err == nil {
				monitoring.StartRuntimeHeartbeat(ctx, rdb, "platformapi")
				return
			}
			time.Sleep(time.Second)
		}
		_ = rdb.Close()
	}()
}
