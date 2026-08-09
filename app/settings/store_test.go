package settings

import (
	"bytes"
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
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

func TestSettingPersistsAndReadsBackFromDatabase(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store, err := NewStore(db, bytes.Repeat([]byte{9}, 32))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	mock.ExpectExec("INSERT INTO system_settings").WithArgs("site.name", `"GoJet Production"`, false).WillReturnResult(sqlmock.NewResult(1, 1))
	if err = store.Set(ctx, "site.name", `"GoJet Production"`, false); err != nil {
		t.Fatal(err)
	}
	mock.ExpectQuery("SELECT setting_value,is_encrypted FROM system_settings").WithArgs("site.name").WillReturnRows(sqlmock.NewRows([]string{"setting_value", "is_encrypted"}).AddRow(`"GoJet Production"`, false))
	value, exists, err := store.Get(ctx, "site.name")
	if err != nil || !exists || value != `"GoJet Production"` {
		t.Fatalf("value=%q exists=%v err=%v", value, exists, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
