package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type overviewPoint struct {
	Date   string `json:"date"`
	Clicks int64  `json:"clicks"`
}

func (s *server) workspaceOverview(w http.ResponseWriter, r *http.Request) {
	wid, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid workspace"})
		return
	}
	if _, err = s.workspace.Role(r.Context(), wid, currentUser(r).ID); err != nil {
		jsonResponse(w, 403, map[string]string{"error": "forbidden"})
		return
	}
	usage, err := s.billing.Usage(r.Context(), wid)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "套餐用量暂时不可用"})
		return
	}
	var activeLinks int64
	if err = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM short_links WHERE workspace_id=? AND status='active' AND deleted_at IS NULL`, wid).Scan(&activeLinks); err != nil {
		jsonResponse(w, 503, map[string]string{"error": "总览暂时不可用"})
		return
	}
	rows, err := s.db.QueryContext(r.Context(), `SELECT id FROM short_links WHERE workspace_id=? AND deleted_at IS NULL`, wid)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "总览暂时不可用"})
		return
	}
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			jsonResponse(w, 503, map[string]string{"error": "总览暂时不可用"})
			return
		}
		ids = append(ids, id)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		jsonResponse(w, 503, map[string]string{"error": "总览暂时不可用"})
		return
	}
	rows.Close()

	now := time.Now().UTC()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	today := s.workspaceRealtimeToday(r.Context(), ids, todayStart)
	month, uniques := int64(0), int64(0)
	uniqueKeys := make([]string, 0, len(ids))
	for _, id := range ids {
		uniqueKeys = append(uniqueKeys, fmt.Sprintf("gojet:visitors-month:%d:%s", id, now.Format("2006-01")))
	}
	if len(uniqueKeys) > 0 {
		uniques, _ = s.redis.PFCount(r.Context(), uniqueKeys...).Result()
		placeholders, args := analyticsLinkFilter(ids)
		monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		args = append(args, monthStart, todayStart)
		if err = s.db.QueryRowContext(r.Context(), `SELECT COALESCE(SUM(clicks),0) FROM analytics_daily WHERE link_id IN (`+placeholders+`) AND metric_date>=? AND metric_date<?`, args...).Scan(&month); err != nil {
			jsonResponse(w, 503, map[string]string{"error": "本月访问统计暂时不可用"})
			return
		}
	}
	month += today

	trend := make([]overviewPoint, 30)
	start := todayStart.AddDate(0, 0, -29)
	for i := range trend {
		trend[i].Date = start.AddDate(0, 0, i).Format("2006-01-02")
	}
	if len(ids) > 0 {
		placeholders, args := analyticsLinkFilter(ids)
		args = append(args, start, todayStart)
		tr, queryErr := s.db.QueryContext(r.Context(), `SELECT metric_date,SUM(clicks) FROM analytics_daily WHERE link_id IN (`+placeholders+`) AND metric_date>=? AND metric_date<? GROUP BY metric_date ORDER BY metric_date`, args...)
		if queryErr != nil {
			jsonResponse(w, 503, map[string]string{"error": "访问趋势暂时不可用"})
			return
		}
		for tr.Next() {
			var day time.Time
			var count int64
			if scanErr := tr.Scan(&day, &count); scanErr != nil {
				tr.Close()
				jsonResponse(w, 503, map[string]string{"error": "访问趋势暂时不可用"})
				return
			}
			date := day.UTC().Format("2006-01-02")
			for i := range trend {
				if trend[i].Date == date {
					trend[i].Clicks = count
					break
				}
			}
		}
		if queryErr = tr.Err(); queryErr != nil {
			tr.Close()
			jsonResponse(w, 503, map[string]string{"error": "访问趋势暂时不可用"})
			return
		}
		tr.Close()
	}
	trend[len(trend)-1].Clicks = today

	recent := []map[string]any{}
	rr, err := s.db.QueryContext(r.Context(), `SELECT id,code,title,destination,status,created_at FROM short_links WHERE workspace_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`, wid)
	if err != nil {
		jsonResponse(w, 503, map[string]string{"error": "最近链接暂时不可用"})
		return
	}
	for rr.Next() {
		var id int64
		var code, title, destination, status string
		var created time.Time
		if err = rr.Scan(&id, &code, &title, &destination, &status, &created); err != nil {
			rr.Close()
			jsonResponse(w, 503, map[string]string{"error": "最近链接暂时不可用"})
			return
		}
		var persistedClicks int64
		if err = s.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM analytics_events WHERE link_id=?`, strconv.FormatInt(id, 10)).Scan(&persistedClicks); err != nil {
			rr.Close()
			jsonResponse(w, 503, map[string]string{"error": "最近链接暂时不可用"})
			return
		}
		realtimeClicks, redisErr := s.redis.Get(r.Context(), fmt.Sprintf("gojet:clicks:%d", id)).Int64()
		if redisErr != nil {
			realtimeClicks = 0
		}
		clicks := maxInt64(realtimeClicks, persistedClicks)
		recent = append(recent, map[string]any{"id": id, "code": code, "title": title, "destination": destination, "status": status, "created_at": created.UTC().Format(time.RFC3339), "clicks": clicks})
	}
	if err = rr.Err(); err != nil {
		rr.Close()
		jsonResponse(w, 503, map[string]string{"error": "最近链接暂时不可用"})
		return
	}
	rr.Close()

	anomalies := []map[string]string{}
	ar, err := s.db.QueryContext(r.Context(), `SELECT kind,message FROM (SELECT 'domain' kind,CONCAT(hostname,'：',COALESCE(last_error,'验证异常')) message,updated_at happened FROM custom_domains WHERE workspace_id=? AND status='error' UNION ALL SELECT 'file',CONCAT(original_name,'：',COALESCE(scan_result,'扫描异常')),updated_at FROM file_shares WHERE workspace_id=? AND scan_status IN ('infected','error')) x ORDER BY happened DESC LIMIT 5`, wid, wid)
	if err == nil {
		for ar.Next() {
			var kind, message string
			if ar.Scan(&kind, &message) == nil {
				anomalies = append(anomalies, map[string]string{"type": kind, "message": message})
			}
		}
		ar.Close()
	}

	jsonResponse(w, 200, map[string]any{
		"today_clicks":    today,
		"month_clicks":    month,
		"unique_visitors": uniques,
		"active_links":    activeLinks,
		"usage":           usage,
		"trend":           trend,
		"recent":          recent,
		"anomalies":       anomalies,
		"generated_at":    now.Format(time.RFC3339),
		"source":          "redis-realtime+mysql-history",
	})
}
