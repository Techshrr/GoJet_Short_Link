#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
COMPOSE="$ROOT/deploy/compose.production.yaml"
NGINX="$ROOT/deploy/nginx/gojet.conf"
HOST_NGINX="$ROOT/deploy/nginx/gojethost.conf"
NATIVE_NGINX="$ROOT/deploy/nginx/gojetnative.conf"
PACKAGE="$ROOT/scripts/packagerelease.sh"
HOST_INSTALLER="$ROOT/installhostnginx.sh"

need(){ grep -Fq "$2" "$1" || { echo "missing release storage contract in $1: $2" >&2; exit 1; }; }
forbid(){ if grep -Fq "$2" "$1"; then echo "retired release storage contract in $1: $2" >&2; exit 1; fi; }

need "$COMPOSE" '../public:/usr/share/nginx/html/site:ro'
need "$COMPOSE" './data/brand:/usr/share/nginx/html/assets/images:ro'
need "$COMPOSE" './data/generated/qr:/usr/share/nginx/html/generated/qr:ro'
need "$COMPOSE" './data/uploads:/usr/share/nginx/html/uploads:ro'
need "$COMPOSE" './data/brand:/data/brand'
need "$COMPOSE" './data/generated/qr:/data/generated/qr'
need "$COMPOSE" './data/uploads:/data/uploads'
forbid "$COMPOSE" 'frontend/marketing-site'
forbid "$COMPOSE" '/usr/share/nginx/html/site/assets/images'
forbid "$COMPOSE" '/usr/share/nginx/html/site/generated/qr'
forbid "$COMPOSE" '/usr/share/nginx/html/site/uploads'

need "$NGINX" 'alias /usr/share/nginx/html/site/app/;'
need "$NGINX" 'alias /usr/share/nginx/html/site/admin/;'
need "$NGINX" 'root /usr/share/nginx/html/site;'
need "$NGINX" 'location ^~ /assets/images/'
need "$NGINX" 'alias /usr/share/nginx/html/assets/images/;'
need "$NGINX" 'location ^~ /generated/qr/'
need "$NGINX" 'alias /usr/share/nginx/html/generated/qr/;'
need "$NGINX" 'location ^~ /uploads/'
need "$NGINX" 'alias /usr/share/nginx/html/uploads/;'

for config in "$HOST_NGINX" "$NATIVE_NGINX"; do
  need "$config" '__GOJET_ROOT__/public/app/'
  need "$config" '__GOJET_ROOT__/public/admin/'
  need "$config" 'root __GOJET_ROOT__/public;'
  forbid "$config" '__GOJET_ROOT__/frontend/'
done

need "$HOST_INSTALLER" '"$ROOT/public"'
forbid "$HOST_INSTALLER" 'frontend/marketing-site'
need "$PACKAGE" 'deploy/compose.production.yaml'
forbid "$PACKAGE" 'compose.release.yaml'
forbid "$PACKAGE" 'frontend/marketing-site#__GOJET_ROOT__/public'
[ ! -e "$ROOT/deploy/compose.release.yaml" ] || { echo 'duplicate deploy/compose.release.yaml must not exist' >&2; exit 1; }

bash "$ROOT/tests/integration/nativeenvsafety.sh"
printf 'published web/storage namespace contract: PASS\n'