#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${APP_DIR:-/var/www/gojet/current}"
BASE_URL="${BASE_URL:-https://gojet.cc}"
cd "$APP_DIR"
php artisan gojet:check --json
curl --fail --silent --show-error --max-time 10 "$BASE_URL/up" >/dev/null
printf 'HTTP health endpoint passed: %s/up\n' "$BASE_URL"
