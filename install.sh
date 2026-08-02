#!/usr/bin/env sh
set -eu
. "$(dirname "$0")/scripts/lib.sh"
require docker; require curl; validate_env
set -a; . "$ENV_FILE"; set +a
compose build --pull
compose up -d redis mysql
apply_migrations
compose up -d
wait_healthy
printf 'GoJet installation completed and passed its health check.\n'
