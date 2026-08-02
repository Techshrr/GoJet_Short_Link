//go:build integration

package reconciler

import (
	"context"
	"os"
	"testing"

	"github.com/redis/go-redis/v9"
)

func TestRaiseCounterNeverLowersConcurrentRealtimeValue(t *testing.T) {
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
	key := "integration:counter"
	defer rdb.Del(ctx, key)
	if err := rdb.Set(ctx, key, 12, 0).Err(); err != nil {
		t.Fatal(err)
	}
	value, err := raiseCounter.Run(ctx, rdb, []string{key}, 10).Int64()
	if err != nil {
		t.Fatal(err)
	}
	if value != 12 {
		t.Fatalf("counter lowered to %d", value)
	}
	value, err = raiseCounter.Run(ctx, rdb, []string{key}, 15).Int64()
	if err != nil {
		t.Fatal(err)
	}
	if value != 15 {
		t.Fatalf("counter not repaired: %d", value)
	}
}
