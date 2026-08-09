#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v clamd >/dev/null || { echo "clamd is required" >&2; exit 1; }
test -s /var/lib/clamav/main.cvd -o -s /var/lib/clamav/main.cld || { echo "ClamAV signatures are required (run freshclam)" >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'test -n "${pid:-}" && kill "$pid" 2>/dev/null || true; rm -rf "$tmp"' EXIT
cat >"$tmp/clamd.conf" <<EOF
Foreground true
LogFile $tmp/clamd.log
PidFile $tmp/clamd.pid
DatabaseDirectory /var/lib/clamav
TCPSocket 3319
TCPAddr 127.0.0.1
User $(id -un)
StreamMaxLength 110M
EOF
clamd --config-file="$tmp/clamd.conf" >"$tmp/stdout.log" 2>&1 & pid=$!
for _ in $(seq 1 60); do
  if bash -c 'exec 3<>/dev/tcp/127.0.0.1/3319' 2>/dev/null; then break; fi
  sleep 1
done
kill -0 "$pid" 2>/dev/null || { cat "$tmp/stdout.log" "$tmp/clamd.log" >&2; exit 1; }
INTEGRATION_CLAMAV_ADDRESS=127.0.0.1:3319 go test -race -tags integration_clamav ./app/resources
