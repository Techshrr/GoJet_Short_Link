//go:build integration_mysql

package integration

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func TestMySQLSchemaAndCoreTransaction(t *testing.T) {
	dsn := os.Getenv("INTEGRATION_MYSQL_DSN")
	if dsn == "" {
		t.Fatal("INTEGRATION_MYSQL_DSN is required")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err = db.PingContext(ctx); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"users", "workspaces", "short_links", "analytics_events", "mail_messages", "file_shares", "administrators", "analytics_reconciliation"} {
		var found string
		if err = db.QueryRowContext(ctx, `SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?`, table).Scan(&found); err != nil {
			t.Fatalf("required table %s missing: %v", table, err)
		}
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `INSERT INTO users(email,password_hash,display_name,status,email_verified_at) VALUES('integration@gojet.test','not-a-production-hash','Integration User','active',NOW())`)
	if err != nil {
		t.Fatal(err)
	}
	userID, _ := result.LastInsertId()
	result, err = tx.ExecContext(ctx, `INSERT INTO workspaces(name,owner_id,workspace_type) VALUES('Integration Workspace',?,'company')`, userID)
	if err != nil {
		t.Fatal(err)
	}
	workspaceID, _ := result.LastInsertId()
	if _, err = tx.ExecContext(ctx, `INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES(?,?,'owner','active')`, workspaceID, userID); err != nil {
		t.Fatal(err)
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO short_links(workspace_id,created_by,code,destination,title,status) VALUES(?,?,'mysqlint','https://example.com','Integration Link','active')`, workspaceID, userID); err != nil {
		t.Fatal(err)
	}
}
