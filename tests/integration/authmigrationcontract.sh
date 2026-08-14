#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

catalog='database/migrations/migrationcatalog.txt'
test -f "$catalog"

mapfile -t migrations < <(grep -ve '^[[:space:]]*$' "$catalog")
test "${#migrations[@]}" -eq 44

test "$(find database/migrations -maxdepth 1 -type f -name '*.sql' | wc -l)" -eq 44
test "$(printf '%s\n' "${migrations[@]}" | sort -u | wc -l)" -eq 44

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

printf 'authentication migration catalog contract: PASS\n'
