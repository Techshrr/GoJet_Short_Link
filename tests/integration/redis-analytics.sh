#!/bin/sh
set -eu
PORT="${INTEGRATION_REDIS_PORT:-6399}"
DIR="$(mktemp -d)"
cleanup(){ if [ -f "$DIR/redis.pid" ]; then kill "$(cat "$DIR/redis.pid")" 2>/dev/null || true; fi; rm -rf "$DIR"; }
trap cleanup EXIT INT TERM
command -v redis-server >/dev/null 2>&1 || { echo "redis-server is required for this integration test" >&2; exit 2; }
redis-server --bind 127.0.0.1 --port "$PORT" --save '' --appendonly no --daemonize yes --pidfile "$DIR/redis.pid" --dir "$DIR"
export INTEGRATION_REDIS_ADDRESS="127.0.0.1:$PORT"
for i in $(seq 1 50); do redis-cli -p "$PORT" ping >/dev/null 2>&1 && break; sleep .1; done
redis-cli -p "$PORT" ping | grep -q PONG
go test -race -tags integration ./services/analytics-worker/internal/worker ./services/analytics-reconciler/internal/reconciler ./services/platform-api/cmd/server
