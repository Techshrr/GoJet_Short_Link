package settings

import (
	"bytes"
	"testing"
)

func TestEncryptionRoundTrip(t *testing.T) {
	s := &Store{key: bytes.Repeat([]byte{7}, 32)}
	encrypted, err := s.encrypt([]byte("smtp-password"))
	if err != nil {
		t.Fatal(err)
	}
	if encrypted == "smtp-password" {
		t.Fatal("secret stored as plaintext")
	}
	plain, err := s.decrypt(encrypted)
	if err != nil || string(plain) != "smtp-password" {
		t.Fatalf("roundtrip=%q err=%v", plain, err)
	}
}
func TestDecodeKeyRequiresCallerValidation(t *testing.T) {
	key, err := DecodeKey("AQID")
	if err != nil || len(key) != 3 {
		t.Fatalf("key=%v err=%v", key, err)
	}
}
