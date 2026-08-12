package logstore

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestIngestRejectsInvalidRecordBeforeDatabaseWrite(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectRollback()
	_, err = New(db).Ingest(context.Background(), []byte(`{"timestamp":"bad","service":"api","level":"info","event":"http.request"}`))
	if err == nil {
		t.Fatal("expected validation error")
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestIngestCommitsValidNDJSON(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO structured_logs").WithArgs(sqlmock.AnyArg(), "platformapi", "info", "http.request", "request-123456789", nil, nil, sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()
	count, err := New(db).Ingest(context.Background(), []byte(`{"timestamp":"2026-08-09T12:00:00Z","service":"platformapi","level":"info","event":"http.request","request_id":"request-123456789"}`))
	if err != nil || count != 1 {
		t.Fatalf("count=%d err=%v", count, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
