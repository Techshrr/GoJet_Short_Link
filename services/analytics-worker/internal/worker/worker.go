package worker

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

const insertEvent = `INSERT IGNORE INTO analytics_events (stream_id,link_id,destination_id,occurred_at,visitor_hash,referer_url,referer_host,source_type,country,region,city,device,browser,operating_system,language,utm_source,utm_medium,utm_campaign,utm_content,utm_term,visit_type,is_bot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
const upsertDaily = `INSERT INTO analytics_daily (link_id,metric_date,clicks,bot_visits) VALUES (?,?,1,?) ON DUPLICATE KEY UPDATE clicks=clicks+1,bot_visits=bot_visits+VALUES(bot_visits)`

type Worker struct {
	redis                   *redis.Client
	db                      *sql.DB
	stream, group, consumer string
	batch                   int64
}

func New(r *redis.Client, db *sql.DB, stream, group, consumer string, batch int64) *Worker {
	return &Worker{redis: r, db: db, stream: stream, group: group, consumer: consumer, batch: batch}
}
func (w *Worker) EnsureGroup(ctx context.Context) error {
	err := w.redis.XGroupCreateMkStream(ctx, w.stream, w.group, "0").Err()
	if err != nil && !stringsContains(err.Error(), "BUSYGROUP") {
		return err
	}
	return nil
}
func stringsContains(value, part string) bool {
	for i := 0; i+len(part) <= len(value); i++ {
		if value[i:i+len(part)] == part {
			return true
		}
	}
	return false
}

func (w *Worker) Run(ctx context.Context) error {
	if err := w.EnsureGroup(ctx); err != nil {
		return err
	}
	for {
		if err := w.consume(ctx); err != nil {
			if errors.Is(err, context.Canceled) {
				return nil
			}
			log.Printf("analytics batch failed: %v", err)
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(time.Second):
			}
		}
	}
}
func (w *Worker) consume(ctx context.Context) error {
	streams, err := w.redis.XReadGroup(ctx, &redis.XReadGroupArgs{Group: w.group, Consumer: w.consumer, Streams: []string{w.stream, ">"}, Count: w.batch, Block: 5 * time.Second}).Result()
	if err == redis.Nil {
		return nil
	}
	if err != nil {
		return err
	}
	for _, stream := range streams {
		for _, message := range stream.Messages {
			if err := w.process(ctx, message); err != nil {
				w.recordFailure(ctx, message.ID, err)
				continue
			}
			if err := w.redis.XAck(ctx, w.stream, w.group, message.ID).Err(); err != nil {
				return err
			}
		}
	}
	return nil
}
func (w *Worker) process(ctx context.Context, message redis.XMessage) error {
	event, err := ParseEvent(message)
	if err != nil {
		return err
	}
	tx, err := w.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, insertEvent, event.StreamID, event.LinkID, event.DestinationID, event.OccurredAt.UTC(), event.VisitorHash, null(event.RefererURL), null(event.RefererHost), event.SourceType, null(event.Country), null(event.Region), null(event.City), event.Device, event.Browser, event.OperatingSystem, null(event.Language), null(event.UTMSource), null(event.UTMMedium), null(event.UTMCampaign), null(event.UTMContent), null(event.UTMTerm), event.VisitType, event.IsBot)
	if err != nil {
		return err
	}
	inserted, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if inserted == 1 {
		bot := 0
		if event.IsBot {
			bot = 1
		}
		if _, err = tx.ExecContext(ctx, upsertDaily, event.LinkID, event.OccurredAt.UTC().Format("2006-01-02"), bot); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (w *Worker) recordFailure(ctx context.Context, id string, cause error) {
	_, err := w.db.ExecContext(ctx, `INSERT INTO analytics_worker_failures(stream_id,error_message,attempts) VALUES(?,?,1) ON DUPLICATE KEY UPDATE error_message=VALUES(error_message),attempts=attempts+1,last_failed_at=CURRENT_TIMESTAMP`, id, cause.Error())
	if err != nil {
		log.Printf("record failure %s: %v (original: %v)", id, err, cause)
	}
}
func null(value string) any {
	if value == "" {
		return nil
	}
	return value
}
func (w *Worker) String() string { return fmt.Sprintf("%s/%s/%s", w.stream, w.group, w.consumer) }
