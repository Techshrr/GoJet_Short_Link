#!/usr/bin/env bash
set -euo pipefail

API_BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
PUBLIC_BASE=${GOJET_PUBLIC_BASE:-http://127.0.0.1:18080}
UPLOAD_ROOT=${UPLOAD_STORAGE_PATH:-/tmp/gojet/uploads}
GENERATED_QR_ROOT=${GENERATED_QR_STORAGE_PATH:-}
if [[ -z "$GENERATED_QR_ROOT" ]]; then
  if [[ "$(basename "$UPLOAD_ROOT")" == "uploads" ]]; then
    GENERATED_QR_ROOT="$(dirname "$UPLOAD_ROOT")/generated/qr"
  else
    GENERATED_QR_ROOT="$UPLOAD_ROOT"
  fi
fi
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}

for command in curl python3 mysql zbarimg; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){ local method=$1 path=$2 body=${3:-} token=${4:-}; local args=(-sS -X "$method" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$token" ]]&&args+=(-H "Authorization: Bearer $token"); [[ -n "$body" ]]&&args+=(--data "$body"); curl "${args[@]}" "$API_BASE$path"; }
expect(){ local wanted=$1 raw=$2 label=$3; local code body; code=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$code" == "$wanted" ]]||{ echo "FAIL: $label expected $wanted got $code" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }
public_code(){ curl -sS -o /dev/null -w '%{http_code}' "$PUBLIC_BASE/$1"; }

for _ in $(seq 1 60); do
  curl -fsS "$API_BASE/health" >/dev/null 2>&1 && curl -fsS "$PUBLIC_BASE/health" >/dev/null 2>&1 && break
  sleep 1
done

suffix=$(date +%s)
email="qr-$suffix@example.test"
body=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"$email\",\"display_name\":\"二维码验收用户\",\"password\":\"QRRealPassword!2026\"}")" register)
token=$(printf '%s' "$body"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
code="qrreal$suffix"
expect 201 "$(req POST "/api/workspaces/$wid/links" "{\"destination\":\"https://example.com/qr-real\",\"code\":\"$code\",\"redirect_status\":302,\"status\":\"active\"}" "$token")" create-link >/dev/null
link_id=$(mysqlq "SELECT id FROM short_links WHERE workspace_id=$wid AND code='$code' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1;")
[[ -n "$link_id" ]] || { echo 'created link missing' >&2; exit 1; }

qr_body=$(expect 201 "$(req POST "/api/workspaces/$wid/qr-codes" "{\"link_id\":$link_id,\"name\":\"真实扫码验收\",\"foreground\":\"#0B1220\",\"background\":\"#FFFFFF\",\"size\":512}" "$token")" create-qr)
qr_id=$(printf '%s' "$qr_body"|field "['id']")
image_url=$(printf '%s' "$qr_body"|field "['image_url']")
[[ "$image_url" == /generated/qr/qr-*.png ]] || { echo "QR URL escaped generated namespace: $image_url" >&2; exit 1; }
image_name=${image_url#/generated/qr/}
[[ "$(basename "$image_name")" == "$image_name" ]] || { echo "unsafe QR image name: $image_name" >&2; exit 1; }
image_path="$GENERATED_QR_ROOT/$image_name"
[[ -s "$image_path" ]] || { echo "QR PNG missing: $image_path" >&2; exit 1; }

# Ensure the generated QR did not leak back into the user-upload namespace.
[[ ! -e "$UPLOAD_ROOT/$image_name" ]] || { echo "QR PNG leaked into user upload namespace: $UPLOAD_ROOT/$image_name" >&2; exit 1; }

decoded=$(zbarimg --quiet --raw "$image_path" | tr -d '\r\n')
[[ "$decoded" == "$PUBLIC_BASE/$code?"*'_gojet_qr='* ]] || { echo "decoded QR target unexpected: $decoded" >&2; exit 1; }

# Risk assessment is asynchronous by design. A fresh link may be fail-closed for
# a short period; wait until operationsmonitor persists ALLOW and the redirect
# data plane publishes the matching target-fingerprint decision before asserting
# the real QR redirect. This preserves the security boundary instead of bypassing it.
risk_decision=''
redirect_code=''
for i in $(seq 1 20); do
  risk_decision=$(mysqlq "SELECT COALESCE(manual_decision,decision) FROM link_destination_risk WHERE link_id=$link_id LIMIT 1;" 2>/dev/null || true)
  redirect_code=$(public_code "$code")
  if [[ "$risk_decision" == allow && "$redirect_code" == 302 ]]; then
    break
  fi
  sleep 1
  [[ $i -lt 20 ]] || { echo "QR link risk approval did not converge: decision=${risk_decision:-missing} http=${redirect_code:-missing}" >&2; exit 1; }
done

headers=$(mktemp)
cleanup(){ rm -f "$headers"; }
trap cleanup EXIT
curl -sS -D "$headers" -o /dev/null "$decoded"
grep -Eq '^HTTP/[^ ]+ 302' "$headers" || { cat "$headers" >&2; echo 'decoded QR did not redirect after risk approval' >&2; exit 1; }
location=$(tr -d '\r' < "$headers" | sed -n 's/^Location:[[:space:]]*//Ip' | head -n1)
[[ "$location" == 'https://example.com/qr-real' ]] || { cat "$headers" >&2; printf 'decoded QR destination mismatch: %s\n' "$location" >&2; exit 1; }

count=0
for _ in $(seq 1 60); do
  count=$(mysqlq "SELECT COUNT(*) FROM analytics_events WHERE link_id=$link_id AND visit_type='qr';")
  [[ "$count" -ge 1 ]] && break
  sleep .5
done
[[ "$count" -ge 1 ]] || { echo 'QR visit was not persisted by analytics worker' >&2; exit 1; }

list=$(expect 200 "$(req GET "/api/workspaces/$wid/qr-codes" '' "$token")" list-qr)
printf '%s' "$list" | python3 -c "import json,sys; d=json.load(sys.stdin); item=next(x for x in d['data'] if int(x['id'])==$qr_id); assert int(item['qr_visits']) >= 1, item; assert item['image_url'].startswith('/generated/qr/'), item"

printf 'GoJet real QR decode -> risk approval -> redirect -> qr_visits acceptance: PASS\n'
