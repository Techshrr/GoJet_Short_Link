#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
. "$ROOT/scripts/lib.sh"
require docker
require curl
require openssl
validate_env
printf 'Installing GoJet %s with Docker...\n' "$(cat "$ROOT/VERSION" 2>/dev/null || echo development)"
prepare_storage
compose build --pull
compose up -d redis mysql
apply_migrations
compose up -d --remove-orphans
wait_healthy
compose ps
printf 'GoJet Docker installation completed. Open %s/admin/ to finish setup.\n' "$PUBLIC_BASE_URL"
