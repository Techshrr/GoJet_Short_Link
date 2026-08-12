package mail

import (
	"io"
	"mime"
	"mime/quotedprintable"
	"net"
	"strings"
	"testing"
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
		t.Fatalf("decoded HTML mismatch: %q", decoded)
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

type timeoutError struct{}

func (timeoutError) Error() string   { return "timeout" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

var _ net.Error = timeoutError{}
