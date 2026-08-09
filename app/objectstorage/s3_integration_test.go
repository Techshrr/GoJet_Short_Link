//go:build integration_s3

package objectstorage

import (
	"bytes"
	"context"
	"io"
	"os"
	"testing"
)

func TestS3QuarantineCleanDownloadAndDelete(t *testing.T) {
	ctx := context.Background()
	store, err := NewS3(ctx, S3Config{Endpoint: os.Getenv("S3_ENDPOINT"), AccessKey: os.Getenv("S3_ACCESS_KEY"), SecretKey: os.Getenv("S3_SECRET_KEY"), Bucket: os.Getenv("S3_BUCKET"), Region: "us-east-1", TempDir: t.TempDir(), Secure: false})
	if err != nil {
		t.Fatal(err)
	}
	key := "integration/file-lifecycle"
	if err = store.Put(ctx, "quarantine/"+key, bytes.NewBufferString("gojet object storage"), 20, "text/plain"); err != nil {
		t.Fatal(err)
	}
	path, cleanup, err := store.Materialize(ctx, "quarantine/"+key)
	if err != nil {
		t.Fatal(err)
	}
	if data, readErr := os.ReadFile(path); readErr != nil || string(data) != "gojet object storage" {
		t.Fatalf("materialized=%q err=%v", data, readErr)
	}
	cleanup()
	if err = store.Move(ctx, "quarantine/"+key, "clean/"+key); err != nil {
		t.Fatal(err)
	}
	reader, err := store.Open(ctx, "clean/"+key)
	if err != nil {
		t.Fatal(err)
	}
	payload, err := io.ReadAll(reader)
	reader.Close()
	if err != nil || string(payload) != "gojet object storage" {
		t.Fatalf("payload=%q err=%v", payload, err)
	}
	if err = store.Delete(ctx, "clean/"+key); err != nil {
		t.Fatal(err)
	}
	if _, err = store.Open(ctx, "clean/"+key); err == nil {
		t.Fatal("deleted object remains readable")
	}
}
