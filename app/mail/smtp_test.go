package mail

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"mime"
	"mime/quotedprintable"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestSMTPConfigValidation(t *testing.T) {
	valid := SMTPConfig{Host: "smtp.example.com", Port: 587, Encryption: "starttls", FromEmail: "hello@example.com"}
	if err := valid.Validate(); err != nil {
		t.Fatal(err)
	}
	valid.Encryption = "none"
	valid.Username = "user"
	if err := valid.Validate(); err == nil {
		t.Fatal("expected plaintext credential rejection")
	}
}

func TestHeaderSanitization(t *testing.T) {
	if got := sanitize("hello\r\nBcc: attacker@example.com"); strings.ContainsAny(got, "\r\n") {
		t.Fatalf("header injection remained: %q", got)
	}
}

func TestUTF8SubjectUsesRFC2047(t *testing.T) {
	subject := "验证您的 GoJet 邮箱"
	encoded := encodedSubject(subject)
	if strings.Contains(encoded, subject) || !strings.HasPrefix(encoded, "=?UTF-8?") {
		t.Fatalf("subject was not RFC 2047 encoded: %q", encoded)
	}
	decoded, err := new(mime.WordDecoder).DecodeHeader(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if decoded != subject {
		t.Fatalf("decoded subject mismatch: %q", decoded)
	}
}

func TestHTMLBodyUsesQuotedPrintableUTF8(t *testing.T) {
	body := `<h1>验证邮箱</h1><p>您好，霍召席。</p>`
	encoded, err := encodeHTMLBody(body)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := io.ReadAll(quotedprintable.NewReader(strings.NewReader(encoded)))
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != body {
		t.Fatalf("decoded body mismatch: %q", decoded)
	}
	if strings.Contains(encoded, "霍召席") {
		t.Fatalf("non-ASCII body was written as raw transport bytes: %q", encoded)
	}
}

func TestTimeoutClassification(t *testing.T) {
	err := classify(timeoutError{})
	if !strings.Contains(err.Error(), "connection timed out") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSendSucceedsAfterDataAcceptedEvenWhenServerDropsBeforeQuit(t *testing.T) {
	host, port, done := startAcceptThenDropSMTP(t)
	cfg := SMTPConfig{Host: host, Port: port, Encryption: "none", FromEmail: "no-reply@example.test", FromName: "GoJet"}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := cfg.Send(ctx, Message{To: "recipient@example.test", Subject: "GoJet 邮件服务测试成功", HTML: "<p>accepted</p>", MessageID: "smtp-acceptance@example.test"}); err != nil {
		t.Fatalf("accepted DATA must be reported as success: %v", err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("fake SMTP server did not finish")
	}
}

func startAcceptThenDropSMTP(t *testing.T) (string, int, <-chan error) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	host, rawPort, _ := net.SplitHostPort(listener.Addr().String())
	port, _ := strconv.Atoi(rawPort)
	done := make(chan error, 1)
	go func() {
		defer listener.Close()
		conn, acceptErr := listener.Accept()
		if acceptErr != nil {
			done <- acceptErr
			return
		}
		defer conn.Close()
		reader := bufio.NewReader(conn)
		write := func(value string) error { _, e := io.WriteString(conn, value); return e }
		if err := write("220 localhost ESMTP\r\n"); err != nil { done <- err; return }
		inData := false
		for {
			line, readErr := reader.ReadString('\n')
			if readErr != nil { done <- readErr; return }
			trimmed := strings.TrimRight(line, "\r\n")
			if inData {
				if trimmed == "." {
					if err := write("250 2.0.0 queued\r\n"); err != nil { done <- err; return }
					done <- nil
					return // Deliberately close without reading or replying to QUIT.
				}
				continue
			}
			upper := strings.ToUpper(trimmed)
			switch {
			case strings.HasPrefix(upper, "EHLO"), strings.HasPrefix(upper, "HELO"):
				if err := write("250-localhost\r\n250 HELP\r\n"); err != nil { done <- err; return }
			case strings.HasPrefix(upper, "MAIL FROM:"), strings.HasPrefix(upper, "RCPT TO:"):
				if err := write("250 2.1.0 OK\r\n"); err != nil { done <- err; return }
			case upper == "DATA":
				if err := write("354 End data with <CR><LF>.<CR><LF>\r\n"); err != nil { done <- err; return }
				inData = true
			default:
				done <- fmt.Errorf("unexpected SMTP command: %q", trimmed)
				return
			}
		}
	}()
	return host, port, done
}

type timeoutError struct{}

func (timeoutError) Error() string   { return "timeout" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

var _ net.Error = timeoutError{}
