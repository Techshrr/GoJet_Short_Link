package adminauth

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Techshrr/GoJet_Short_Link/app/settings"
)

func TestRolePermissionsAreExplicit(t *testing.T) {
	if !Allowed("super_admin", "settings.manage") || Allowed("analyst", "settings.manage") || !Allowed("security", "security.manage") {
		t.Fatal("administrator permission matrix is unsafe")
	}
}

func TestSensitiveOperationRequiresFreshTOTP(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	key := []byte("0123456789abcdef0123456789abcdef")
	store, _ := settings.NewStore(db, key)
	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString([]byte("12345678901234567890"))
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize())
	encrypted := base64.StdEncoding.EncodeToString(gcm.Seal(nonce, nonce, []byte(secret), nil))
	now := time.Unix(1_234_567_890, 0)
	code := totpCode(secret, now)
	mock.ExpectQuery("SELECT setting_value,is_encrypted FROM system_settings").WithArgs("admin.totp.7").WillReturnRows(sqlmock.NewRows([]string{"setting_value", "is_encrypted"}).AddRow(encrypted, true))
	service := New(db, store)
	service.now = func() time.Time { return now }
	if err = service.VerifyStepUp(context.Background(), Administrator{ID: 7, TOTPEnabled: true}, code); err != nil {
		t.Fatal(err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func totpCode(secret string, now time.Time) string {
	decoded, _ := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	var message [8]byte
	binary.BigEndian.PutUint64(message[:], uint64(now.Unix()/30))
	mac := hmac.New(sha1.New, decoded)
	_, _ = mac.Write(message[:])
	digest := mac.Sum(nil)
	index := digest[len(digest)-1] & 15
	return fmt.Sprintf("%06d", (binary.BigEndian.Uint32(digest[index:index+4])&0x7fffffff)%1_000_000)
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
