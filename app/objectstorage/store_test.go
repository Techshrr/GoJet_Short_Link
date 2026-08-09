package objectstorage

import (
	"bytes"
	"context"
	"io"
	"testing"
)

func TestFilesystemQuarantineMoveAndOpen(t *testing.T) {
	store := Filesystem{Root: t.TempDir()}
	ctx := context.Background()
	if err := store.Put(ctx, "quarantine/file-1", bytes.NewBufferString("safe"), 4, "text/plain"); err != nil {
		t.Fatal(err)
	}
	if err := store.Move(ctx, "quarantine/file-1", "clean/file-1"); err != nil {
		t.Fatal(err)
	}
	reader, err := store.Open(ctx, "clean/file-1")
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	payload, _ := io.ReadAll(reader)
	if string(payload) != "safe" {
		t.Fatalf("payload=%q", payload)
	}
	if _, err = store.Open(ctx, "quarantine/file-1"); err == nil {
		t.Fatal("quarantine copy still exists")
	}
}

func TestFilesystemRejectsTraversal(t *testing.T) {
	store := Filesystem{Root: t.TempDir()}
	if err := store.Put(context.Background(), "../escape", bytes.NewReader(nil), 0, "text/plain"); err == nil {
		t.Fatal("path traversal accepted")
	}
}
