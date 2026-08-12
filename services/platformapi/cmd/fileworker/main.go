package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/objectstorage"
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
	fileStore, err := objectstorage.FromEnvironment(context.Background(), getenv("FILE_STORAGE_PATH", "/data/files"))
	if err != nil {
		log.Fatal(err)
	}
	service := resources.NewFileWorker(db, getenv("FILE_STORAGE_PATH", "/data/files")).WithFileStore(fileStore)
	clamEndpoint := strings.TrimSpace(getenv("CLAMAV_ADDRESS", "disabled"))
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if clamEndpoint == "" || clamEndpoint == "disabled" {
		log.Printf("file scanner is disabled because ClamAV is unavailable; file shares will remain quarantined until the scanner is configured")
		for ctx.Err() == nil {
			if _, purgeErr := service.PurgeDeletedFiles(ctx, 100); purgeErr != nil {
				log.Printf("purge deleted files: %v", purgeErr)
			}
			wait(ctx, 30*time.Second)
		}
		return
	}

	log.Printf("file scanner consuming quarantine with clamd at %s", clamEndpoint)
	for ctx.Err() == nil {
		if _, purgeErr := service.PurgeDeletedFiles(ctx, 100); purgeErr != nil {
			log.Printf("purge deleted files: %v", purgeErr)
		}
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
		path, cleanup, materializeErr := service.MaterializeForScan(ctx, item)
		clean, result, scanErr := false, "", materializeErr
		if materializeErr == nil {
			clean, result, scanErr = resources.ScanClamAVEndpoint(ctx, clamEndpoint, path)
		}
		cleanup()
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
