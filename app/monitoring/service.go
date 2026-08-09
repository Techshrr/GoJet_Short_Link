package monitoring

import (
	"context"
	"database/sql"
	"fmt"
	"html"
	"strings"
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
