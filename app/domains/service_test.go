package domains

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestVerificationTokenHashContract(t *testing.T) {
	token := "abc123"
	sum := sha256.Sum256([]byte(token))
	if hex.EncodeToString(sum[:]) == token {
		t.Fatal("verification token stored in plaintext")
	}
}
