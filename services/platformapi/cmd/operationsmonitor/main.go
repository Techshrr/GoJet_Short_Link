package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/destinationrisk"
	"github.com/Techshrr/GoJet_Short_Link/app/monitoring"
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

func main() {
	db, err := sql.Open("mysql", required("MYSQL_DSN"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		log.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: value("REDIS_ADDRESS", "redis:6379"), Password: os.Getenv("REDIS_PASSWORD")})
	defer rdb.Close()
	if err = rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatal(err)
	}

	riskStore := destinationrisk.NewStore(db)
	riskScanner := newDestinationRiskScanner()
	bootstrapCtx, bootstrapCancel := context.WithTimeout(context.Background(), 15*time.Second)
	if err = destinationrisk.BackfillRedis(bootstrapCtx, db, rdb); err != nil {
		log.Printf("destination risk cache backfill: %v", err)
	}
	bootstrapCancel()
	go runRiskLoop(context.Background(), riskStore, riskScanner, rdb)

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

// newDestinationRiskScanner is deliberately small and directly tested. The
// production worker must always use ProviderFromEnvironment so generic semantic
// detection remains active even when no external reputation service is set.
func newDestinationRiskScanner() *destinationrisk.Scanner {
	return destinationrisk.New(destinationrisk.ProviderFromEnvironment())
}

func runRiskLoop(ctx context.Context, store *destinationrisk.Store, scanner *destinationrisk.Scanner, rdb *redis.Client) {
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
					assessment := scanner.Assess(scanCtx, targets)
					scanCancel()
					if err := store.Save(ctx, item.LinkID, targets, assessment); err != nil {
						log.Printf("destination risk save link=%d: %v", item.LinkID, err)
						continue
					}
					if err := destinationrisk.SyncDecision(ctx, rdb, item.LinkID, targets, assessment.Decision); err != nil {
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
