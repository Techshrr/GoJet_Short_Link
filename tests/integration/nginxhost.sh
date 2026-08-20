#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

for command in nginx python3 curl grep sed; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }
done

for config in \
  deploy/nginx/gojetbtrewrite.conf \
  deploy/nginx/gojet.conf \
  deploy/nginx/gojethost.conf \
  deploy/nginx/gojetnative.conf
do
  echo "checking public resource routes in $config"
  grep -Eq '\^/t/|location [^\n]*/t/' "$config" || { echo "$config missing /t route" >&2; exit 1; }
  grep -Eq '\^/p/|location [^\n]*/p/' "$config" || { echo "$config missing /p route" >&2; exit 1; }
  grep -Eq '\^/f/|location [^\n]*/f/' "$config" || { echo "$config missing /f route" >&2; exit 1; }
  grep -q 'platformapi\|127.0.0.1:18090' "$config" || { echo "$config does not target platformapi" >&2; exit 1; }
done

for config in deploy/nginx/gojet.conf deploy/nginx/gojethost.conf deploy/nginx/gojetnative.conf deploy/nginx/gojetbtrewrite.conf; do
  grep -Fq 'try_files $uri $uri.html $uri/index.html' "$config" || { echo "$config does not map clean public URLs to flat or nested HTML files" >&2; exit 1; }
done

tmp="$(mktemp -d)"
cleanup(){
  for pid in "${nginx_pid:-}" "${platform_pid:-}" "${redirect_pid:-}"; do
    test -z "$pid" || kill "$pid" 2>/dev/null || true
  done
  rm -rf "$tmp"
}
trap cleanup EXIT

stage="$tmp/gojetinstall"
mkdir -p "$stage/public/app" "$stage/public/admin" \
  "$stage/deploy/data/brand" "$stage/deploy/data/generated/qr" "$stage/deploy/data/uploads"
python3 scripts/buildpublicsite.py --output "$stage/public"
cp -a frontend/userconsole/. "$stage/public/app/"
cp -a frontend/adminconsole/. "$stage/public/admin/"
test -s "$stage/public/index.html"
test -s "$stage/public/privacy.html"
test -s "$stage/public/terms.html"
test -s "$stage/public/forgotpassword.html"
test -s "$stage/public/reportabuse.html"
test -s "$stage/public/products/urlshortener.html"
test -s "$stage/public/app/index.html"
test -s "$stage/public/admin/index.html"
test -z "$(find "$stage/public" -mindepth 2 -type f -name index.html ! -path "$stage/public/app/index.html" ! -path "$stage/public/admin/index.html" -print -quit)"

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

REDIRECT_TEST_PORT=18180
PLATFORM_TEST_PORT=18190
NGINX_TEST_PORT=18081
python3 "$tmp/upstream.py" "$REDIRECT_TEST_PORT" redirectengine >"$tmp/redirect.log" 2>&1 & redirect_pid=$!
python3 "$tmp/upstream.py" "$PLATFORM_TEST_PORT" platformapi >"$tmp/platform.log" 2>&1 & platform_pid=$!
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

sed \
  -e "s|__GOJET_ROOT__|$stage|g" \
  -e "s/listen 80;/listen 127.0.0.1:$NGINX_TEST_PORT;/" \
  -e "s/127\.0\.0\.1:18080/127.0.0.1:$REDIRECT_TEST_PORT/g" \
  -e "s/127\.0\.0\.1:18090/127.0.0.1:$PLATFORM_TEST_PORT/g" \
  deploy/nginx/gojethost.conf >"$tmp/gojet.conf"

grep -Fq "root $stage/public;" "$tmp/gojet.conf" || { echo 'temporary Host Nginx config does not use packaged public root' >&2; exit 1; }
grep -Fq "alias $stage/public/app/;" "$tmp/gojet.conf" || { echo 'temporary Host Nginx config does not use packaged customer console' >&2; exit 1; }
grep -Fq "alias $stage/public/admin/;" "$tmp/gojet.conf" || { echo 'temporary Host Nginx config does not use packaged administrator console' >&2; exit 1; }
grep -Fq 'try_files $uri $uri.html $uri/index.html @redirect;' "$tmp/gojet.conf" || { echo 'temporary Host Nginx config does not use canonical clean URL mapping' >&2; exit 1; }
grep -Fq "127.0.0.1:$REDIRECT_TEST_PORT" "$tmp/gojet.conf" || { echo 'temporary Host Nginx config did not isolate redirectengine upstream' >&2; exit 1; }
grep -Fq "127.0.0.1:$PLATFORM_TEST_PORT" "$tmp/gojet.conf" || { echo 'temporary Host Nginx config did not isolate platformapi upstream' >&2; exit 1; }

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

assert_contains / 'GoJet' 'public root'
assert_contains /privacy '隐私政策' 'flat privacy page'
assert_contains /terms '服务条款' 'flat terms page'
assert_contains /forgotpassword '找回密码' 'flat password recovery page'
assert_contains /reportabuse '举报' 'flat abuse report page'
assert_contains /products/urlshortener '短链接' 'flat grouped product page'
assert_contains /app/ 'GoJet 控制台' 'user console'
assert_contains /admin/ 'GoJet 管理中心' 'administrator console'
assert_upstream /api/public/status platformapi 'public API to platformapi'
assert_upstream /t/demo platformapi 'text share to platformapi'
assert_upstream /p/demo platformapi 'bio page to platformapi'
assert_upstream /f/demo platformapi 'file share to platformapi'
assert_upstream /examplecode redirectengine 'short link fallback to redirectengine'

printf 'flat packaged public tree and four deployment Nginx routing acceptance passed\n'
