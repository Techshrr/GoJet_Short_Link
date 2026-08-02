package main

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/httpapi"
	"github.com/Techshrr/GoJet_Short_Link/services/redirect-engine/internal/store"
)

func main() {
	address := getenv("REDIS_ADDRESS", "127.0.0.1:6379")
	db, _ := strconv.Atoi(getenv("REDIS_DB", "0"))
	limit, _ := strconv.Atoi(getenv("VISIT_RATE_LIMIT_PER_MINUTE", "60"))
	if limit < 1 {
		log.Fatal("VISIT_RATE_LIMIT_PER_MINUTE must be positive")
	}
	s := store.NewRedis(address, os.Getenv("REDIS_PASSWORD"), db, limit)
	server := &http.Server{Addr: getenv("HTTP_ADDRESS", ":8080"), Handler: httpapi.New(s, required("VISITOR_HASH_KEY")), ReadHeaderTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("redirect engine listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}
func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func required(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s must be configured", key)
	}
	return v
}
