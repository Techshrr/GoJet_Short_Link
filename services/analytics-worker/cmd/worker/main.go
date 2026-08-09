package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/Techshrr/GoJet_Short_Link/services/analytics-worker/internal/worker"
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
	if err = db.PingContext(ctx); err != nil {
		log.Fatalf("mysql unavailable: %v", err)
	}
	redisDB, _ := strconv.Atoi(getenv("REDIS_DB", "0"))
	rdb := redis.NewClient(&redis.Options{Addr: getenv("REDIS_ADDRESS", "127.0.0.1:6379"), Password: os.Getenv("REDIS_PASSWORD"), DB: redisDB})
	defer rdb.Close()
	if err = rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis unavailable: %v", err)
	}
	batch, _ := strconv.ParseInt(getenv("ANALYTICS_BATCH_SIZE", "100"), 10, 64)
	w := worker.New(rdb, db, "gojet:analytics:events", getenv("ANALYTICS_GROUP", "gojet-mysql"), getenv("ANALYTICS_CONSUMER", "worker-1"), batch)
	log.Printf("starting analytics worker %s", w)
	if err = w.Run(ctx); err != nil {
		log.Fatal(err)
	}
}
func getenv(k, f string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return f
}
func required(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("%s must be configured", k)
	}
	return v
}
