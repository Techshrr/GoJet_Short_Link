#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/gojet/current}"
APP_USER="${APP_USER:-www-data}"
APP_GROUP="${APP_GROUP:-www-data}"
PHP_BIN="${PHP_BIN:-php}"
COMPOSER_BIN="${COMPOSER_BIN:-composer}"
INSTALL_SERVICES="${INSTALL_SERVICES:-1}"
BUILD_ASSETS="${BUILD_ASSETS:-0}"
SPOOL_DIR="${GOJET_REDIRECT_SPOOL_DIR:-/var/lib/gojet/spool}"

fail() { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mWARN:\033[0m %s\n' "$*" >&2; }
run_as_app() { runuser -u "$APP_USER" -- "$@"; }

[[ "$(id -u)" -eq 0 ]] || fail "Run this installer as root or through sudo"
[[ -f "$APP_DIR/artisan" ]] || fail "GoJet source was not found at $APP_DIR"
id "$APP_USER" >/dev/null 2>&1 || fail "Application user does not exist: $APP_USER"
getent group "$APP_GROUP" >/dev/null 2>&1 || fail "Application group does not exist: $APP_GROUP"
command -v "$PHP_BIN" >/dev/null || fail "PHP is not installed"
command -v runuser >/dev/null || fail "runuser is required"
cd "$APP_DIR"

"$PHP_BIN" -r 'exit(version_compare(PHP_VERSION, "8.3.0", ">=") ? 0 : 1);' || fail "PHP 8.3 or newer is required"
for ext in bcmath ctype curl dom fileinfo filter gd hash intl mbstring openssl pcntl pdo pdo_mysql redis tokenizer xml zip; do
  "$PHP_BIN" -m | grep -qi "^${ext}$" || fail "Missing PHP extension: $ext"
done

[[ -f .env ]] || cp .env.example .env

if [[ ! -f vendor/autoload.php ]]; then
  command -v "$COMPOSER_BIN" >/dev/null || fail "vendor/ is missing and Composer is not installed"
  info "Installing locked production PHP dependencies"
  "$COMPOSER_BIN" install --no-dev --no-interaction --prefer-dist --optimize-autoloader --classmap-authoritative
else
  info "Using bundled production PHP dependencies"
fi

if [[ "$BUILD_ASSETS" == "1" ]]; then
  command -v npm >/dev/null || fail "BUILD_ASSETS=1 requires Node.js and npm"
  info "Rebuilding frontend assets from package-lock.json"
  npm ci --no-audit --no-fund
  npm run build
elif [[ ! -f public/build/manifest.json ]]; then
  fail "Compiled frontend assets are missing. Re-run with BUILD_ASSETS=1."
else
  info "Using bundled compiled frontend assets"
fi

if ! grep -q '^APP_KEY=base64:' .env; then
  "$PHP_BIN" artisan key:generate --force
fi
if grep -Eq '^GOJET_IP_HASH_KEY=(|change-me)' .env; then
  secret="$($PHP_BIN -r 'echo bin2hex(random_bytes(32));')"
  sed -i "s/^GOJET_IP_HASH_KEY=.*/GOJET_IP_HASH_KEY=${secret}/" .env
fi
if grep -Eq '^GOJET_REDIRECT_INTERNAL_TOKEN=(|change-me)' .env; then
  secret="$($PHP_BIN -r 'echo bin2hex(random_bytes(32));')"
  sed -i "s/^GOJET_REDIRECT_INTERNAL_TOKEN=.*/GOJET_REDIRECT_INTERNAL_TOKEN=${secret}/" .env
fi

mkdir -p storage/framework/{cache/data,sessions,views} storage/logs bootstrap/cache "$SPOOL_DIR"
chown -R "$APP_USER:$APP_GROUP" storage bootstrap/cache "$SPOOL_DIR"
chmod -R ug+rwX storage bootstrap/cache
chmod 750 "$SPOOL_DIR"

if [[ -f bin/gojet-redirector ]]; then
  chmod 750 bin/gojet-redirector
  chown root:"$APP_GROUP" bin/gojet-redirector
else
  fail "The Go redirect-plane binary is missing: bin/gojet-redirector"
fi

chown root:"$APP_GROUP" .env
chmod 640 .env
"$PHP_BIN" artisan storage:link >/dev/null 2>&1 || true

info "Running database migrations"
run_as_app "$PHP_BIN" artisan migrate --force
run_as_app "$PHP_BIN" artisan optimize:clear
run_as_app "$PHP_BIN" artisan optimize

if [[ "$INSTALL_SERVICES" == "1" && -d /run/systemd/system ]]; then
  info "Installing Go redirect plane and Laravel scheduler services"
  install -m 0644 deploy/systemd/gojet-redirector.service /etc/systemd/system/gojet-redirector.service
  install -m 0644 deploy/systemd/gojet-scheduler.service /etc/systemd/system/gojet-scheduler.service
  systemctl daemon-reload
  systemctl enable --now gojet-redirector.service gojet-scheduler.service

  if command -v supervisorctl >/dev/null 2>&1 && [[ -d /etc/supervisor/conf.d ]]; then
    install -m 0644 deploy/supervisor/gojet-worker.conf /etc/supervisor/conf.d/gojet-worker.conf
    supervisorctl reread
    supervisorctl update
  else
    warn "Supervisor was not detected; install the default-queue worker manually."
  fi
else
  warn "Service installation was skipped. Install deploy/systemd and deploy/supervisor templates manually."
fi

info "Running application self-check"
if ! run_as_app "$PHP_BIN" artisan gojet:check; then
  warn "The application self-check reported environment-specific warnings. Review them before launch."
fi

info "Installation complete"
printf '%s\n' "Next: configure deploy/nginx/gojet.conf, reload Nginx, and complete docs/ACCEPTANCE_CHECKLIST.md."
