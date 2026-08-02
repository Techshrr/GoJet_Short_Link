package mail

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/settings"
)

type Service struct {
	db       *sql.DB
	settings *settings.Store
}

func NewService(db *sql.DB, s *settings.Store) *Service { return &Service{db: db, settings: s} }
func (s *Service) Config(ctx context.Context) (SMTPConfig, error) {
	get := func(k string) string { v, _, _ := s.settings.Get(ctx, k); return v }
	port, _ := strconv.Atoi(get("mail.port"))
	return SMTPConfig{Host: get("mail.host"), Port: port, Username: get("mail.username"), Password: get("mail.password"), Encryption: get("mail.encryption"), EHLO: get("mail.ehlo"), FromEmail: get("mail.from_email"), FromName: get("mail.from_name"), ReplyTo: get("mail.reply_to")}, nil
}
func (s *Service) Test(ctx context.Context, recipient string, send bool) error {
	config, err := s.Config(ctx)
	if err == nil {
		err = config.Test(ctx)
	}
	if err == nil && send {
		err = config.Send(ctx, Message{To: recipient, Subject: "GoJet SMTP 测试成功", HTML: "<h1>GoJet 邮件服务可用</h1><p>连接、认证和邮件投递测试均已执行。</p>", MessageID: fmt.Sprintf("gojet-test-%d@%s", time.Now().UnixNano(), config.Host)})
	}
	status := "connected"
	if err != nil {
		status = "failed"
	}
	_, dbErr := s.db.ExecContext(ctx, `UPDATE mail_health SET status=?,last_tested_at=NOW(),last_success_at=IF(?='connected',NOW(),last_success_at),last_error=? WHERE singleton_id=1`, status, status, errorText(err))
	if err != nil {
		return err
	}
	return dbErr
}
func (s *Service) Queue(ctx context.Context, kind, to, subject, html string) (int64, error) {
	result, err := s.db.ExecContext(ctx, `INSERT INTO mail_messages(message_type,recipient,subject,body_html) VALUES(?,?,?,?)`, kind, to, subject, html)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}
func (s *Service) ProcessOne(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id int64
	var to, subject, html string
	err = tx.QueryRowContext(ctx, `SELECT id,recipient,subject,body_html FROM mail_messages WHERE status IN ('pending','failed') AND available_at<=NOW() AND attempts<5 ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`).Scan(&id, &to, &subject, &html)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE mail_messages SET status='sending',attempts=attempts+1 WHERE id=?`, id); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	config, _ := s.Config(ctx)
	messageID := fmt.Sprintf("gojet-%d-%d@%s", id, time.Now().UnixNano(), config.Host)
	sendErr := config.Send(ctx, Message{To: to, Subject: subject, HTML: html, MessageID: messageID})
	if sendErr != nil {
		_, err = s.db.ExecContext(ctx, `UPDATE mail_messages SET status='failed',last_error=?,available_at=DATE_ADD(NOW(),INTERVAL LEAST(attempts*5,60) MINUTE) WHERE id=?`, sendErr.Error(), id)
		if err != nil {
			return err
		}
		return sendErr
	}
	_, err = s.db.ExecContext(ctx, `UPDATE mail_messages SET status='sent',message_id=?,sent_at=NOW(),last_error=NULL WHERE id=?`, messageID, id)
	return err
}
func errorText(err error) any {
	if err == nil {
		return nil
	}
	return err.Error()
}
