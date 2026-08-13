package mail

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

const (
	smtpDialTimeout    = 8 * time.Second
	smtpSessionTimeout = 20 * time.Second
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
	dialer := net.Dialer{Timeout: smtpDialTimeout}
	var client *smtp.Client
	if c.Encryption == "tls" {
		conn, err := tls.DialWithDialer(&dialer, "tcp", c.address(), &tls.Config{ServerName: c.Host, MinVersion: tls.VersionTLS12})
		if err != nil {
			return nil, classify(err)
		}
		_ = conn.SetDeadline(time.Now().Add(smtpSessionTimeout))
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
		_ = conn.SetDeadline(time.Now().Add(smtpSessionTimeout))
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
	// NOOP has already proved the authenticated SMTP session is usable. QUIT is
	// only a courtesy close and some relays/proxies do not reply promptly. A
	// delayed QUIT must never turn a successful connectivity test into a 502.
	return nil
}

func encodeHTMLBody(value string) (string, error) {
	var encoded bytes.Buffer
	writer := quotedprintable.NewWriter(&encoded)
	if _, err := writer.Write([]byte(value)); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	return encoded.String(), nil
}

func encodedSubject(value string) string {
	return mime.QEncoding.Encode("UTF-8", sanitize(value))
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
	body, err := encodeHTMLBody(m.HTML)
	if err != nil {
		_ = writer.Close()
		return err
	}
	fromAddress := &mail.Address{Name: c.FromName, Address: c.FromEmail}
	headers := []string{
		"From: " + fromAddress.String(),
		"To: " + m.To,
		"Subject: " + encodedSubject(m.Subject),
		"Message-ID: <" + sanitize(m.MessageID) + ">",
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
		"Content-Transfer-Encoding: quoted-printable",
	}
	if c.ReplyTo != "" {
		headers = append(headers, "Reply-To: "+c.ReplyTo)
	}
	_, err = fmt.Fprintf(writer, "%s\r\n\r\n%s", strings.Join(headers, "\r\n"), body)
	closeErr := writer.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return classify(closeErr)
	}
	// writer.Close waits for the SMTP server's final 250 response to DATA. At
	// that point the message has been accepted for delivery. Do not downgrade
	// that accepted delivery to a failure merely because a subsequent QUIT is
	// slow, dropped, or filtered by a relay.
	return nil
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
