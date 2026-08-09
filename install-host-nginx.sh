#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
export GOJET_COMPOSE_OVERRIDE="$ROOT/deploy/compose.host-nginx.yaml"
. "$ROOT/scripts/lib.sh"
require docker; require curl; require openssl; require nginx; validate_env
[ "${NGINX_MODE:-}" = host ] || die "set NGINX_MODE=host in deploy/.env.production before running this installer"
[ "$(id -u)" -eq 0 ] || die "host Nginx installation must run as root (use sudo ./install-host-nginx.sh)"
case "$ROOT" in *' '*) die "installation path must not contain spaces";; esac
prepare_storage
chmod 0755 "$ROOT" "$ROOT/frontend" "$ROOT/frontend/marketing-site" "$ROOT/frontend/user-console" "$ROOT/frontend/admin-console"
compose build --pull
compose up -d redis mysql
apply_migrations
compose up -d --remove-orphans
rendered=$(mktemp); trap 'rm -f "$rendered"' EXIT INT TERM
sed "s|__GOJET_ROOT__|$ROOT|g" "$ROOT/deploy/nginx/gojet-host.conf" > "$rendered"
if [ -d /etc/nginx/conf.d ]; then target=/etc/nginx/conf.d/gojet.conf; else target=/etc/nginx/sites-available/gojet; fi
cp "$rendered" "$target"
if [ -d /etc/nginx/sites-enabled ]; then ln -sfn "$target" /etc/nginx/sites-enabled/gojet; rm -f /etc/nginx/sites-enabled/default; fi
nginx -t
if command -v systemctl >/dev/null 2>&1; then systemctl reload nginx; else nginx -s reload; fi
wait_healthy
compose ps
printf 'GoJet host-Nginx installation completed. Nginx proxies only to loopback ports 18080 and 18090.\n'
