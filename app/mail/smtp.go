package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

type SMTPConfig struct {
	Host                                                               string
	Port                                                               int
	Username, Password, Encryption, EHLO, FromEmail, FromName, ReplyTo string
}
type Message struct{ To, Subject, HTML, MessageID string }

func (c SMTPConfig) Validate() error {
	if c.Host == "" || c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("SMTP host and valid port are required")
	}
	if _, err := mail.ParseAddress(c.FromEmail); err != nil {
		return fmt.Errorf("invalid from email: %w", err)
	}
	switch c.Encryption {
	case "tls", "starttls", "none":
	default:
		return fmt.Errorf("encryption must be tls, starttls, or none")
	}
	if c.Username != "" && c.Encryption == "none" {
		return fmt.Errorf("SMTP credentials require TLS")
	}
	return nil
}
func (c SMTPConfig) address() string { return net.JoinHostPort(c.Host, fmt.Sprint(c.Port)) }
func (c SMTPConfig) dial(ctx context.Context) (*smtp.Client, error) {
	if err := c.Validate(); err != nil {
		return nil, err
	}
	dialer := net.Dialer{Timeout: 8 * time.Second}
	var client *smtp.Client
	if c.Encryption == "tls" {
		conn, err := tls.DialWithDialer(&dialer, "tcp", c.address(), &tls.Config{ServerName: c.Host, MinVersion: tls.VersionTLS12})
		if err != nil {
			return nil, classify(err)
		}
		client, err = smtp.NewClient(conn, c.Host)
		if err != nil {
			conn.Close()
			return nil, classify(err)
		}
	} else {
		conn, err := dialer.DialContext(ctx, "tcp", c.address())
		if err != nil {
			return nil, classify(err)
		}
		client, err = smtp.NewClient(conn, c.Host)
		if err != nil {
			conn.Close()
			return nil, classify(err)
		}
		if c.EHLO != "" {
			if err = client.Hello(c.EHLO); err != nil {
				client.Close()
				return nil, classify(err)
			}
		}
		if c.Encryption == "starttls" {
			if ok, _ := client.Extension("STARTTLS"); !ok {
				client.Close()
				return nil, fmt.Errorf("TLS negotiation failed: server does not advertise STARTTLS")
			}
			if err = client.StartTLS(&tls.Config{ServerName: c.Host, MinVersion: tls.VersionTLS12}); err != nil {
				client.Close()
				return nil, classify(err)
			}
		}
	}
	if c.Encryption == "tls" && c.EHLO != "" {
		if err := client.Hello(c.EHLO); err != nil {
			client.Close()
			return nil, classify(err)
		}
	}
	if c.Username != "" {
		if err := client.Auth(smtp.PlainAuth("", c.Username, c.Password, c.Host)); err != nil {
			client.Close()
			return nil, fmt.Errorf("SMTP authentication failed: %w", err)
		}
	}
	return client, nil
}
func (c SMTPConfig) Test(ctx context.Context) error {
	client, err := c.dial(ctx)
	if err != nil {
		return err
	}
	defer client.Close()
	if err = client.Noop(); err != nil {
		return classify(err)
	}
	return client.Quit()
}
func (c SMTPConfig) Send(ctx context.Context, m Message) error {
	client, err := c.dial(ctx)
	if err != nil {
		return err
	}
	defer client.Close()
	if err = client.Mail(c.FromEmail); err != nil {
		return classify(err)
	}
	if err = client.Rcpt(m.To); err != nil {
		return classify(err)
	}
	writer, err := client.Data()
	if err != nil {
		return classify(err)
	}
	fromAddress := &mail.Address{Name: c.FromName, Address: c.FromEmail}
	from := fromAddress.String()
	headers := []string{"From: " + from, "To: " + m.To, "Subject: " + sanitize(m.Subject), "Message-ID: <" + m.MessageID + ">", "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8"}
	if c.ReplyTo != "" {
		headers = append(headers, "Reply-To: "+c.ReplyTo)
	}
	_, err = fmt.Fprintf(writer, "%s\r\n\r\n%s", strings.Join(headers, "\r\n"), m.HTML)
	closeErr := writer.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return classify(closeErr)
	}
	return client.Quit()
}
func sanitize(v string) string { return strings.NewReplacer("\r", " ", "\n", " ").Replace(v) }
func classify(err error) error {
	if err == nil {
		return nil
	}
	if e, ok := err.(net.Error); ok && e.Timeout() {
		return fmt.Errorf("connection timed out: %w", err)
	}
	lower := strings.ToLower(err.Error())
	if strings.Contains(lower, "tls") || strings.Contains(lower, "certificate") {
		return fmt.Errorf("TLS negotiation failed: %w", err)
	}
	return err
}
