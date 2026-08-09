package mail

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Techshrr/GoJet_Short_Link/app/settings"
)

func TestConfigStrictReadsPersistedSMTPValues(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store, err := settings.NewStore(db, []byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	values := []struct{ key, value string }{
		{"mail.host", "smtp.example.com"},
		{"mail.port", "587"},
		{"mail.username", "mailer"},
		{"mail.password", "secret"},
		{"mail.encryption", "starttls"},
		{"mail.ehlo", "gojet.example.com"},
		{"mail.from_email", "noreply@example.com"},
		{"mail.from_name", "GoJet"},
		{"mail.reply_to", "support@example.com"},
	}
	for _, item := range values {
		mock.ExpectQuery("SELECT setting_value,is_encrypted FROM system_settings").
			WithArgs(item.key).
			WillReturnRows(sqlmock.NewRows([]string{"setting_value", "is_encrypted"}).AddRow(item.value, false))
	}
	service := NewService(db, store)
	cfg, err := service.ConfigStrict(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Host != "smtp.example.com" || cfg.Port != 587 || cfg.Username != "mailer" || cfg.Password != "secret" || cfg.FromEmail != "noreply@example.com" {
		t.Fatalf("unexpected SMTP config: %+v", cfg)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
