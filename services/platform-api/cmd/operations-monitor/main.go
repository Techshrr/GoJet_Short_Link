package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/monitoring"
	_ "github.com/go-sql-driver/mysql"
)

func main() {
	db, err := sql.Open("mysql", required("MYSQL_DSN"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	interval, _ := strconv.Atoi(value("OPERATIONS_MONITOR_INTERVAL_SECONDS", "60"))
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
