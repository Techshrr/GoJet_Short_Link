#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
MIGRATION_ROOT=${MIGRATION_ROOT:-$ROOT/database/migrations}
CATALOG=${MIGRATION_CATALOG:-$MIGRATION_ROOT/migrationcatalog.txt}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:?MYSQL_DATABASE must be configured}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-${MYSQL_PWD:-}}
MYSQL_BIN=${MYSQL_BIN:-mysql}

[[ -d "$MIGRATION_ROOT" ]] || { echo "migration directory missing: $MIGRATION_ROOT" >&2; exit 1; }
[[ -f "$CATALOG" ]] || { echo "migration catalog missing: $CATALOG" >&2; exit 1; }
[[ "$MYSQL_BIN" == */* ]] && [[ -x "$MYSQL_BIN" ]] || command -v "$MYSQL_BIN" >/dev/null 2>&1 || { echo "mysql client is required: $MYSQL_BIN" >&2; exit 1; }

mapfile -t migrations < <(sed -e 's/\r$//' -e '/^[[:space:]]*$/d' "$CATALOG")
(( ${#migrations[@]} > 0 )) || { echo 'migration catalog is empty' >&2; exit 1; }

declare -A seen
for name in "${migrations[@]}"; do
  [[ "$name" =~ ^[a-z][a-z0-9]+\.sql$ ]] || { echo "invalid semantic migration catalog entry: $name" >&2; exit 1; }
  [[ -z "${seen[$name]:-}" ]] || { echo "duplicate migration catalog entry: $name" >&2; exit 1; }
  seen[$name]=1
  [[ -f "$MIGRATION_ROOT/$name" ]] || { echo "catalog migration missing: $name" >&2; exit 1; }
done

mapfile -t sqlfiles < <(find "$MIGRATION_ROOT" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
(( ${#sqlfiles[@]} == ${#migrations[@]} )) || { echo 'migration catalog does not cover every SQL file' >&2; exit 1; }
for name in "${sqlfiles[@]}"; do
  [[ -n "${seen[$name]:-}" ]] || { echo "unregistered migration file: $name" >&2; exit 1; }
done

mysqlcmd=("$MYSQL_BIN" -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE")
mysqlquery=("$MYSQL_BIN" -N -s -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE")
export MYSQL_PWD="$MYSQL_PASSWORD"

"${mysqlcmd[@]}" -e "CREATE TABLE IF NOT EXISTS schema_migrations(name VARCHAR(255) PRIMARY KEY,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"

# Upgrade compatibility only: installations created before semantic migration
# names can contain numbered migration records. Map each legacy ordinal to the
# semantic catalog entry, then remove the engineering-style row without
# replaying its SQL.
mapfile -t legacy < <("${mysqlquery[@]}" -e "SELECT name FROM schema_migrations WHERE name REGEXP '^[0-9]{3}.*[.]sql$' ORDER BY name")
for old in "${legacy[@]}"; do
  ordinal=${old:0:3}
  [[ "$ordinal" =~ ^[0-9]{3}$ ]] || { echo "invalid legacy migration record: $old" >&2; exit 1; }
  index=$((10#$ordinal - 1))
  (( index >= 0 && index < ${#migrations[@]} )) || { echo "legacy migration ordinal out of catalog: $old" >&2; exit 1; }
  semantic=${migrations[$index]}
  "${mysqlcmd[@]}" -e "INSERT IGNORE INTO schema_migrations(name) VALUES('$semantic'); DELETE FROM schema_migrations WHERE name='$old';"
done

for name in "${migrations[@]}"; do
  applied=$("${mysqlquery[@]}" -e "SELECT COUNT(*) FROM schema_migrations WHERE name='$name'")
  [[ "$applied" == 0 ]] || continue
  echo "Applying $name"
  "${mysqlcmd[@]}" < "$MIGRATION_ROOT/$name"
  "${mysqlcmd[@]}" -e "INSERT INTO schema_migrations(name) VALUES('$name')"
done

printf 'Migration catalog applied: %d semantic migrations\n' "${#migrations[@]}"
