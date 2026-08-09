#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
for command in nginx python3 curl; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done
tmp="$(mktemp -d)"
cleanup(){ for pid in "${nginx_pid:-}" "${platform_pid:-}" "${redirect_pid:-}"; do test -z "$pid" || kill "$pid" 2>/dev/null || true; done; rm -rf "$tmp"; }
trap cleanup EXIT
cat >"$tmp/upstream.py" <<'PY'
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import sys
label=sys.argv[2].encode()
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200);self.send_header('Content-Type','text/plain');self.end_headers();self.wfile.write(label)
 def log_message(self,*args): pass
ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1])),Handler).serve_forever()
PY
python3 "$tmp/upstream.py" 18080 redirect-engine >"$tmp/redirect.log" 2>&1 & redirect_pid=$!
python3 "$tmp/upstream.py" 18090 platform-api >"$tmp/platform.log" 2>&1 & platform_pid=$!
for port in 18080 18090; do for _ in $(seq 1 30); do curl -fsS "http://127.0.0.1:$port/health" >/dev/null 2>&1 && break; sleep .2; done; done
sed -e "s|__GOJET_ROOT__|$(pwd)|g" -e 's/listen 80;/listen 127.0.0.1:18081;/' deploy/nginx/gojet-host.conf >"$tmp/gojet.conf"
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
for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:18081/ >/dev/null 2>&1 && break; sleep .2; done
curl -fsS http://127.0.0.1:18081/ | grep -q 'GoJet'
curl -fsS http://127.0.0.1:18081/app/ | grep -q 'GoJet 控制台'
curl -fsS http://127.0.0.1:18081/admin/ | grep -q 'GoJet 平台管理'
test "$(curl -fsS http://127.0.0.1:18081/api/public/status)" = platform-api
test "$(curl -fsS http://127.0.0.1:18081/example-code)" = redirect-engine
printf 'host Nginx routing acceptance passed\n'
