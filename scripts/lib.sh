#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT/deploy/compose.production.yaml"
ENV_FILE="$ROOT/deploy/.env.production"
COMPOSE_OVERRIDE=${GOJET_COMPOSE_OVERRIDE:-}

die() { printf 'GoJet: %s\n' "$*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }
compose() {
  if [ -n "$COMPOSE_OVERRIDE" ]; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE" "$@"
  else
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
  fi
}

validate_env() {
  [ -f "$ENV_FILE" ] || die "copy deploy/.env.production.example to deploy/.env.production and replace every placeholder"
  grep -q 'replace-with-' "$ENV_FILE" && die "production secrets still contain placeholders"
  chmod 600 "$ENV_FILE"
  set -a; . "$ENV_FILE"; set +a
  case "${NGINX_MODE:-container}" in
    container) ;;
    host) COMPOSE_OVERRIDE="$ROOT/deploy/compose.host-nginx.yaml" ;;
    *) die "NGINX_MODE must be container or host" ;;
  esac
  for key in MYSQL_PASSWORD MYSQL_ROOT_PASSWORD REDIS_PASSWORD VISITOR_HASH_KEY QR_TRACKING_KEY SETTINGS_ENCRYPTION_KEY ADMIN_BOOTSTRAP_EMAIL ADMIN_BOOTSTRAP_PASSWORD PUBLIC_BASE_URL LOG_WEBHOOK_TOKEN LOG_INGEST_TOKEN; do
    eval "value=\${$key:-}"
    [ -n "$value" ] || die "$key must not be empty"
  done
  [ ${#MYSQL_PASSWORD} -ge 24 ] || die "MYSQL_PASSWORD must contain at least 24 characters"
  [ ${#MYSQL_ROOT_PASSWORD} -ge 24 ] || die "MYSQL_ROOT_PASSWORD must contain at least 24 characters"
  [ ${#REDIS_PASSWORD} -ge 24 ] || die "REDIS_PASSWORD must contain at least 24 characters"
  [ ${#VISITOR_HASH_KEY} -ge 32 ] || die "VISITOR_HASH_KEY must contain at least 32 characters"
  [ ${#QR_TRACKING_KEY} -ge 32 ] || die "QR_TRACKING_KEY must contain at least 32 characters"
  [ ${#ADMIN_BOOTSTRAP_PASSWORD} -ge 20 ] || die "ADMIN_BOOTSTRAP_PASSWORD must contain at least 20 characters"
  [ "$MYSQL_PASSWORD" != "$MYSQL_ROOT_PASSWORD" ] || die "MySQL application and root passwords must differ"
  [ "$LOG_WEBHOOK_TOKEN" = "$LOG_INGEST_TOKEN" ] || die "LOG_WEBHOOK_TOKEN and LOG_INGEST_TOKEN must match"
  printf '%s' "$SETTINGS_ENCRYPTION_KEY" | openssl base64 -d -A 2>/dev/null | wc -c | grep -qx '32' || die "SETTINGS_ENCRYPTION_KEY must be base64 for exactly 32 bytes"
  case "$PUBLIC_BASE_URL" in https://*) ;; *) die "PUBLIC_BASE_URL must use https:// in production" ;; esac
  case "${FILE_STORAGE_DRIVER:-filesystem}" in
    filesystem) ;;
    s3)
      for key in S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET; do eval "value=\${$key:-}"; [ -n "$value" ] || die "$key is required for S3 storage"; done
      ;;
    *) die "FILE_STORAGE_DRIVER must be filesystem or s3" ;;
  esac
  compose config -q || die "production Compose configuration is invalid"
}

prepare_storage() {
  [ "$(id -u)" -eq 0 ] || die "installation and upgrades must run as root so container storage ownership can be set (use sudo)"
  mkdir -p \
    "$ROOT/deploy/data/brand" \
    "$ROOT/deploy/data/generated/qr" \
    "$ROOT/deploy/data/uploads" \
    "$ROOT/deploy/data/files"
  chown 65532:65532 \
    "$ROOT/deploy/data/brand" \
    "$ROOT/deploy/data/generated/qr" \
    "$ROOT/deploy/data/uploads" \
    "$ROOT/deploy/data/files"
  chmod 0755 "$ROOT/deploy/data/brand"
  chmod 0755 "$ROOT/deploy/data/generated/qr"
  chmod 0755 "$ROOT/deploy/data/uploads"
  chmod 0750 "$ROOT/deploy/data/files"
}

wait_healthy() {
  attempts=0
  until curl --fail --silent "http://127.0.0.1:${HTTP_PORT:-80}/health" >/dev/null; do
    attempts=$((attempts + 1))
    [ "$attempts" -lt 90 ] || die "health check did not pass; run docker compose logs"
    sleep 2
  done
}

apply_migrations() {
  for migration in "$ROOT"/database/migrations/*.sql; do
    name=$(basename "$migration")
    applied=$(compose exec -T mysql mysql -N -ugojet -p"$MYSQL_PASSWORD" gojet -e "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); SELECT COUNT(*) FROM schema_migrations WHERE name='$name';" | tail -1)
    if [ "$applied" = "0" ]; then
      compose exec -T mysql mysql -ugojet -p"$MYSQL_PASSWORD" gojet < "$migration"
      compose exec -T mysql mysql -ugojet -p"$MYSQL_PASSWORD" gojet -e "INSERT INTO schema_migrations(name) VALUES('$name')"
    fi
  done
}