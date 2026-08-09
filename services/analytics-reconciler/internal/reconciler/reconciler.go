package reconciler

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Result struct {
	Checked, Consistent, WorkerLag, RedisRepaired int64
}

type Reconciler struct {
	redis *redis.Client
	db    *sql.DB
	batch int
}

func New(r *redis.Client, db *sql.DB, batch int) *Reconciler {
	if batch < 1 || batch > 5000 {
		batch = 500
	}
	return &Reconciler{redis: r, db: db, batch: batch}
}

var raiseCounter = redis.NewScript(`
local current=tonumber(redis.call('GET',KEYS[1]) or '0')
local target=tonumber(ARGV[1])
if current < target then redis.call('SET',KEYS[1],target); return target end
return current`)

func (r *Reconciler) RunOnce(ctx context.Context) (Result, error) {
	cursor, err := r.redis.Get(ctx, "gojet:reconcile:cursor").Int64()
	if err == redis.Nil {
		cursor = 0
	} else if err != nil {
		return Result{}, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT id FROM short_links WHERE id>? ORDER BY id LIMIT ?`, cursor, r.batch)
	if err != nil {
		return Result{}, err
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			return Result{}, err
		}
		ids = append(ids, id)
	}
	if err = rows.Err(); err != nil {
		return Result{}, err
	}
	result := Result{}
	for _, id := range ids {
		if err = r.checkLink(ctx, id, &result); err != nil {
			return result, err
		}
		cursor = id
	}
	if len(ids) < r.batch {
		cursor = 0
	}
	if err = r.redis.Set(ctx, "gojet:reconcile:cursor", cursor, 0).Err(); err != nil {
		return result, err
	}
	return result, nil
}

func (r *Reconciler) checkLink(ctx context.Context, id int64, result *Result) error {
	key := "gojet:clicks:" + fmt.Sprint(id)
	redisClicks, err := r.redis.Get(ctx, key).Int64()
	if err == redis.Nil {
		redisClicks = 0
	} else if err != nil {
		return err
	}
	var mysqlClicks int64
	if err = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM analytics_events WHERE link_id=?`, id).Scan(&mysqlClicks); err != nil {
		return err
	}
	result.Checked++
	status, detail := "consistent", ""
	delta := redisClicks - mysqlClicks
	if mysqlClicks > redisClicks {
		actual, err := raiseCounter.Run(ctx, r.redis, []string{key}, mysqlClicks).Int64()
		if err != nil {
			return err
		}
		redisClicks = actual
		delta = redisClicks - mysqlClicks
		if actual == mysqlClicks {
			status = "redis_repaired"
			detail = "Redis 实时计数低于已持久化事件，已执行只增不减补偿"
			result.RedisRepaired++
		} else {
			status = "worker_lag"
			detail = "补偿期间产生新访问，Redis 仍领先 MySQL，等待 Stream Worker 补写"
			result.WorkerLag++
		}
	} else if redisClicks > mysqlClicks {
		status = "worker_lag"
		detail = "Redis 实时计数领先 MySQL，等待 Stream Worker 自动认领并补写"
		result.WorkerLag++
	} else {
		result.Consistent++
	}
	_, err = r.db.ExecContext(ctx, `INSERT INTO analytics_reconciliation(link_id,redis_clicks,mysql_clicks,delta,status,detail,checked_at,first_mismatch_at,resolved_at) VALUES(?,?,?,?,?,?,NOW(),IF(?='consistent',NULL,NOW()),IF(?='consistent',NOW(),NULL)) ON DUPLICATE KEY UPDATE redis_clicks=VALUES(redis_clicks),mysql_clicks=VALUES(mysql_clicks),delta=VALUES(delta),detail=VALUES(detail),first_mismatch_at=IF(VALUES(status)='consistent',NULL,COALESCE(first_mismatch_at,NOW())),resolved_at=IF(VALUES(status)='consistent',IF(status<>'consistent',NOW(),resolved_at),NULL),status=VALUES(status),checked_at=NOW()`, id, redisClicks, mysqlClicks, delta, status, detail, status, status)
	return err
}

func (r *Reconciler) Run(ctx context.Context, interval time.Duration) error {
	if interval < time.Second {
		interval = time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		if _, err := r.RunOnce(ctx); err != nil {
			return err
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}
