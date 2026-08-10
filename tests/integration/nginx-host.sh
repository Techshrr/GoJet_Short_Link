#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

for command in nginx python3 curl grep sed; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }
done

# Every supported deployment must route the three public product surfaces to
# platform-api instead of falling through to the redirect engine.
for config in \
  deploy/nginx/gojet-bt-rewrite.conf \
  deploy/nginx/gojet.conf \
  deploy/nginx/gojet-host.conf \
  deploy/nginx/gojet-native.conf
do
  echo "checking public resource routes in $config"
  grep -Eq '\^/t/|location [^\n]*/t/' "$config" || { echo "$config missing /t route" >&2; exit 1; }
  grep -Eq '\^/p/|location [^\n]*/p/' "$config" || { echo "$config missing /p route" >&2; exit 1; }
  grep -Eq '\^/f/|location [^\n]*/f/' "$config" || { echo "$config missing /f route" >&2; exit 1; }
  grep -q 'platform-api\|127.0.0.1:18090' "$config" || { echo "$config does not target platform-api" >&2; exit 1; }
done

tmp="$(mktemp -d)"
cleanup(){
  for pid in "${nginx_pid:-}" "${platform_pid:-}" "${redirect_pid:-}"; do
    test -z "$pid" || kill "$pid" 2>/dev/null || true
  done
  rm -rf "$tmp"
}
trap cleanup EXIT

cat >"$tmp/upstream.py" <<'PY'
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import sys
label=sys.argv[2].encode()
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200)
  self.send_header('Content-Type','text/plain')
  self.end_headers()
  self.wfile.write(label)
 def log_message(self,*args): pass
ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])),Handler).serve_forever()
PY

# Full-stack acceptance already runs the real GoJet services on 18080/18090.
# Use isolated upstream ports here so this routing test cannot accidentally hit
# those processes and produce a false pass/failure.
REDIRECT_TEST_PORT=18180
PLATFORM_TEST_PORT=18190
NGINX_TEST_PORT=18081
python3 "$tmp/upstream.py" "$REDIRECT_TEST_PORT" redirect-engine >"$tmp/redirect.log" 2>&1 & redirect_pid=$!
python3 "$tmp/upstream.py" "$PLATFORM_TEST_PORT" platform-api >"$tmp/platform.log" 2>&1 & platform_pid=$!
for port in "$REDIRECT_TEST_PORT" "$PLATFORM_TEST_PORT"; do
  ready=0
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$port/health" >/dev/null 2>&1; then ready=1; break; fi
    sleep .2
  done
  if [[ "$ready" != 1 ]]; then
    echo "isolated test upstream did not become ready on port $port" >&2
    cat "$tmp/redirect.log" >&2 || true
    cat "$tmp/platform.log" >&2 || true
    exit 1
  fi
done

# Rewrite only the temporary runtime copy. The checked-in production config
# remains pinned to the real native ports 18080/18090.
sed \
  -e "s|__GOJET_ROOT__|$(pwd)|g" \
  -e "s/listen 80;/listen 127.0.0.1:$NGINX_TEST_PORT;/" \
  -e "s/127\.0\.0\.1:18080/127.0.0.1:$REDIRECT_TEST_PORT/g" \
  -e "s/127\.0\.0\.1:18090/127.0.0.1:$PLATFORM_TEST_PORT/g" \
  deploy/nginx/gojet-host.conf >"$tmp/gojet.conf"

# Guard the test fixture itself: both isolated ports must actually be present in
# the generated Nginx config or the test would not prove upstream ownership.
grep -Fq "127.0.0.1:$REDIRECT_TEST_PORT" "$tmp/gojet.conf" || { echo 'temporary Host Nginx config did not isolate redirect-engine upstream' >&2; exit 1; }
grep -Fq "127.0.0.1:$PLATFORM_TEST_PORT" "$tmp/gojet.conf" || { echo 'temporary Host Nginx config did not isolate platform-api upstream' >&2; exit 1; }

cat >"$tmp/nginx.conf" <<EOF2
pid $tmp/nginx.pid;
events {}
http {
  include /etc/nginx/mime.types;
  access_log off;
  error_log $tmp/error.log;
  include $tmp/gojet.conf;
}
EOF2

nginx -t -c "$tmp/nginx.conf" -p "$tmp"
nginx -c "$tmp/nginx.conf" -p "$tmp" -g 'daemon off;' & nginx_pid=$!
ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$NGINX_TEST_PORT/" >/dev/null 2>&1; then ready=1; break; fi
  sleep .2
done
[[ "$ready" == 1 ]] || { echo 'host Nginx did not become ready'; cat "$tmp/error.log" >&2 || true; exit 1; }

assert_contains(){
  local path=$1 needle=$2 label=$3 body code
  body=$(mktemp "$tmp/body.XXXXXX")
  code=$(curl -sS -o "$body" -w '%{http_code}' "http://127.0.0.1:$NGINX_TEST_PORT$path")
  if [[ "$code" != 200 ]] || ! grep -Fq "$needle" "$body"; then
    echo "host Nginx assertion failed: $label; path=$path status=$code expected text=[$needle]" >&2
    cat "$body" >&2 || true
    cat "$tmp/error.log" >&2 || true
    exit 1
  fi
}
assert_upstream(){
  local path=$1 wanted=$2 label=$3 body code actual
  body=$(mktemp "$tmp/upstream.XXXXXX")
  code=$(curl -sS -o "$body" -w '%{http_code}' "http://127.0.0.1:$NGINX_TEST_PORT$path")
  actual=$(cat "$body")
  if [[ "$code" != 200 || "$actual" != "$wanted" ]]; then
    echo "host Nginx assertion failed: $label; path=$path status=$code expected=[$wanted] actual=[$actual]" >&2
    cat "$tmp/error.log" >&2 || true
    exit 1
  fi
}

assert_contains / 'GoJet' 'marketing root'
assert_contains /app/ 'GoJet 控制台' 'user console'
assert_contains /admin/ 'GoJet 管理中心' 'administrator console'
assert_upstream /api/public/status platform-api 'public API to platform-api'
assert_upstream /t/demo platform-api 'text share to platform-api'
assert_upstream /p/demo platform-api 'bio page to platform-api'
assert_upstream /f/demo platform-api 'file share to platform-api'
assert_upstream /example-code redirect-engine 'short link fallback to redirect-engine'

printf 'four-deployment public routing and host Nginx acceptance passed\n'
