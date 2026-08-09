#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/scripts/lib.sh"
require docker; require curl; require openssl; validate_env
printf 'Installing GoJet %s...\n' "$(cat "$ROOT/VERSION" 2>/dev/null || echo development)"
prepare_storage
compose build --pull
compose up -d redis mysql
apply_migrations
compose up -d --remove-orphans
wait_healthy
compose ps
printf 'GoJet installation completed and passed its health check. Open %s/admin/ to finish setup.\n' "$PUBLIC_BASE_URL"
