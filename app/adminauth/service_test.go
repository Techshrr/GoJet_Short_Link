package adminauth

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"reflect"
	"testing"
	"time"
)

func TestRolePermissionsAreExplicit(t *testing.T) {
	if !Allowed("super_admin", "settings.manage") || Allowed("analyst", "settings.manage") || !Allowed("security", "security.manage") {
		t.Fatal("administrator permission templates are unsafe")
	}
	if !Allowed("support", "tickets.manage") {
		t.Fatal("support administrators must be able to manage customer tickets")
	}
}

func TestSuperAdminAlwaysHasEveryPermission(t *testing.T) {
	a := Administrator{Role: "super_admin"}
	for _, permission := range append(PermissionCatalog(), "future.permission") {
		if !AllowedAdministrator(a, permission) {
			t.Fatalf("super administrator lost permission %q", permission)
		}
	}
}

func TestCustomAdministratorUsesExplicitPermissions(t *testing.T) {
	a := Administrator{Role: "custom", Permissions: []string{"platform.read", "users.manage"}}
	if !AllowedAdministrator(a, "platform.read") || !AllowedAdministrator(a, "users.manage") {
		t.Fatal("explicit administrator permissions were not granted")
	}
	if AllowedAdministrator(a, "settings.manage") || AllowedAdministrator(a, "admins.manage") {
		t.Fatal("administrator received permissions that were never granted")
	}
}

func TestRoleTemplateNormalization(t *testing.T) {
	got, err := normalizePermissions("support", nil)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"mail.manage", "platform.read", "tickets.manage", "users.manage"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("support template = %#v, want %#v", got, want)
	}
	if _, err = normalizePermissions("custom", []string{"unknown.permission"}); err == nil {
		t.Fatal("unknown permission must be rejected")
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