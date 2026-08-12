#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
for command in mariadbd redis-server curl python3; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done
tmp="$(mktemp -d)"; mysql_port=33080; redis_port=16380; platform_port=18090; redirect_port=18080
cleanup(){ for pid in "${platform_pid:-}" "${redirect_pid:-}" "${worker_pid:-}" "${redis_pid:-}" "${mysql_pid:-}"; do test -z "$pid" || kill "$pid" 2>/dev/null || true; done; rm -rf "$tmp"; }
trap cleanup EXIT
mariadb-install-db --no-defaults --datadir="$tmp/mysql" --auth-root-authentication-method=normal --skip-test-db >/dev/null
mariadbd --no-defaults --datadir="$tmp/mysql" --socket="$tmp/mysql.sock" --port="$mysql_port" --bind-address=127.0.0.1 --pid-file="$tmp/mysql.pid" --log-error="$tmp/mysql.log" --skip-name-resolve --user="$(id -un)" & mysql_pid=$!
for _ in $(seq 1 60); do mariadb-admin --no-defaults --socket="$tmp/mysql.sock" ping --silent >/dev/null 2>&1 && break; sleep 1; done
mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot -e "CREATE DATABASE gojet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'gojet'@'127.0.0.1' IDENTIFIED BY 'integration'; GRANT ALL ON gojet.* TO 'gojet'@'127.0.0.1';"
for migration in database/migrations/*.sql; do mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot gojet <"$migration"; done
redis-server --port "$redis_port" --save '' --appendonly no --dir "$tmp" >"$tmp/redis.log" 2>&1 & redis_pid=$!
for _ in $(seq 1 60); do redis-cli -p "$redis_port" ping 2>/dev/null | grep -q PONG && break; sleep 1; done
go build -o "$tmp/platform" ./services/platformapi/cmd/server
go build -o "$tmp/redirect" ./services/redirectengine/cmd/server
go build -o "$tmp/worker" ./services/analyticsworker/cmd/worker
export MYSQL_DSN="gojet:integration@tcp(127.0.0.1:${mysql_port})/gojet?parseTime=true&charset=utf8mb4" REDIS_ADDRESS="127.0.0.1:${redis_port}"
export SETTINGS_ENCRYPTION_KEY="$(printf '0123456789abcdef0123456789abcdef' | base64 -w0)" ADMIN_BOOTSTRAP_EMAIL=admin@gojet.test ADMIN_BOOTSTRAP_PASSWORD=integration-admin-password
export QR_TRACKING_KEY=integration-qr-tracking-key-32-chars VISITOR_HASH_KEY=integration-visitor-hash-key-32-chars FILE_STORAGE_PATH="$tmp/files" UPLOAD_STORAGE_PATH="$tmp/uploads" PUBLIC_BASE_URL="http://127.0.0.1:${platform_port}"
PLATFORM_HTTP_ADDRESS="127.0.0.1:${platform_port}" "$tmp/platform" >"$tmp/platform.log" 2>&1 & platform_pid=$!
HTTP_ADDRESS="127.0.0.1:${redirect_port}" "$tmp/redirect" >"$tmp/redirect.log" 2>&1 & redirect_pid=$!
ANALYTICS_CONSUMER=full-stack-1 "$tmp/worker" >"$tmp/worker.log" 2>&1 & worker_pid=$!
for url in "http://127.0.0.1:${platform_port}/health" "http://127.0.0.1:${redirect_port}/health"; do for _ in $(seq 1 60); do curl -fsS "$url" >/dev/null 2>&1 && break; sleep 1; done; curl -fsS "$url" >/dev/null; done
mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot gojet -e "INSERT INTO system_settings(setting_key,setting_value,is_encrypted) VALUES ('cache.enabled','true',FALSE),('cache.default_ttl_seconds','60',FALSE) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)"
curl -fsS -D "$tmp/settings-first" -o /dev/null "http://127.0.0.1:${platform_port}/api/public/settings"
curl -fsS -D "$tmp/settings-second" -o /dev/null "http://127.0.0.1:${platform_port}/api/public/settings"
grep -qi '^X-GoJet-Cache: MISS' "$tmp/settings-first"
grep -qi '^X-GoJet-Cache: HIT' "$tmp/settings-second"
ttl="$(redis-cli -p "$redis_port" TTL gojet:cache:public-settings)"; test "$ttl" -gt 0 -a "$ttl" -le 60
register="$(curl -fsS -X POST "http://127.0.0.1:${platform_port}/api/auth/register" -H 'Content-Type: application/json' -d '{"email":"acceptance@gojet.test","password":"acceptance-password","display_name":"验收用户"}')"
token="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])' <<<"$register")"
workspaces="$(curl -fsS "http://127.0.0.1:${platform_port}/api/workspaces" -H "Authorization: Bearer $token")"
workspace_id="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["data"][0]["id"])' <<<"$workspaces")"
created="$(curl -fsS -X POST "http://127.0.0.1:${platform_port}/api/workspaces/${workspace_id}/links" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d '{"Code":"accept10","Destination":"https://example.com/landing","Title":"全链路验收","Status":"active","RedirectStatus":302}')"
link_id="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["ID"])' <<<"$created")"
for i in $(seq 1 10); do curl -sS -o /dev/null -D "$tmp/headers" -H "X-Request-ID: acceptance-request-$(printf '%02d' "$i")" "http://127.0.0.1:${redirect_port}/accept10"; grep -q '302' "$tmp/headers"; done
for _ in $(seq 1 60); do persisted="$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM analytics_events WHERE link_id='${link_id}'")"; test "$persisted" = 10 && break; sleep 1; done
stats="$(curl -fsS "http://127.0.0.1:${redirect_port}/api/links/${link_id}/stats")"
python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["clicks"]==10 and d["unique_visitors"]==1,d' <<<"$stats"
kill "$worker_pid"; wait "$worker_pid" 2>/dev/null || true; worker_pid=""
for i in $(seq 11 13); do curl -sS -o /dev/null "http://127.0.0.1:${redirect_port}/accept10"; done
test "$(redis-cli -p "$redis_port" GET "gojet:clicks:${link_id}")" = 13
test "$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM analytics_events WHERE link_id='${link_id}'")" = 10
ANALYTICS_CONSUMER=full-stack-2 "$tmp/worker" >"$tmp/worker-restarted.log" 2>&1 & worker_pid=$!
for _ in $(seq 1 60); do persisted="$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM analytics_events WHERE link_id='${link_id}'")"; test "$persisted" = 13 && break; sleep 1; done
test "$persisted" = 13
request_ids="$(mariadb --no-defaults --socket="$tmp/mysql.sock" -N -uroot gojet -e "SELECT COUNT(*) FROM analytics_events WHERE link_id='${link_id}' AND request_id LIKE 'acceptance-request-%'")"
test "$request_ids" = 10
mariadb --no-defaults --socket="$tmp/mysql.sock" -uroot gojet -e "INSERT INTO system_settings(setting_key,setting_value,is_encrypted) VALUES ('api.enabled','false',FALSE) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)"
status="$(curl -sS -o "$tmp/api-disabled" -w '%{http_code}' "http://127.0.0.1:${platform_port}/api/workspaces" -H "Authorization: Bearer $token")"
test "$status" = 503; grep -q 'API 已由管理员暂停' "$tmp/api-disabled"
curl -fsS "http://127.0.0.1:${platform_port}/health" >/dev/null
echo "full-stack acceptance passed: link=${link_id} redis_clicks=13 mysql_events=13 correlated_events=${request_ids}"
