#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/scripts/lib.sh"
require docker; require curl; validate_env
[ "$#" -eq 2 ] || die "usage: ./rollback.sh <git-revision> <backup.sql.gz>"
revision=$1; backup=$2
[ -f "$backup" ] || die "backup not found: $backup"
set -a; . "$ENV_FILE"; set +a
git -C "$ROOT" cat-file -e "$revision^{commit}" || die "unknown git revision"
git -C "$ROOT" checkout --detach "$revision"
compose build
compose up -d redis mysql
gzip -dc "$backup" | compose exec -T mysql mysql -ugojet -p"$MYSQL_PASSWORD" gojet
compose up -d --remove-orphans
wait_healthy
printf 'GoJet rollback completed at %s.\n' "$revision"
