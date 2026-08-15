#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

catalog='database/migrations/migrationcatalog.txt'
test -f "$catalog"

mapfile -t migrations < <(grep -ve '^[[:space:]]*$' "$catalog")
catalog_count=${#migrations[@]}
sql_count=$(find database/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d '[:space:]')
unique_count=$(printf '%s\n' "${migrations[@]}" | sort -u | wc -l | tr -d '[:space:]')

test "$catalog_count" -gt 0
test "$sql_count" -eq "$catalog_count"
test "$unique_count" -eq "$catalog_count"

for required in socialauth.sql socialsubjectwidth.sql; do
  grep -Fxq "$required" "$catalog"
  test -s "database/migrations/$required"
done

social_line=$(grep -nFx 'socialauth.sql' "$catalog" | cut -d: -f1)
width_line=$(grep -nFx 'socialsubjectwidth.sql' "$catalog" | cut -d: -f1)
test "$social_line" -lt "$width_line"

for migration in "${migrations[@]}"; do
  test -s "database/migrations/$migration" || {
    echo "catalog migration is missing or empty: $migration" >&2
    exit 1
  }
done

printf 'authentication migration catalog contract: PASS (%d migrations)\n' "$catalog_count"
