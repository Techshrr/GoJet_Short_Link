#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/gojet/current}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/gojet}"
KEEP_DAYS="${KEEP_DAYS:-14}"
SPOOL_DIR="${GOJET_REDIRECT_SPOOL_DIR:-/var/lib/gojet/spool}"
umask 0077
mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"
set -a; source .env; set +a
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

mysqldump --single-transaction --quick --lock-tables=false \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" "-p$DB_PASSWORD" "$DB_DATABASE" \
  | gzip -9 > "$BACKUP_DIR/gojet-db-$stamp.sql.gz"

tar -czf "$BACKUP_DIR/gojet-private-$stamp.tar.gz" storage/app .env
if [[ -d "$SPOOL_DIR" ]]; then
  tar -C "$(dirname "$SPOOL_DIR")" -czf "$BACKUP_DIR/gojet-spool-$stamp.tar.gz" "$(basename "$SPOOL_DIR")"
fi
sha256sum "$BACKUP_DIR"/*"$stamp"* > "$BACKUP_DIR/gojet-$stamp.sha256"
find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete
printf 'Backup completed: %s\n' "$stamp"
