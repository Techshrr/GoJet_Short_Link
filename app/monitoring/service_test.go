package monitoring

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRunOpensAndQueuesNewAlert(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM mail_messages").WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id,status").WithArgs("mail.failed").WillReturnRows(sqlmock.NewRows([]string{"id", "status", "notified_at"}))
	mock.ExpectExec("INSERT INTO system_alerts").WillReturnResult(sqlmock.NewResult(7, 1))
	mock.ExpectExec("INSERT INTO mail_messages").WithArgs("ops@gojet.test", "[GoJet critical] 邮件投递连续失败", sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(8, 1))
	mock.ExpectExec("UPDATE system_alerts SET notified_at").WithArgs(int64(7)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM analytics_worker_failures").WillReturnError(context.Canceled)
	err = New(db, "ops@gojet.test").Run(context.Background())
	if err == nil {
		t.Fatal("expected following check to stop the run")
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
