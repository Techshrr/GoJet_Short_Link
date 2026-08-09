#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/scripts/lib.sh"
require docker; require curl; require openssl; require gzip; validate_env
[ "$#" -eq 1 ] || die "usage: ./rollback.sh <backup.sql.gz> (run this script from the previous release directory)"
backup=$1
[ -f "$backup" ] || die "backup not found: $backup"
printf 'WARNING: restoring %s will overwrite the current GoJet database.\n' "$backup" >&2
prepare_storage
compose build
compose up -d redis mysql
gzip -dc "$backup" | compose exec -T mysql mysql -ugojet -p"$MYSQL_PASSWORD" gojet
compose up -d --remove-orphans
wait_healthy
compose ps
printf 'GoJet rollback completed with release %s.\n' "$(cat "$ROOT/VERSION" 2>/dev/null || echo development)"
