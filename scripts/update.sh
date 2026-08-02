#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/gojet/current}"
APP_USER="${APP_USER:-www-data}"
BUILD_ASSETS="${BUILD_ASSETS:-0}"
cd "$APP_DIR"

run_as_app() { runuser -u "$APP_USER" -- "$@"; }
secret="$(php -r 'echo bin2hex(random_bytes(16));')"
run_as_app php artisan down --retry=30 --secret="$secret" || true
trap 'runuser -u "$APP_USER" -- php artisan up || true' EXIT

if [[ ! -f vendor/autoload.php ]]; then
  composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --classmap-authoritative
fi
if [[ "$BUILD_ASSETS" == "1" ]]; then
  npm ci --no-audit --no-fund
  npm run build
elif [[ ! -f public/build/manifest.json ]]; then
  printf 'Compiled assets are missing. Set BUILD_ASSETS=1 or use the production package.\n' >&2
  exit 1
fi

chmod 750 bin/gojet-redirector
run_as_app php artisan migrate --force
run_as_app php artisan optimize:clear
run_as_app php artisan optimize
run_as_app php artisan queue:restart
systemctl restart gojet-redirector.service gojet-scheduler.service 2>/dev/null || true
supervisorctl restart 'gojet-worker:*' 2>/dev/null || true
run_as_app php artisan gojet:analytics:reconcile --dry-run
run_as_app php artisan gojet:check
run_as_app php artisan up
trap - EXIT
