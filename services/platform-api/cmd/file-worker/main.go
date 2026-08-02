package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/resources"
	_ "github.com/go-sql-driver/mysql"
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
	service := resources.NewFileWorker(db, getenv("FILE_STORAGE_PATH", "/data/files"))
	clamAddress := getenv("CLAMAV_ADDRESS", "clamav:3310")
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	log.Printf("file scanner consuming quarantine with clamd at %s", clamAddress)
	for ctx.Err() == nil {
		item, found, claimErr := service.ClaimFileScan(ctx)
		if claimErr != nil {
			log.Printf("claim file scan: %v", claimErr)
			wait(ctx, 2*time.Second)
			continue
		}
		if !found {
			wait(ctx, time.Second)
			continue
		}
		clean, result, scanErr := resources.ScanClamAV(ctx, clamAddress, service.ScanPath(item))
		if finishErr := service.FinishFileScan(ctx, item.ID, clean, result, scanErr); finishErr != nil {
			log.Printf("persist scan result for file %d: %v", item.ID, finishErr)
		}
	}
}

func wait(ctx context.Context, duration time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(duration):
	}
}

func required(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("%s is required", key)
	}
	return value
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
