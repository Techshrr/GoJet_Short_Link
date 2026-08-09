#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/scripts/lib.sh"
require docker; require curl; require openssl; require gzip; validate_env
mkdir -p "$ROOT/backups"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
version=$(cat "$ROOT/VERSION" 2>/dev/null || git -C "$ROOT" describe --always 2>/dev/null || echo unknown)
prepare_storage
compose up -d mysql
compose exec -T mysql mysqldump -ugojet -p"$MYSQL_PASSWORD" --single-transaction --routines --triggers gojet | gzip > "$ROOT/backups/gojet-$stamp.sql.gz"
printf '%s\n' "$version" > "$ROOT/backups/release-$stamp.txt"
compose build --pull
compose up -d redis mysql
apply_migrations
compose up -d --remove-orphans
wait_healthy
compose ps
printf 'GoJet upgrade completed for %s. Backup: backups/gojet-%s.sql.gz\n' "$version" "$stamp"
