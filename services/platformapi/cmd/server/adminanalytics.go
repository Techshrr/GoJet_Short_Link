package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type dashboardTrendPoint struct {
	Date   string `json:"date"`
	Clicks int64  `json:"clicks"`
}

type dashboardDimension struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func (s *server) realtimeClicksForKeys(ctx context.Context, keys []string) int64 {
	if len(keys) == 0 {
		return 0
	}
	values, err := s.redis.MGet(ctx, keys...).Result()
	if err != nil {
		return 0
	}
	var total int64
	for _, value := range values {
		if value == nil {
			continue
		}
		n, err := strconv.ParseInt(fmt.Sprint(value), 10, 64)
		if err == nil && n > 0 {
			total += n
		}
	}
	return total
}

func (s *server) workspaceRealtimeToday(ctx context.Context, workspaceID int64, linkIDs []int64, day time.Time) int64 {
	keys := make([]string, 0, len(linkIDs))
	for _, id := range linkIDs {
		keys = append(keys, fmt.Sprintf("gojet:daily:%d:%s", id, day.UTC().Format("2006-01-02")))
	}
	realtime := s.realtimeClicksForKeys(ctx, keys)
	var persisted int64
	_ = s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(d.clicks),0) FROM analytics_daily d JOIN short_links l ON CAST(l.id AS CHAR)=d.link_id WHERE l.workspace_id=? AND l.deleted_at IS NULL AND d.metric_date=?`, workspaceID, day.UTC().Format("2006-01-02")).Scan(&persisted)
	return maxInt64(realtime, persisted)
}

func (s *server) adminRealtimeTodayClicks(ctx context.Context, day time.Time) int64 {
	rows, err := s.db.QueryContext(ctx, `SELECT id FROM short_links WHERE deleted_at IS NULL`)
	if err != nil {
		return 0
	}
	defer rows.Close()
	keys := []string{}
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			keys = append(keys, fmt.Sprintf("gojet:daily:%d:%s", id, day.UTC().Format("2006-01-02")))
		}
	}
	realtime := s.realtimeClicksForKeys(ctx, keys)
	var persisted int64
	_ = s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(clicks),0) FROM analytics_daily WHERE metric_date=?`, day.UTC().Format("2006-01-02")).Scan(&persisted)
	return maxInt64(realtime, persisted)
}

func (s *server) dashboardDimension(ctx context.Context, column string, since time.Time) []dashboardDimension {
	allowed := map[string]bool{"source_type": true, "country": true, "device": true, "browser": true}
	if !allowed[column] {
		return []dashboardDimension{}
	}
	query := `SELECT COALESCE(NULLIF(` + column + `,''),'未知'),COUNT(*) FROM analytics_events WHERE occurred_at>=? AND is_bot=0 GROUP BY 1 ORDER BY 2 DESC LIMIT 8`
	rows, err := s.db.QueryContext(ctx, query, since.UTC())
	if err != nil {
		return []dashboardDimension{}
	}
	defer rows.Close()
	items := []dashboardDimension{}
	for rows.Next() {
		var item dashboardDimension
		if rows.Scan(&item.Name, &item.Count) == nil {
			items = append(items, item)
		}
	}
	return items
}

func (s *server) adminAnalyticsOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	start := today.AddDate(0, 0, -29)

	trendMap := map[string]int64{}
	rows, err := s.db.QueryContext(ctx, `SELECT DATE_FORMAT(metric_date,'%Y-%m-%d'),COALESCE(SUM(clicks),0) FROM analytics_daily WHERE metric_date>=? AND metric_date<? GROUP BY metric_date ORDER BY metric_date`, start.Format("2006-01-02"), today.Format("2006-01-02"))
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "访问趋势暂时不可用"})
		return
	}
	for rows.Next() {
		var day string
		var clicks int64
		if rows.Scan(&day, &clicks) == nil {
			trendMap[day] = clicks
		}
	}
	rows.Close()
	todayClicks := s.adminRealtimeTodayClicks(ctx, today)
	trendMap[today.Format("2006-01-02")] = todayClicks
	trend := make([]dashboardTrendPoint, 0, 30)
	for i := 0; i < 30; i++ {
		day := start.AddDate(0, 0, i).Format("2006-01-02")
		trend = append(trend, dashboardTrendPoint{Date: day, Clicks: trendMap[day]})
	}

	var visits30d, unique30d, bots30d int64
	if err = s.db.QueryRowContext(ctx, `SELECT COUNT(*),COUNT(DISTINCT IF(is_bot=0,visitor_hash,NULL)),COALESCE(SUM(is_bot),0) FROM analytics_events WHERE occurred_at>=?`, start).Scan(&visits30d, &unique30d, &bots30d); err != nil && err != sql.ErrNoRows {
		jsonResponse(w, 503, map[string]string{"error": "访问汇总暂时不可用"})
		return
	}

	streamLength, _ := s.redis.XLen(ctx, "gojet:analytics:events").Result()
	pending := int64(0)
	if summary, e := s.redis.XPending(ctx, "gojet:analytics:events", s.analyticsGroup).Result(); e == nil {
		pending = summary.Count
	}
	pipeline := map[string]int64{"stream_length": streamLength, "pending": pending, "retrying": 0, "dead_letters": 0, "reconciliation_lag": 0}
	for key, query := range map[string]string{
		"retrying":           `SELECT COUNT(*) FROM analytics_worker_failures WHERE state='retrying'`,
		"dead_letters":       `SELECT COUNT(*) FROM analytics_worker_failures WHERE state='dead_letter'`,
		"reconciliation_lag": `SELECT COUNT(*) FROM analytics_reconciliation WHERE status='worker_lag'`,
	} {
		var value int64
		if s.db.QueryRowContext(ctx, query).Scan(&value) == nil {
			pipeline[key] = value
		}
	}

	jsonResponse(w, 200, map[string]any{
		"today_clicks":        todayClicks,
		"visits_30d":          visits30d,
		"unique_visitors_30d": unique30d,
		"bot_visits_30d":      bots30d,
		"trend":               trend,
		"sources":             s.dashboardDimension(ctx, "source_type", start),
		"countries":           s.dashboardDimension(ctx, "country", start),
		"devices":             s.dashboardDimension(ctx, "device", start),
		"browsers":            s.dashboardDimension(ctx, "browser", start),
		"pipeline":            pipeline,
		"generated_at":        now,
		"metric_source":       "redis_realtime_mysql_history",
	})
}
