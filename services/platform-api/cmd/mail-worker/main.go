package main

import (
	"context"
	"database/sql"
	appmail "github.com/Techshrr/GoJet_Short_Link/app/mail"
	"github.com/Techshrr/GoJet_Short_Link/app/settings"
	_ "github.com/go-sql-driver/mysql"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	db, err := sql.Open("mysql", required("MYSQL_DSN"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	key, err := settings.DecodeKey(required("SETTINGS_ENCRYPTION_KEY"))
	if err != nil {
		log.Fatal(err)
	}
	store, err := settings.NewStore(db, key)
	if err != nil {
		log.Fatal(err)
	}
	service := appmail.NewService(db, store)
	for {
		select {
		case <-ctx.Done():
			return
		default:
			if err = service.ProcessOne(ctx); err != nil {
				log.Printf("mail delivery failed: %v", err)
			}
			time.Sleep(time.Second)
		}
	}
}
func required(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("%s must be configured", k)
	}
	return v
}
