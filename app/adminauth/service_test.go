package adminauth

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"testing"
	"time"
)

func TestRolePermissionsAreExplicit(t *testing.T) {
	if !Allowed("super_admin", "settings.manage") || Allowed("analyst", "settings.manage") || !Allowed("security", "security.manage") {
		t.Fatal("administrator permission matrix is unsafe")
	}
}

func TestTOTPVerificationUsesRFC6238Window(t *testing.T) {
	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString([]byte("12345678901234567890"))
	now := time.Unix(1_234_567_890, 0)
	decoded, _ := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	var message [8]byte
	binary.BigEndian.PutUint64(message[:], uint64(now.Unix()/30))
	mac := hmac.New(sha1.New, decoded)
	_, _ = mac.Write(message[:])
	digest := mac.Sum(nil)
	index := digest[len(digest)-1] & 15
	code := fmt.Sprintf("%06d", (binary.BigEndian.Uint32(digest[index:index+4])&0x7fffffff)%1_000_000)
	if !verifyTOTP(secret, code, now) || verifyTOTP(secret, "000000", now) && code != "000000" {
		t.Fatal("TOTP verification failed")
	}
}
