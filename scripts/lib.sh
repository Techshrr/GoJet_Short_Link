#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT/deploy/compose.production.yaml"
ENV_FILE="$ROOT/deploy/.env.production"

die() { printf 'GoJet: %s\n' "$*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }
compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

validate_env() {
  [ -f "$ENV_FILE" ] || die "copy deploy/.env.production.example to deploy/.env.production and replace every placeholder"
  if grep -q 'replace-with-' "$ENV_FILE"; then die "production secrets still contain placeholders"; fi
  chmod 600 "$ENV_FILE"
}

wait_healthy() {
  attempts=0
  until curl --fail --silent "http://127.0.0.1:${HTTP_PORT:-80}/health" >/dev/null; do
    attempts=$((attempts + 1)); [ "$attempts" -lt 60 ] || die "health check did not pass; run docker compose logs"
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
