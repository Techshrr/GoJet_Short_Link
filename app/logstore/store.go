package logstore

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"time"
)

const MaxBatchBytes = 1 << 20

type Record struct {
	Timestamp  string `json:"timestamp"`
	Service    string `json:"service"`
	Level      string `json:"level"`
	Event      string `json:"event"`
	RequestID  string `json:"request_id"`
	Status     *int   `json:"status"`
	DurationMS *int64 `json:"duration_ms"`
}

type Store struct{ db *sql.DB }

func New(db *sql.DB) *Store { return &Store{db: db} }

func (s *Store) Ingest(ctx context.Context, payload []byte) (int, error) {
	if len(payload) == 0 || len(payload) > MaxBatchBytes {
		return 0, errors.New("log batch must contain 1 byte to 1MB")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	scanner := bufio.NewScanner(bytes.NewReader(payload))
	scanner.Buffer(make([]byte, 64*1024), 256*1024)
	count := 0
	for scanner.Scan() {
		if count >= 1000 {
			return 0, errors.New("log batch exceeds 1000 records")
		}
		line := append([]byte(nil), scanner.Bytes()...)
		var record Record
		if json.Unmarshal(line, &record) != nil || !json.Valid(line) {
			return 0, errors.New("invalid NDJSON record")
		}
		occurred, parseErr := time.Parse(time.RFC3339Nano, record.Timestamp)
		if parseErr != nil || record.Service == "" || len(record.Service) > 80 || record.Event == "" || len(record.Event) > 120 || !validLevel(record.Level) || len(record.RequestID) > 64 {
			return 0, errors.New("invalid structured log fields")
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO structured_logs(occurred_at,service,level,event,request_id,status_code,duration_ms,payload) VALUES(?,?,?,?,NULLIF(?,''),?,?,?)`, occurred.UTC(), record.Service, record.Level, record.Event, record.RequestID, record.Status, record.DurationMS, line); err != nil {
			return 0, err
		}
		count++
	}
	if err = scanner.Err(); err != nil && !errors.Is(err, io.EOF) {
		return 0, err
	}
	if count == 0 {
		return 0, errors.New("empty NDJSON batch")
	}
	return count, tx.Commit()
}

func (s *Store) Purge(ctx context.Context, batch int) (int64, error) {
	if batch < 1 || batch > 10000 {
		batch = 1000
	}
	result, err := s.db.ExecContext(ctx, `DELETE FROM structured_logs WHERE occurred_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL (SELECT retention_days FROM log_retention_policy WHERE id=1) DAY) ORDER BY occurred_at LIMIT ?`, batch)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func validLevel(level string) bool {
	return level == "debug" || level == "info" || level == "warn" || level == "error"
}
