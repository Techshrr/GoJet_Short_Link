package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/logstore"
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
	store := logstore.New(db)
	token := required("LOG_INGEST_TOKEN")
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("POST /v1/logs", func(w http.ResponseWriter, r *http.Request) {
		if subtleToken(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "), token) == false {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		body, readErr := io.ReadAll(http.MaxBytesReader(w, r.Body, logstore.MaxBatchBytes))
		if readErr != nil {
			http.Error(w, "batch too large", http.StatusRequestEntityTooLarge)
			return
		}
		count, ingestErr := store.Ingest(r.Context(), body)
		if ingestErr != nil {
			http.Error(w, ingestErr.Error(), http.StatusUnprocessableEntity)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]int{"accepted": count})
	})
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			for {
				n, e := store.Purge(context.Background(), 1000)
				if e != nil || n < 1000 {
					break
				}
			}
		}
	}()
	address := getenv("LOG_RECEIVER_HTTP_ADDRESS", ":8092")
	log.Printf("structured log receiver listening on %s", address)
	log.Fatal((&http.Server{Addr: address, Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second}).ListenAndServe())
}

func subtleToken(a, b string) bool {
	return a != "" && subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
func required(key string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	log.Fatalf("%s is required", key)
	return ""
}
func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
