#!/usr/bin/env bash
set -euo pipefail

API_BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
PUBLIC_BASE=${GOJET_PUBLIC_BASE:-http://127.0.0.1:18080}
UPLOAD_ROOT=${UPLOAD_STORAGE_PATH:-/tmp/gojet/uploads}
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

for _ in $(seq 1 60); do curl -fsS "$API_BASE/health" >/dev/null 2>&1 && curl -fsS "$PUBLIC_BASE/health" >/dev/null 2>&1 && break; sleep 1; done

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
qr_id=$(printf '%s' "$qr_body"|field "['ID']")
image_url=$(printf '%s' "$qr_body"|field "['ImageURL']")
image_path="$UPLOAD_ROOT/${image_url#/uploads/}"
[[ -s "$image_path" ]] || { echo "QR PNG missing: $image_path" >&2; exit 1; }

decoded=$(zbarimg --quiet --raw "$image_path" | tr -d '\r\n')
[[ "$decoded" == "$PUBLIC_BASE/$code?"*'_gojet_qr='* ]] || { echo "decoded QR target unexpected: $decoded" >&2; exit 1; }

headers=$(mktemp)
trap 'rm -f "$headers"' EXIT
curl -sS -D "$headers" -o /dev/null "$decoded"
grep -Eq '^HTTP/[^ ]+ 302' "$headers" || { cat "$headers" >&2; echo 'decoded QR did not redirect' >&2; exit 1; }
grep -Eiq '^Location: https://example\.com/qr-real\r?$' "$headers" || { cat "$headers" >&2; echo 'decoded QR destination mismatch' >&2; exit 1; }

for _ in $(seq 1 60); do
  count=$(mysqlq "SELECT COUNT(*) FROM analytics_events WHERE link_id=$link_id AND visit_type='qr';")
  [[ "$count" -ge 1 ]] && break
  sleep .5
done
[[ "${count:-0}" -ge 1 ]] || { echo 'QR visit was not persisted by analytics worker' >&2; exit 1; }

list=$(expect 200 "$(req GET "/api/workspaces/$wid/qr-codes" '' "$token")" list-qr)
printf '%s' "$list" | python3 -c "import json,sys; d=json.load(sys.stdin); item=next(x for x in d['data'] if int(x['id'])==$qr_id); assert int(item['qr_visits']) >= 1, item"

printf 'GoJet real QR decode -> redirect -> qr_visits acceptance: PASS\n'
