package main

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/Techshrr/GoJet_Short_Link/app/adminauth"
)

func TestVerifyAdminStepUpReusesDatabaseWindow(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery("SELECT COALESCE\\(step_up_until > UTC_TIMESTAMP\\(\\), FALSE\\)").
		WithArgs(int64(88), int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"active"}).AddRow(true))

	s := &server{db: db}
	req := httptest.NewRequest("POST", "/api/admin/administrators", nil)
	ctx := context.WithValue(req.Context(), adminKey{}, adminauth.Administrator{ID: 7, TOTPEnabled: true})
	ctx = context.WithValue(ctx, adminSessionKey{}, int64(88))
	if err = s.verifyAdminStepUp(req.WithContext(ctx)); err != nil {
		t.Fatal(err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestOrdinarySettingsDoNotRequirePathStepUp(t *testing.T) {
	for _, path := range []string{
		"/api/admin/settings/mail",
		"/api/admin/settings/basic",
		"/api/admin/settings/seo",
		"/api/admin/brand/logo",
		"/api/admin/mail/templates/verification",
		"/api/admin/mail/test",
	} {
		if stepUpRequiredForPath(path) {
			t.Fatalf("ordinary settings path unexpectedly requires step-up: %s", path)
		}
	}
	if !stepUpRequiredForPath("/api/admin/administrators") {
		t.Fatal("administrator creation must remain a step-up operation")
	}
}
