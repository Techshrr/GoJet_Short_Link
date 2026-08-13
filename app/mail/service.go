package mail

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"html"
	"os"
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
		if send {
			// Sending already proves DNS, connection, TLS, authentication, MAIL/RCPT
			// and final DATA acceptance. Do not open a second SMTP session first: on
			// slower relays that doubled the request time and could make nginx return
			// 502 even though the test message had actually been accepted.
			err = config.Send(ctx, Message{To: recipient, Subject: "GoJet 邮件服务测试成功", HTML: s.brandWrap(ctx, "<h1>邮件服务已连接</h1><p>这封邮件表示 SMTP 配置可以正常完成认证和投递。</p>"), MessageID: fmt.Sprintf("gojet-test-%d@%s", time.Now().UnixNano(), config.Host)})
		} else {
			err = config.Test(ctx)
		}
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
	if s == nil || s.settings == nil {
		return body
	}
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
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")), "/")
	logo := get("brand.logo_url", "")
	if strings.HasPrefix(logo, "/") {
		if baseURL != "" {
			logo = baseURL + logo
		} else {
			logo = ""
		}
	}
	support := get("site.support_email", "")
	company := get("site.company_name", site)
	copyright := get("site.copyright", "")
	if copyright == "" {
		copyright = fmt.Sprintf("© %d %s", time.Now().Year(), company)
	}

	brand := `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.4px;color:#142019">` + html.EscapeString(site) + `<span style="color:` + primary + `">.</span></div>`
	if logo != "" {
		brand = `<img src="` + html.EscapeString(logo) + `" alt="` + html.EscapeString(site) + `" width="176" style="display:block;width:auto;max-width:176px;max-height:48px;border:0;outline:none;text-decoration:none">`
	}

	footerLinks := ""
	if baseURL != "" {
		footerLinks += `<a href="` + html.EscapeString(baseURL) + `" style="color:#66736c;text-decoration:none">访问网站</a>`
	}
	if support != "" {
		if footerLinks != "" {
			footerLinks += `<span style="color:#b2bab6"> &nbsp;·&nbsp; </span>`
		}
		footerLinks += `<a href="mailto:` + html.EscapeString(support) + `" style="color:#66736c;text-decoration:none">联系支持</a>`
	}
	if footerLinks != "" {
		footerLinks = `<div style="margin-top:6px">` + footerLinks + `</div>`
	}

	body = inlineMailFragment(body, primary)
	font := `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;`
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f6f5;color:#303b35"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:#f4f6f5"><tr><td align="center" style="padding:34px 12px 38px"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;border-collapse:collapse"><tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;background:#ffffff;border:1px solid #dfe5e2;border-radius:14px;overflow:hidden"><tr><td style="padding:23px 30px;border-top:3px solid ` + primary + `;border-bottom:1px solid #edf1ef">` + brand + `</td></tr><tr><td style="padding:30px 32px 34px;` + font + `font-size:14px;line-height:1.75;color:#445149">` + body + `</td></tr></table></td></tr><tr><td style="padding:17px 10px 0;text-align:center;` + font + `font-size:11px;line-height:1.65;color:#89928d"><div>此邮件由 ` + html.EscapeString(site) + ` 自动发送。</div>` + footerLinks + `<div style="margin-top:6px;color:#a0a8a4">` + html.EscapeString(copyright) + `</div></td></tr></table></td></tr></table></body></html>`
}

func inlineMailFragment(body, primary string) string {
	replacer := strings.NewReplacer(
		`<h1>`, `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.42;font-weight:760;letter-spacing:-0.2px;color:#152019">`,
		`<h2>`, `<h2 style="margin:22px 0 11px;font-size:17px;line-height:1.5;font-weight:720;color:#152019">`,
		`<p>`, `<p style="margin:11px 0;font-size:14px;line-height:1.8;color:#445149">`,
		`<p class="muted">`, `<p style="margin:13px 0 0;font-size:12px;line-height:1.7;color:#7d8882;word-break:break-word">`,
		`<a class="button"`, `<a style="display:inline-block;margin:10px 0;padding:12px 18px;border-radius:9px;background:`+primary+`;color:#ffffff!important;text-decoration:none;font-weight:720;line-height:1.2"`,
		`<strong>`, `<strong style="font-weight:750;color:#152019">`,
	)
	return replacer.Replace(body)
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
