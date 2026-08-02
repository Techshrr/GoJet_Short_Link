package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/services/analytics-reconciler/internal/reconciler"
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	db, err := sql.Open("mysql", required("MYSQL_DSN"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	rdb := redis.NewClient(&redis.Options{Addr: getenv("REDIS_ADDRESS", "redis:6379"), Password: os.Getenv("REDIS_PASSWORD")})
	defer rdb.Close()
	batch, _ := strconv.Atoi(getenv("ANALYTICS_RECONCILE_BATCH", "500"))
	intervalSeconds, _ := strconv.Atoi(getenv("ANALYTICS_RECONCILE_INTERVAL_SECONDS", "60"))
	if intervalSeconds < 10 {
		intervalSeconds = 60
	}
	runner := reconciler.New(rdb, db, batch)
	for {
		result, runErr := runner.RunOnce(ctx)
		if runErr != nil {
			log.Printf("analytics reconciliation failed: %v", runErr)
		} else {
			log.Printf("analytics reconciliation checked=%d consistent=%d worker_lag=%d redis_repaired=%d", result.Checked, result.Consistent, result.WorkerLag, result.RedisRepaired)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Duration(intervalSeconds) * time.Second):
		}
	}
}
func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func required(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("%s must be configured", key)
	}
	return value
}
