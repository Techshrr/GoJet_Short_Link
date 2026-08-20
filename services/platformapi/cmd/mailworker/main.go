package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	appmail "github.com/Techshrr/GoJet_Short_Link/app/mail"
	"github.com/Techshrr/GoJet_Short_Link/app/monitoring"
	"github.com/Techshrr/GoJet_Short_Link/app/settings"
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	db, err := sql.Open("mysql", required("MYSQL_DSN"))
	if err != nil { log.Fatal(err) }
	defer db.Close()
	if err = db.PingContext(ctx); err != nil { log.Fatal(err) }
	rdb := redis.NewClient(&redis.Options{Addr: getenv("REDIS_ADDRESS", "redis:6379"), Username: os.Getenv("REDIS_USERNAME"), Password: os.Getenv("REDIS_PASSWORD")})
	defer rdb.Close()
	if err = rdb.Ping(ctx).Err(); err != nil { log.Fatal(err) }
	monitoring.StartRuntimeHeartbeat(ctx, rdb, "mailworker")
	key, err := settings.DecodeKey(required("SETTINGS_ENCRYPTION_KEY"))
	if err != nil { log.Fatal(err) }
	store, err := settings.NewStore(db, key)
	if err != nil { log.Fatal(err) }
	service := appmail.NewService(db, store)
	lastLifecycleScan := time.Time{}
	for {
		select {
		case <-ctx.Done():
			return
		default:
			if lastLifecycleScan.IsZero() || time.Since(lastLifecycleScan) >= time.Minute {
				if err = service.QueueAccountLifecycleNotifications(ctx); err != nil { log.Printf("account mail lifecycle scan failed: %v", err) }
				if err = service.QueueLifecycleNotifications(ctx); err != nil { log.Printf("business mail lifecycle scan failed: %v", err) }
				if err = service.QueueSecurityAndWorkspaceNotifications(ctx); err != nil { log.Printf("security/workspace mail lifecycle scan failed: %v", err) }
				lastLifecycleScan = time.Now()
			}
			if err = service.ProcessOne(ctx); err != nil { log.Printf("mail delivery failed: %v", err) }
			time.Sleep(time.Second)
		}
	}
}
func required(k string) string {
	v := os.Getenv(k)
	if v == "" { log.Fatalf("%s must be configured", k) }
	return v
}
func getenv(k, fallback string) string {
	if v := os.Getenv(k); v != "" { return v }
	return fallback
}
