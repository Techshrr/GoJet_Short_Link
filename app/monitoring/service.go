package monitoring

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"html"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Service struct {
	db        *sql.DB
	recipient string
}

type check struct {
	key, category, severity, title, query string
	threshold                             int64
}

var checks = []check{
	{key: "mail.failed", category: "mail", severity: "critical", title: "邮件投递连续失败", query: `SELECT COUNT(*) FROM mail_messages WHERE status='failed' AND attempts>=5`, threshold: 0},
	{key: "analytics.dead_letters", category: "analytics", severity: "critical", title: "分析事件进入死信", query: `SELECT COUNT(*) FROM analytics_worker_failures WHERE state='dead_letter'`, threshold: 0},
	{key: "analytics.worker_lag", category: "analytics", severity: "warning", title: "分析 Worker 数据积压", query: `SELECT COUNT(*) FROM analytics_reconciliation WHERE status='worker_lag'`, threshold: 10},
	{key: "files.scan_errors", category: "files", severity: "critical", title: "文件安全扫描失败", query: `SELECT COUNT(*) FROM file_shares WHERE scan_status='error'`, threshold: 0},
}

// RuntimeHeartbeat is the shared, server-authoritative service liveness contract.
// Every long-running GoJet process publishes the same shape to Redis. Admin reads
// this evidence instead of inventing a healthy state from an expected-service list.
type RuntimeHeartbeat struct {
	Service   string    `json:"service"`
	Version   string    `json:"version"`
	PID       int       `json:"pid"`
	StartedAt time.Time `json:"started_at"`
	LastSeen  time.Time `json:"last_seen_at"`
}

func RuntimeHeartbeatKey(service string) string { return "gojet:runtime:heartbeat:" + service }

func RuntimeVersion() string {
	if value := strings.TrimSpace(os.Getenv("GOJET_VERSION")); value != "" { return value }
	for _, path := range []string{"VERSION", "./VERSION", "/opt/gojet/VERSION"} {
		if data, err := os.ReadFile(path); err == nil {
			if value := strings.TrimSpace(string(data)); value != "" { return value }
		}
	}
	return "unknown"
}

// StartRuntimeHeartbeat writes immediately and every 15 seconds. A 45 second TTL
// means an abruptly stopped service disappears without requiring a cleanup hook.
func StartRuntimeHeartbeat(ctx context.Context, rdb *redis.Client, service string) {
	if rdb == nil || strings.TrimSpace(service) == "" { return }
	started := time.Now().UTC()
	publish := func() {
		now := time.Now().UTC()
		body, err := json.Marshal(RuntimeHeartbeat{Service: service, Version: RuntimeVersion(), PID: os.Getpid(), StartedAt: started, LastSeen: now})
		if err != nil { return }
		writeCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		_ = rdb.Set(writeCtx, RuntimeHeartbeatKey(service), body, 45*time.Second).Err()
		cancel()
	}
	publish()
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				publish()
			}
		}
	}()
}

func ReadRuntimeHeartbeat(ctx context.Context, rdb *redis.Client, service string) (RuntimeHeartbeat, error) {
	var heartbeat RuntimeHeartbeat
	if rdb == nil { return heartbeat, redis.Nil }
	value, err := rdb.Get(ctx, RuntimeHeartbeatKey(service)).Result()
	if err != nil { return heartbeat, err }
	if err = json.Unmarshal([]byte(value), &heartbeat); err != nil { return RuntimeHeartbeat{}, err }
	return heartbeat, nil
}

func New(db *sql.DB, recipient string) *Service {
	return &Service{db: db, recipient: strings.TrimSpace(recipient)}
}

func (s *Service) Run(ctx context.Context) error {
	for _, item := range checks {
		var value int64
		if err := s.db.QueryRowContext(ctx, item.query).Scan(&value); err != nil {
			return fmt.Errorf("check %s: %w", item.key, err)
		}
		if value > item.threshold {
			if err := s.open(ctx, item, value); err != nil {
				return err
			}
		} else if _, err := s.db.ExecContext(ctx, `UPDATE system_alerts SET status='resolved',resolved_at=NOW(),last_seen_at=NOW(),observed_value=? WHERE alert_key=? AND status IN ('open','acknowledged')`, value, item.key); err != nil {
			return fmt.Errorf("resolve %s: %w", item.key, err)
		}
	}
	return nil
}

func (s *Service) open(ctx context.Context, item check, value int64) error {
	message := fmt.Sprintf("当前值 %d，告警阈值 %d。请在管理后台系统诊断中处理。", value, item.threshold)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id int64
	var status string
	var notified sql.NullString
	err = tx.QueryRowContext(ctx, `SELECT id,status,CAST(notified_at AS CHAR) FROM system_alerts WHERE alert_key=? FOR UPDATE`, item.key).Scan(&id, &status, &notified)
	if err == sql.ErrNoRows {
		result, insertErr := tx.ExecContext(ctx, `INSERT INTO system_alerts(alert_key,category,severity,title,message,observed_value,threshold_value) VALUES(?,?,?,?,?,?,?)`, item.key, item.category, item.severity, item.title, message, value, item.threshold)
		if insertErr != nil {
			return insertErr
		}
		id, _ = result.LastInsertId()
		status = "open"
	} else if err != nil {
		return err
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE system_alerts SET status=IF(status='resolved','open',status),resolved_at=NULL,first_seen_at=IF(status='resolved',NOW(),first_seen_at),last_seen_at=NOW(),message=?,observed_value=?,threshold_value=? WHERE id=?`, message, value, item.threshold, id)
		if err != nil {
			return err
		}
	}
	if s.recipient != "" && (!notified.Valid || status == "resolved") {
		body := "<h1>" + html.EscapeString(item.title) + "</h1><p>" + html.EscapeString(message) + "</p><p>告警编号：" + html.EscapeString(item.key) + "</p>"
		if _, err = tx.ExecContext(ctx, `INSERT INTO mail_messages(message_type,recipient,subject,body_html) VALUES('system_alert',?,?,?)`, s.recipient, "[GoJet "+item.severity+"] "+item.title, body); err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE system_alerts SET notified_at=NOW() WHERE id=?`, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}
