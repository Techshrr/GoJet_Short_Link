#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/scripts/lib.sh"
require docker; require curl; validate_env
set -a; . "$ENV_FILE"; set +a
mkdir -p "$ROOT/backups"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
compose exec -T mysql mysqldump -ugojet -p"$MYSQL_PASSWORD" --single-transaction gojet | gzip > "$ROOT/backups/gojet-$stamp.sql.gz"
git -C "$ROOT" rev-parse HEAD > "$ROOT/backups/revision-$stamp"
compose build --pull
compose up -d redis mysql
apply_migrations
compose up -d --remove-orphans
wait_healthy
printf 'GoJet upgrade completed. Backup: backups/gojet-%s.sql.gz\n' "$stamp"
