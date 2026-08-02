//go:build integration

package main

import (
	"context"
	"os"
	"testing"

	"github.com/redis/go-redis/v9"
)

func TestDeadLetterRequeueIsIdempotentInRealRedis(t *testing.T) {
	ctx := context.Background()
	address := os.Getenv("INTEGRATION_REDIS_ADDRESS")
	if address == "" {
		address = "127.0.0.1:6399"
	}
	rdb := redis.NewClient(&redis.Options{Addr: address})
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("real Redis unavailable: %v", err)
	}
	stream, key := "integration:requeue", "integration:requeue-key"
	defer rdb.Del(ctx, stream, key)
	args := []any{"link_id", "9", "timestamp", "2026-08-02T12:00:00Z"}
	first, err := requeueDeadLetter.Run(ctx, rdb, []string{stream, key}, args...).Text()
	if err != nil {
		t.Fatal(err)
	}
	second, err := requeueDeadLetter.Run(ctx, rdb, []string{stream, key}, args...).Text()
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatalf("duplicate requeue IDs: %s != %s", first, second)
	}
	length, err := rdb.XLen(ctx, stream).Result()
	if err != nil {
		t.Fatal(err)
	}
	if length != 1 {
		t.Fatalf("duplicate Stream events: %d", length)
	}
}
