package main

import (
	"net/http"
)

func (s *server) adminLogSummary(w http.ResponseWriter, r *http.Request) {
	type bucket struct {
		Hour, Service, Level string
		Count                int64
	}
	rows, err := s.db.QueryContext(r.Context(), `SELECT DATE_FORMAT(occurred_at,'%Y-%m-%dT%H:00:00Z'),service,level,COUNT(*) FROM structured_logs WHERE occurred_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR) GROUP BY 1,service,level ORDER BY 1,service,level`)
	if err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法读取日志索引"})
		return
	}
	defer rows.Close()
	buckets := []bucket{}
	for rows.Next() {
		var item bucket
		if err = rows.Scan(&item.Hour, &item.Service, &item.Level, &item.Count); err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法解析日志索引"})
			return
		}
		buckets = append(buckets, item)
	}
	var retention int
	var total, errors24h int64
	if err = s.db.QueryRowContext(r.Context(), `SELECT retention_days,(SELECT COUNT(*) FROM structured_logs),(SELECT COUNT(*) FROM structured_logs WHERE level='error' AND occurred_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR)) FROM log_retention_policy WHERE id=1`).Scan(&retention, &total, &errors24h); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法读取日志保留策略"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"receiver": "mysql-structured-index", "retention_days": retention, "indexed_total": total, "errors_24h": errors24h, "buckets": buckets})
}

func (s *server) adminLogRetention(w http.ResponseWriter, r *http.Request) {
	var input struct {
		RetentionDays int `json:"retention_days"`
	}
	if decode(w, r, &input) != nil {
		return
	}
	if input.RetentionDays < 1 || input.RetentionDays > 365 {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"error": "日志保留天数必须为 1 到 365"})
		return
	}
	if _, err := s.db.ExecContext(r.Context(), `UPDATE log_retention_policy SET retention_days=? WHERE id=1`, input.RetentionDays); err != nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]string{"error": "无法保存日志保留策略"})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"retention_days": input.RetentionDays})
}
