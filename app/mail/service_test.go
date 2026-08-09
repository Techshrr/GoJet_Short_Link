package mail

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestQueueTemplateEscapesValuesAndRejectsHeaderInjection(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery("SELECT subject_template,html_template FROM mail_templates").WithArgs("verification").WillReturnRows(sqlmock.NewRows([]string{"subject_template", "html_template"}).AddRow("Verify {{site_name}}", "<p>{{token}}</p>"))
	mock.ExpectExec("INSERT INTO mail_messages").WithArgs("verification", "user@example.com", "Verify GoJetBcc:evil@example.com", "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>").WillReturnResult(sqlmock.NewResult(7, 1))
	id, err := NewService(db, nil).QueueTemplate(context.Background(), "verification", "user@example.com", map[string]string{"site_name": "GoJet\r\nBcc:evil@example.com", "token": "<script>alert(1)</script>"})
	if err != nil || id != 7 {
		t.Fatalf("id=%d err=%v", id, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestQueueTemplateRejectsUnresolvedPlaceholder(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery("SELECT subject_template,html_template FROM mail_templates").WithArgs("verification").WillReturnRows(sqlmock.NewRows([]string{"subject_template", "html_template"}).AddRow("Verify {{site_name}}", "<p>{{missing}}</p>"))
	if _, err = NewService(db, nil).QueueTemplate(context.Background(), "verification", "user@example.com", map[string]string{"site_name": "GoJet"}); err == nil {
		t.Fatal("expected unresolved placeholder error")
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}
