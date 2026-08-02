package main

import (
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
	ids := []string{}
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			ids = append(ids, strconv.FormatInt(id, 10))
		}
	}
	rows.Close()
	now := time.Now().UTC()
	today, month, uniques := int64(0), int64(0), int64(0)
	uniqueKeys := make([]string, 0, len(ids))
	for _, id := range ids {
		n, _ := s.redis.Get(r.Context(), "gojet:daily:"+id+":"+now.Format("2006-01-02")).Int64()
		today += n
		uniqueKeys = append(uniqueKeys, "gojet:visitors-month:"+id+":"+now.Format("2006-01"))
	}
	if len(uniqueKeys) > 0 {
		uniques, _ = s.redis.PFCount(r.Context(), uniqueKeys...).Result()
	}
	_ = s.db.QueryRowContext(r.Context(), `SELECT COALESCE(SUM(a.clicks),0) FROM analytics_daily a JOIN short_links l ON CAST(l.id AS CHAR)=a.link_id WHERE l.workspace_id=? AND a.metric_date>=DATE_FORMAT(UTC_DATE(),'%Y-%m-01') AND a.metric_date<UTC_DATE()`, wid).Scan(&month)
	month += today
	trend := make([]overviewPoint, 30)
	start := now.Truncate(24*time.Hour).AddDate(0, 0, -29)
	for i := range trend {
		trend[i].Date = start.AddDate(0, 0, i).Format("2006-01-02")
	}
	tr, err := s.db.QueryContext(r.Context(), `SELECT a.metric_date,SUM(a.clicks) FROM analytics_daily a JOIN short_links l ON CAST(l.id AS CHAR)=a.link_id WHERE l.workspace_id=? AND a.metric_date>=? AND a.metric_date<UTC_DATE() GROUP BY a.metric_date`, wid, start.Format("2006-01-02"))
	if err == nil {
		for tr.Next() {
			var d string
			var n int64
			if tr.Scan(&d, &n) == nil {
				for i := range trend {
					if trend[i].Date == d {
						trend[i].Clicks = n
						break
					}
				}
			}
		}
		tr.Close()
	}
	trend[len(trend)-1].Clicks = today
	recent := []map[string]any{}
	rr, err := s.db.QueryContext(r.Context(), `SELECT id,code,title,destination,status,created_at FROM short_links WHERE workspace_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`, wid)
	if err == nil {
		for rr.Next() {
			var id int64
			var code, title, destination, status, created string
			if rr.Scan(&id, &code, &title, &destination, &status, &created) == nil {
				recent = append(recent, map[string]any{"id": id, "code": code, "title": title, "destination": destination, "status": status, "created_at": created})
			}
		}
		rr.Close()
	}
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
	jsonResponse(w, 200, map[string]any{"today_clicks": today, "month_clicks": month, "unique_visitors": uniques, "active_links": activeLinks, "usage": usage, "trend": trend, "recent": recent, "anomalies": anomalies, "generated_at": now.Format(time.RFC3339), "source": "redis-realtime+mysql-history"})
}
