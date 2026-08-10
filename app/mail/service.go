package mail

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"html"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Techshrr/GoJet_Short_Link/app/settings"
)

type Service struct {
	db       *sql.DB
	settings *settings.Store
}

type Template struct {
	ID        int64     `json:"id"`
	Key       string    `json:"key"`
	Name      string    `json:"name"`
	Subject   string    `json:"subject_template"`
	HTML      string    `json:"html_template"`
	Status    string    `json:"status"`
	UpdatedAt time.Time `json:"updated_at"`
}

var templateKey = regexp.MustCompile(`^[a-z][a-z0-9_]{1,79}$`)
var brandColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

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
		err = config.Send(ctx, Message{To: recipient, Subject: "GoJet 邮件服务测试成功", HTML: s.brandWrap(ctx, "<h1>邮件服务可用</h1><p>连接、认证和邮件投递测试均已完成。</p>"), MessageID: fmt.Sprintf("gojet-test-%d@%s", time.Now().UnixNano(), config.Host)})
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
func (s *Service) Queue(ctx context.Context, kind, to, subject, body string) (int64, error) {
	return s.queue(ctx, kind, "", to, subject, body)
}

func (s *Service) queue(ctx context.Context, kind, dedupeKey, to, subject, body string) (int64, error) {
	to = strings.TrimSpace(to)
	if to == "" || !strings.Contains(to, "@") {
		return 0, errors.New("邮件收件地址无效")
	}
	if dedupeKey == "" {
		result, err := s.db.ExecContext(ctx, `INSERT INTO mail_messages(message_type,recipient,subject,body_html) VALUES(?,?,?,?)`, kind, to, subject, body)
		if err != nil {
			return 0, err
		}
		return result.LastInsertId()
	}
	dedupeKey = strings.TrimSpace(dedupeKey)
	if len(dedupeKey) > 190 {
		return 0, errors.New("邮件事件去重键过长")
	}
	result, err := s.db.ExecContext(ctx, `INSERT IGNORE INTO mail_messages(message_type,dedupe_key,recipient,subject,body_html) VALUES(?,?,?,?,?)`, kind, dedupeKey, to, subject, body)
	if err != nil {
		return 0, err
	}
	if changed, _ := result.RowsAffected(); changed == 1 {
		return result.LastInsertId()
	}
	var id int64
	if err = s.db.QueryRowContext(ctx, `SELECT id FROM mail_messages WHERE dedupe_key=?`, dedupeKey).Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Service) QueueTemplate(ctx context.Context, key, to string, values map[string]string) (int64, error) {
	values = s.enrichTemplateValues(ctx, key, to, values)
	subject, body, err := s.renderTemplate(ctx, key, values)
	if err != nil {
		return 0, err
	}
	return s.queue(ctx, key, "", to, subject, body)
}

func (s *Service) QueueTemplateOnce(ctx context.Context, key, dedupeKey, to string, values map[string]string) (int64, error) {
	values = s.enrichTemplateValues(ctx, key, to, values)
	subject, body, err := s.renderTemplate(ctx, key, values)
	if err != nil {
		return 0, err
	}
	return s.queue(ctx, key, dedupeKey, to, subject, body)
}

func (s *Service) renderTemplate(ctx context.Context, key string, values map[string]string) (string, string, error) {
	var subject, body string
	if err := s.db.QueryRowContext(ctx, `SELECT subject_template,html_template FROM mail_templates WHERE template_key=? AND status='active'`, key).Scan(&subject, &body); err != nil {
		return "", "", err
	}
	for name, value := range values {
		placeholder := "{{" + name + "}}"
		subject = strings.ReplaceAll(subject, placeholder, strings.ReplaceAll(strings.ReplaceAll(value, "\r", ""), "\n", ""))
		body = strings.ReplaceAll(body, placeholder, html.EscapeString(value))
	}
	if strings.Contains(subject, "{{") || strings.Contains(body, "{{") {
		return "", "", errors.New("邮件模板仍有未填写内容")
	}
	return subject, s.brandWrap(ctx, body), nil
}

func (s *Service) brandWrap(ctx context.Context, body string) string {
	get := func(key, fallback string) string {
		value, exists, err := s.settings.Get(ctx, key)
		if err != nil || !exists || strings.TrimSpace(value) == "" {
			return fallback
		}
		return strings.Trim(strings.TrimSpace(value), `"`)
	}
	site := get("site.name", "GoJet")
	primary := get("brand.primary_color", "#16A66A")
	if !brandColor.MatchString(primary) {
		primary = "#16A66A"
	}
	logo := get("brand.mail_logo_url", "")
	support := get("site.support_email", "")
	brand := `<div style="font-size:24px;font-weight:800;letter-spacing:-.6px;color:#101828">` + html.EscapeString(site) + `<span style="color:` + primary + `">.</span></div>`
	if logo != "" {
		brand = `<img src="` + html.EscapeString(logo) + `" alt="` + html.EscapeString(site) + `" style="display:block;max-height:38px;max-width:180px">`
	}
	footer := `此邮件由 ` + html.EscapeString(site) + ` 自动发送。`
	if support != "" {
		footer += ` 如需帮助，请联系 ` + html.EscapeString(support) + `。`
	}
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f6f8f7;color:#17211c;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}.wrap{max-width:640px;margin:0 auto;padding:36px 18px}.card{margin-top:20px;background:#fff;border:1px solid #e3e9e6;border-radius:18px;padding:32px;box-shadow:0 16px 45px rgba(16,24,40,.06)}h1{margin:0 0 20px;font-size:25px;line-height:1.35;color:#101828}p{margin:12px 0;line-height:1.8}.button{display:inline-block;margin:10px 0;padding:12px 20px;border-radius:10px;background:` + primary + `;color:#fff!important;text-decoration:none;font-weight:700}.muted{color:#667085;font-size:13px;word-break:break-all}.footer{padding:20px 4px;color:#98a2b3;font-size:12px;line-height:1.7}@media(max-width:520px){.wrap{padding:22px 12px}.card{padding:24px 20px}}</style></head><body><div class="wrap">` + brand + `<div class="card">` + body + `</div><div class="footer">` + footer + `</div></div></body></html>`
}

func (s *Service) Templates(ctx context.Context) ([]Template, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,template_key,name,subject_template,html_template,status,updated_at FROM mail_templates ORDER BY template_key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Template{}
	for rows.Next() {
		var item Template
		if err = rows.Scan(&item.ID, &item.Key, &item.Name, &item.Subject, &item.HTML, &item.Status, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) SaveTemplate(ctx context.Context, item Template) error {
	item.Key = strings.TrimSpace(item.Key)
	item.Name = strings.TrimSpace(item.Name)
	item.Subject = strings.TrimSpace(item.Subject)
	item.HTML = strings.TrimSpace(item.HTML)
	if !templateKey.MatchString(item.Key) || item.Name == "" || len(item.Name) > 120 || item.Subject == "" || len(item.Subject) > 255 || item.HTML == "" || len(item.HTML) > 1_000_000 || (item.Status != "active" && item.Status != "disabled") {
		return errors.New("邮件模板字段无效")
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO mail_templates(template_key,name,subject_template,html_template,status) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),subject_template=VALUES(subject_template),html_template=VALUES(html_template),status=VALUES(status)`, item.Key, item.Name, item.Subject, item.HTML, item.Status)
	return err
}
func (s *Service) ProcessOne(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var id int64
	var to, subject, body string
	err = tx.QueryRowContext(ctx, `SELECT id,recipient,subject,body_html FROM mail_messages WHERE status IN ('pending','failed') AND available_at<=NOW() AND attempts<5 ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`).Scan(&id, &to, &subject, &body)
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
	sendErr := config.Send(ctx, Message{To: to, Subject: subject, HTML: body, MessageID: messageID})
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
