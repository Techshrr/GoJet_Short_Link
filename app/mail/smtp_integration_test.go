//go:build integration_smtp

package mail

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

type smtpCapture struct {
	listener net.Listener
	mu       sync.Mutex
	messages []string
}

func newSMTPCapture(t *testing.T) *smtpCapture {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	server := &smtpCapture{listener: listener}
	t.Cleanup(func() { _ = listener.Close() })
	go server.serve()
	return server
}

func (s *smtpCapture) serve() {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			return
		}
		go s.handle(conn)
	}
}

func (s *smtpCapture) handle(conn net.Conn) {
	defer conn.Close()
	reader := bufio.NewReader(conn)
	_, _ = fmt.Fprint(conn, "220 gojet.integration ESMTP\r\n")
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return
		}
		command := strings.ToUpper(strings.TrimSpace(line))
		switch {
		case strings.HasPrefix(command, "EHLO"), strings.HasPrefix(command, "HELO"):
			_, _ = fmt.Fprint(conn, "250-gojet.integration\r\n250 8BITMIME\r\n")
		case command == "NOOP":
			_, _ = fmt.Fprint(conn, "250 OK\r\n")
		case strings.HasPrefix(command, "MAIL FROM:"), strings.HasPrefix(command, "RCPT TO:"):
			_, _ = fmt.Fprint(conn, "250 accepted\r\n")
		case command == "DATA":
			_, _ = fmt.Fprint(conn, "354 end with <CRLF>.<CRLF>\r\n")
			var message strings.Builder
			for {
				dataLine, readErr := reader.ReadString('\n')
				if readErr != nil {
					return
				}
				if dataLine == ".\r\n" {
					break
				}
				message.WriteString(dataLine)
			}
			s.mu.Lock()
			s.messages = append(s.messages, message.String())
			s.mu.Unlock()
			_, _ = fmt.Fprint(conn, "250 queued as gojet-integration\r\n")
		case command == "QUIT":
			_, _ = fmt.Fprint(conn, "221 bye\r\n")
			return
		default:
			_, _ = fmt.Fprint(conn, "502 unsupported\r\n")
		}
	}
}

func TestSMTPProtocolHealthAndChineseDelivery(t *testing.T) {
	server := newSMTPCapture(t)
	port, _ := strconv.Atoi(strings.Split(server.listener.Addr().String(), ":")[1])
	config := SMTPConfig{Host: "127.0.0.1", Port: port, Encryption: "none", EHLO: "api.gojet.test", FromEmail: "noreply@gojet.test", FromName: "GoJet 通知"}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := config.Test(ctx); err != nil {
		t.Fatalf("SMTP health test failed: %v", err)
	}
	wantSubject := "验证您的 GoJet 邮箱"
	wantHTML := "<strong>您好，霍召席。请验证邮箱。</strong>"
	message := Message{To: "owner@example.test", Subject: wantSubject, HTML: wantHTML, MessageID: "integration-001@gojet.test"}
	if err := config.Send(ctx, message); err != nil {
		t.Fatalf("SMTP delivery failed: %v", err)
	}
	server.mu.Lock()
	defer server.mu.Unlock()
	if len(server.messages) != 1 {
		t.Fatalf("captured %d messages, want 1", len(server.messages))
	}
	raw := server.messages[0]
	for _, expected := range []string{"Message-ID: <integration-001@gojet.test>", "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: quoted-printable", "Subject: =?UTF-8?"} {
		if !strings.Contains(raw, expected) {
			t.Fatalf("delivered message missing %q: %s", expected, raw)
		}
	}
	parsed, err := mail.ReadMessage(strings.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	decodedSubject, err := new(mime.WordDecoder).DecodeHeader(parsed.Header.Get("Subject"))
	if err != nil {
		t.Fatal(err)
	}
	if decodedSubject != wantSubject {
		t.Fatalf("subject round trip mismatch: %q", decodedSubject)
	}
	decodedBody, err := io.ReadAll(quotedprintable.NewReader(parsed.Body))
	if err != nil {
		t.Fatal(err)
	}
	if string(decodedBody) != wantHTML {
		t.Fatalf("HTML round trip mismatch: %q", decodedBody)
	}
}
