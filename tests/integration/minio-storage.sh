#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v minio >/dev/null || { echo "minio server binary is required" >&2; exit 1; }
tmp="$(mktemp -d)"; port="${MINIO_INTEGRATION_PORT:-19000}"
trap 'test -n "${pid:-}" && kill "$pid" 2>/dev/null || true; rm -rf "$tmp"' EXIT
export MINIO_ROOT_USER=gojet-integration MINIO_ROOT_PASSWORD=gojet-integration-secret
minio server "$tmp/data" --address "127.0.0.1:$port" --console-address "127.0.0.1:19001" >"$tmp/minio.log" 2>&1 & pid=$!
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$port/minio/health/ready" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://127.0.0.1:$port/minio/health/ready" >/dev/null
cat >"$tmp/create-bucket.go" <<'GO'
package main
import("context";"os";"github.com/minio/minio-go/v7";"github.com/minio/minio-go/v7/pkg/credentials")
func main(){c,e:=minio.New(os.Getenv("S3_ENDPOINT"),&minio.Options{Creds:credentials.NewStaticV4(os.Getenv("S3_ACCESS_KEY"),os.Getenv("S3_SECRET_KEY"),"")});if e!=nil{panic(e)};if e=c.MakeBucket(context.Background(),os.Getenv("S3_BUCKET"),minio.MakeBucketOptions{Region:"us-east-1"});e!=nil{panic(e)}}
GO
export S3_ENDPOINT="127.0.0.1:$port" S3_ACCESS_KEY="$MINIO_ROOT_USER" S3_SECRET_KEY="$MINIO_ROOT_PASSWORD" S3_BUCKET=gojet-integration
go run "$tmp/create-bucket.go"
go test -race -tags integration_s3 ./app/objectstorage
