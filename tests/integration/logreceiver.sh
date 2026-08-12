#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
for command in mariadbd curl; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done
tmp="$(mktemp -d)"; mysql_port=33083; receiver_port=18092
cleanup(){ for pid in "${receiver_pid:-}" "${mysql_pid:-}"; do test -z "$pid" || kill "$pid" 2>/dev/null || true; done; rm -rf "$tmp"; }
trap cleanup EXIT
mariadb-install-db --no-defaults --datadir="$tmp/mysql" --auth-root-authentication-method=normal --skip-test-db >/dev/null
mariadbd --no-defaults --datadir="$tmp/mysql" --socket="$tmp/mysql.sock" --port="$mysql_port" --bind-address=127.0.0.1 --pid-file="$tmp/mysql.pid" --log-error="$tmp/mysql.log" --skip-name-resolve --user="$(id -un)" & mysql_pid=$!
for _ in $(seq 1 60); do mariadb-admin --no-defaults --socket="$tmp/mysql.sock" ping --silent >/dev/null 2>&1 && break; sleep 1; done
mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot -e "CREATE DATABASE gojet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'gojet'@'127.0.0.1' IDENTIFIED BY 'integration'; GRANT ALL ON gojet.* TO 'gojet'@'127.0.0.1';"
for migration in database/migrations/*.sql; do mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot gojet <"$migration"; done
go build -o "$tmp/logreceiver" ./services/logreceiver/cmd/server
MYSQL_DSN="gojet:integration@tcp(127.0.0.1:${mysql_port})/gojet?parseTime=true&charset=utf8mb4" LOG_INGEST_TOKEN=integration-log-token LOG_RECEIVER_HTTP_ADDRESS="127.0.0.1:${receiver_port}" "$tmp/logreceiver" >"$tmp/receiver.log" 2>&1 & receiver_pid=$!
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:${receiver_port}/health" >/dev/null 2>&1 && break; sleep 1; done
test "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${receiver_port}/v1/logs" --data-binary '{}')" = 401
response="$(curl -fsS -X POST "http://127.0.0.1:${receiver_port}/v1/logs" -H 'Authorization: Bearer integration-log-token' -H 'Content-Type: application/x-ndjson' --data-binary $'{"timestamp":"2026-08-09T12:00:00Z","service":"platformapi","level":"info","event":"http.request","request_id":"acceptance-log-1234","status":200,"duration_ms":9}\n{"timestamp":"2026-08-09T12:00:01Z","service":"redirectengine","level":"error","event":"redis.timeout","request_id":"acceptance-log-1234"}\n')"
test "$(python3 -c 'import json,sys;print(json.load(sys.stdin)["accepted"])' <<<"$response")" = 2
test "$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM structured_logs WHERE request_id='acceptance-log-1234'")" = 2
test "$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM structured_logs WHERE level='error'")" = 1
echo "structured log receiver acceptance passed: authenticated=1 indexed=2 correlated=2"
