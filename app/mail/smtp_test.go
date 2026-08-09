package mail

import (
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
