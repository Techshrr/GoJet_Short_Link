package objectstorage

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func FromEnvironment(ctx context.Context, fallbackRoot string) (Store, error) {
	if os.Getenv("FILE_STORAGE_DRIVER") != "s3" {
		return Filesystem{Root: fallbackRoot}, nil
	}
	return NewS3(ctx, S3Config{Endpoint: os.Getenv("S3_ENDPOINT"), AccessKey: os.Getenv("S3_ACCESS_KEY"), SecretKey: os.Getenv("S3_SECRET_KEY"), Bucket: os.Getenv("S3_BUCKET"), Region: os.Getenv("S3_REGION"), TempDir: value("S3_SCAN_TEMP_PATH", "/tmp/gojet-scans"), Secure: os.Getenv("S3_SECURE") != "false"})
}

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type Store interface {
	Put(context.Context, string, io.Reader, int64, string) error
	Open(context.Context, string) (io.ReadCloser, error)
	Materialize(context.Context, string) (string, func(), error)
	Move(context.Context, string, string) error
	Delete(context.Context, string) error
}

type Filesystem struct{ Root string }

func (s Filesystem) path(key string) (string, error) {
	clean := filepath.Clean(strings.TrimPrefix(key, "/"))
	if clean == "." || strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return "", errors.New("invalid object key")
	}
	return filepath.Join(s.Root, clean), nil
}
func (s Filesystem) Put(_ context.Context, key string, source io.Reader, _ int64, _ string) error {
	path, err := s.path(key)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".object-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err = io.Copy(tmp, source); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Chmod(0600); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
func (s Filesystem) Open(_ context.Context, key string) (io.ReadCloser, error) {
	path, err := s.path(key)
	if err != nil {
		return nil, err
	}
	return os.Open(path)
}
func (s Filesystem) Materialize(_ context.Context, key string) (string, func(), error) {
	path, err := s.path(key)
	return path, func() {}, err
}
func (s Filesystem) Move(_ context.Context, from, to string) error {
	source, err := s.path(from)
	if err != nil {
		return err
	}
	target, err := s.path(to)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(target), 0700); err != nil {
		return err
	}
	return os.Rename(source, target)
}
func (s Filesystem) Delete(_ context.Context, key string) error {
	path, err := s.path(key)
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

type S3 struct {
	client          *minio.Client
	bucket, tempDir string
}
type S3Config struct {
	Endpoint, AccessKey, SecretKey, Bucket, Region, TempDir string
	Secure                                                  bool
}

func NewS3(ctx context.Context, config S3Config) (*S3, error) {
	client, err := minio.New(config.Endpoint, &minio.Options{Creds: credentials.NewStaticV4(config.AccessKey, config.SecretKey, ""), Secure: config.Secure, Region: config.Region})
	if err != nil {
		return nil, err
	}
	exists, err := client.BucketExists(ctx, config.Bucket)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("object storage bucket does not exist")
	}
	return &S3{client: client, bucket: config.Bucket, tempDir: config.TempDir}, nil
}
func (s *S3) Put(ctx context.Context, key string, source io.Reader, size int64, mime string) error {
	_, err := s.client.PutObject(ctx, s.bucket, key, source, size, minio.PutObjectOptions{ContentType: mime})
	return err
}
func (s *S3) Open(ctx context.Context, key string) (io.ReadCloser, error) {
	object, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	if _, err = object.Stat(); err != nil {
		object.Close()
		return nil, err
	}
	return object, nil
}
func (s *S3) Materialize(ctx context.Context, key string) (string, func(), error) {
	if err := os.MkdirAll(s.tempDir, 0700); err != nil {
		return "", func() {}, err
	}
	file, err := os.CreateTemp(s.tempDir, "scan-*")
	if err != nil {
		return "", func() {}, err
	}
	path := file.Name()
	cleanup := func() { _ = os.Remove(path) }
	object, err := s.Open(ctx, key)
	if err != nil {
		file.Close()
		cleanup()
		return "", func() {}, err
	}
	defer object.Close()
	_, err = io.Copy(file, object)
	closeErr := file.Close()
	if err != nil || closeErr != nil {
		cleanup()
		return "", func() {}, errors.Join(err, closeErr)
	}
	return path, cleanup, nil
}
func (s *S3) Move(ctx context.Context, from, to string) error {
	source := minio.CopySrcOptions{Bucket: s.bucket, Object: from}
	target := minio.CopyDestOptions{Bucket: s.bucket, Object: to}
	if _, err := s.client.CopyObject(ctx, target, source); err != nil {
		return err
	}
	return s.client.RemoveObject(ctx, s.bucket, from, minio.RemoveObjectOptions{})
}
func (s *S3) Delete(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}
