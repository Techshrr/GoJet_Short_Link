package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/destinationrisk"
	"github.com/Techshrr/GoJet_Short_Link/app/monitoring"
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		if operationsHealthcheck() {
			return
		}
		os.Exit(1)
	}

	db, err := sql.Open("mysql", required("MYSQL_DSN"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		log.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: value("REDIS_ADDRESS", "redis:6379"), Username: os.Getenv("REDIS_USERNAME"), Password: os.Getenv("REDIS_PASSWORD")})
	defer rdb.Close()
	if err = rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatal(err)
	}

	riskStore := destinationrisk.NewStore(db)
	riskScanner := newDestinationRiskScanner()
	var riskCacheDirty atomic.Bool
	bootstrapCtx, bootstrapCancel := context.WithTimeout(context.Background(), 15*time.Second)
	if err = destinationrisk.BackfillRedis(bootstrapCtx, db, rdb); err != nil {
		riskCacheDirty.Store(true)
		log.Printf("destination risk cache backfill: %v", err)
	}
	bootstrapCancel()
	go runRiskCacheRecoveryLoop(context.Background(), db, rdb, &riskCacheDirty)
	go runRiskLoop(context.Background(), riskStore, riskScanner, rdb, &riskCacheDirty)

	interval, _ := strconv.Atoi(value("OPERATIONS_MONITOR_INTERVAL_SECONDS", "60"))
	if interval < 10 {
		interval = 10
	}
	service := monitoring.New(db, os.Getenv("ALERT_RECIPIENT"))
	for {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		err = service.Run(ctx)
		cancel()
		if err != nil {
			log.Printf("operations monitor: %v", err)
		}
		time.Sleep(time.Duration(interval) * time.Second)
	}
}

func operationsHealthcheck() bool {
	dsn := os.Getenv("MYSQL_DSN")
	if dsn == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return false
	}
	defer db.Close()
	if err = db.PingContext(ctx); err != nil {
		return false
	}
	rdb := redis.NewClient(&redis.Options{Addr: value("REDIS_ADDRESS", "redis:6379"), Username: os.Getenv("REDIS_USERNAME"), Password: os.Getenv("REDIS_PASSWORD")})
	defer rdb.Close()
	if err = rdb.Ping(ctx).Err(); err != nil {
		return false
	}
	ready, err := destinationrisk.RedisCacheReady(ctx, rdb)
	return err == nil && ready
}

func newDestinationRiskScanner() *destinationrisk.Scanner {
	return destinationrisk.New(destinationrisk.ProviderFromEnvironment())
}

func runRiskCacheRecoveryLoop(ctx context.Context, db *sql.DB, rdb *redis.Client, dirty *atomic.Bool) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			recoveryCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			var err error
			if dirty != nil && dirty.Load() {
				err = destinationrisk.BackfillRedis(recoveryCtx, db, rdb)
				if err == nil {
					dirty.Store(false)
				}
			} else {
				err = destinationrisk.EnsureRedisCache(recoveryCtx, db, rdb)
			}
			cancel()
			if err != nil {
				log.Printf("destination risk cache recovery: %v", err)
			}
		}
	}
}

func runRiskLoop(ctx context.Context, store *destinationrisk.Store, scanner *destinationrisk.Scanner, rdb *redis.Client, dirty *atomic.Bool) {
	interval, _ := strconv.Atoi(value("DESTINATION_RISK_SCAN_INTERVAL_SECONDS", "3"))
	if interval < 2 {
		interval = 2
	}
	if interval > 60 {
		interval = 60
	}
	workers, _ := strconv.Atoi(value("DESTINATION_RISK_SCAN_WORKERS", "4"))
	if workers < 1 {
		workers = 1
	}
	if workers > 12 {
		workers = 12
	}
	batch, _ := strconv.Atoi(value("DESTINATION_RISK_SCAN_BATCH", "24"))
	if batch < 1 {
		batch = 1
	}
	if batch > 100 {
		batch = 100
	}

	run := func() {
		queueCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		items, err := store.Pending(queueCtx, batch)
		cancel()
		if err != nil {
			log.Printf("destination risk queue: %v", err)
			return
		}
		if len(items) == 0 {
			return
		}
		jobs := make(chan destinationrisk.DueLink)
		var wait sync.WaitGroup
		for i := 0; i < workers; i++ {
			wait.Add(1)
			go func() {
				defer wait.Done()
				for item := range jobs {
					scanCtx, scanCancel := context.WithTimeout(ctx, 12*time.Second)
					targets := destinationrisk.Targets(item.Destination, item.RoutingRules, item.ABDestinations)
					assessment := scanner.AssessPolicy(scanCtx, targets)
					scanCancel()
					if len(targets) == 0 {
						continue
					}
					var invalidateErr error
					for attempt := 0; attempt < 3; attempt++ {
						invalidateErr = rdb.Del(ctx, destinationrisk.RedisKey(item.LinkID, targets)).Err()
						if invalidateErr == nil {
							break
						}
						time.Sleep(time.Duration(attempt+1) * 100 * time.Millisecond)
					}
					if invalidateErr != nil {
						log.Printf("destination risk fail-closed invalidate link=%d: %v", item.LinkID, invalidateErr)
						continue
					}
					if err := store.Save(ctx, item.LinkID, targets, assessment); err != nil {
						log.Printf("destination risk save link=%d: %v", item.LinkID, err)
						continue
					}
					if err := destinationrisk.SyncDecision(ctx, rdb, item.LinkID, targets, assessment.Decision); err != nil {
						if dirty != nil {
							dirty.Store(true)
						}
						log.Printf("destination risk cache link=%d: %v", item.LinkID, err)
					}
				}
			}()
		}
		for _, item := range items {
			jobs <- item
		}
		close(jobs)
		wait.Wait()
	}

	run()
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}

func required(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s is required", key)
	}
	return v
}
func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
