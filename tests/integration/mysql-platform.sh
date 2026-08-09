#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v mariadbd >/dev/null || { echo "mariadbd (or a MySQL-compatible server) is required" >&2; exit 1; }
tmp="$(mktemp -d)"; port="${MYSQL_INTEGRATION_PORT:-33079}"
trap 'test -n "${pid:-}" && kill "$pid" 2>/dev/null || true; rm -rf "$tmp"' EXIT
mariadb-install-db --no-defaults --datadir="$tmp/data" --auth-root-authentication-method=normal --skip-test-db >/dev/null
mariadbd --no-defaults --datadir="$tmp/data" --socket="$tmp/mysql.sock" --port="$port" --bind-address=127.0.0.1 --pid-file="$tmp/mysql.pid" --log-error="$tmp/mysql.log" --skip-name-resolve --user="$(id -un)" & pid=$!
for _ in $(seq 1 60); do
  mariadb-admin --no-defaults --socket="$tmp/mysql.sock" ping --silent >/dev/null 2>&1 && break
  sleep 1
done
mariadb-admin --no-defaults --socket="$tmp/mysql.sock" ping --silent >/dev/null
mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot -e "CREATE DATABASE gojet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'gojet'@'127.0.0.1' IDENTIFIED BY 'integration-only'; GRANT ALL ON gojet.* TO 'gojet'@'127.0.0.1';"
for migration in database/migrations/*.sql; do
  echo "Applying $migration"
  mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot gojet <"$migration"
done
INTEGRATION_MYSQL_DSN="gojet:integration-only@tcp(127.0.0.1:${port})/gojet?parseTime=true&multiStatements=true" go test -race -tags integration_mysql ./tests/integration
