//go:build integration

package worker

import (
	"context"
	"os"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/redis/go-redis/v9"
)

func TestRedisAutoClaimRecoversCrashedConsumer(t *testing.T) {
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
	_ = rdb.FlushDB(ctx).Err()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	stream, group := "integration:events", "integration-mysql"
	w := New(rdb, db, stream, group, "recovery-worker", 10)
	w.claimIdle = time.Millisecond
	if err = w.EnsureGroup(ctx); err != nil {
		t.Fatal(err)
	}
	id, err := rdb.XAdd(ctx, &redis.XAddArgs{Stream: stream, Values: map[string]any{"link_id": "77", "destination_id": "primary", "timestamp": "2026-08-02T12:00:00Z", "visitor_hash": "hash", "source_type": "direct", "device": "desktop", "browser": "chrome", "operating_system": "linux", "visit_type": "redirect", "is_bot": "false"}}).Result()
	if err != nil {
		t.Fatal(err)
	}
	if _, err = rdb.XReadGroup(ctx, &redis.XReadGroupArgs{Group: group, Consumer: "crashed-worker", Streams: []string{stream, ">"}, Count: 1}).Result(); err != nil {
		t.Fatal(err)
	}
	time.Sleep(5 * time.Millisecond)
	mock.ExpectBegin()
	insert := mock.ExpectExec(regexp.QuoteMeta(insertEvent))
	insert.WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(regexp.QuoteMeta(upsertDaily)).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()
	mock.ExpectExec("UPDATE analytics_worker_failures SET state='resolved'").WithArgs(id).WillReturnResult(sqlmock.NewResult(0, 0))
	if err = w.consume(ctx); err != nil {
		t.Fatal(err)
	}
	summary, err := rdb.XPending(ctx, stream, group).Result()
	if err != nil {
		t.Fatal(err)
	}
	if summary.Count != 0 {
		t.Fatalf("pending events after recovery: %d", summary.Count)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
