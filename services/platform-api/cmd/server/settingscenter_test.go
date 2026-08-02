package main

import (
	"mime/multipart"
	"os"
	"testing"
)

func TestValidateImageUsesMagicBytes(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "image-*.png")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	png := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0}
	if _, err = file.Write(png); err != nil {
		t.Fatal(err)
	}
	if _, err = file.Seek(0, 0); err != nil {
		t.Fatal(err)
	}
	mime, ext, err := validateImage(file, &multipart.FileHeader{Filename: "malicious.svg", Size: int64(len(png))})
	if err != nil || mime != "image/png" || ext != ".png" {
		t.Fatalf("mime=%s ext=%s err=%v", mime, ext, err)
	}
}
func TestValidateImageRejectsSVG(t *testing.T) {
	file, err := os.CreateTemp(t.TempDir(), "image-*.svg")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	content := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	_, _ = file.Write(content)
	_, _ = file.Seek(0, 0)
	if _, _, err = validateImage(file, &multipart.FileHeader{Filename: "logo.svg", Size: int64(len(content))}); err == nil {
		t.Fatal("executable SVG must be rejected")
	}
}
func TestRemoveOldUploadCannotEscapeStorage(t *testing.T) {
	storage := t.TempDir()
	outside, err := os.CreateTemp(t.TempDir(), "outside")
	if err != nil {
		t.Fatal(err)
	}
	outside.Close()
	removeOldUpload(storage, "/uploads/../../"+outside.Name())
	if _, err = os.Stat(outside.Name()); err != nil {
		t.Fatal("outside file was removed")
	}
}
