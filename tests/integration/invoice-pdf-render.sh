#!/usr/bin/env bash
set -euo pipefail

BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}
OUT_DIR=${PDF_ACCEPTANCE_OUT:-/tmp/gojet-pdf-acceptance}
mkdir -p "$OUT_DIR"

mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){
  local method=$1 path=$2 body=${3:-} token=${4:-}
  local args=(-sS -X "$method" -H 'Content-Type: application/json' -w $'\n%{http_code}')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(--data "$body")
  curl "${args[@]}" "$BASE$path"
}
expect(){
  local want=$1 raw=$2 label=$3 got body
  got=$(printf '%s\n' "$raw" | tail -n1)
  body=$(printf '%s\n' "$raw" | sed '$d')
  [[ "$got" == "$want" ]] || { echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }
  printf '%s' "$body"
}
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

# Create a deterministic invoice with a frozen FX snapshot so the rendered PDF
# exercises both ordinary billing fields and the conversion section.
mysqlq "UPDATE plans SET monthly_price_cents=1234,currency='USD' WHERE code='pro';"
mysqlq "UPDATE system_settings SET setting_value='CNY',is_encrypted=FALSE WHERE setting_key='billing.settlement_currency';"
mysqlq "UPDATE system_settings SET setting_value='manual',is_encrypted=FALSE WHERE setting_key='billing.fx.provider';"
mysqlq "UPDATE system_settings SET setting_value='0',is_encrypted=FALSE WHERE setting_key='billing.fx.markup_bps';"
mysqlq "UPDATE system_settings SET setting_value='{\"USD/CNY\":\"7.20\"}',is_encrypted=FALSE WHERE setting_key='billing.fx.manual_rates';"
mysqlq "DELETE FROM fx_rate_cache;"

suffix="$(date +%s)-$RANDOM"
registration=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"pdf-$suffix@example.test\",\"display_name\":\"PDF Render Acceptance\",\"password\":\"PDFRenderAcceptance!2026\"}")" register)
token=$(printf '%s' "$registration" | field "['token']")
workspaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$workspaces" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
invoice=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"purchase"}' "$token")" create-invoice)
invoice_id=$(printf '%s' "$invoice" | field "['id']")
invoice_number=$(mysqlq "SELECT invoice_number FROM billing_invoices WHERE id=$invoice_id AND workspace_id=$wid;")
amount=$(mysqlq "SELECT CONCAT(UPPER(currency),' ',FORMAT(amount_cents/100,2,'en_US')) FROM billing_invoices WHERE id=$invoice_id AND workspace_id=$wid;")

headers="$OUT_DIR/invoice.headers"
pdf="$OUT_DIR/invoice.pdf"
curl -fsS -D "$headers" -H "Authorization: Bearer $token" -o "$pdf" "$BASE/api/workspaces/$wid/billing/invoices/$invoice_id/pdf"

grep -Eiq '^content-type:[[:space:]]*application/pdf' "$headers"
grep -Eiq '^cache-control:.*private.*no-store' "$headers"
grep -Fq '%PDF-' < <(head -c 8 "$pdf")
test "$(wc -c < "$pdf")" -gt 1500

pdfinfo "$pdf" | tee "$OUT_DIR/pdfinfo.txt"
grep -Eq '^Pages:[[:space:]]+1$' "$OUT_DIR/pdfinfo.txt"
grep -Eq '^Page size:[[:space:]]+595 x 842 pts' "$OUT_DIR/pdfinfo.txt"

pdftotext -enc UTF-8 "$pdf" "$OUT_DIR/invoice.txt"
grep -Fq "$invoice_number" "$OUT_DIR/invoice.txt"
grep -Fq 'GoJet' "$OUT_DIR/invoice.txt"
grep -Fq 'USD 12.34' "$OUT_DIR/invoice.txt"
grep -Fq "$amount" "$OUT_DIR/invoice.txt"

# Render twice: PNG is retained as a human-inspectable artifact; PPM lets CI
# inspect actual pixels using only Python's standard library.
pdftoppm -f 1 -singlefile -r 144 -png "$pdf" "$OUT_DIR/invoice-page" >/dev/null
pdftoppm -f 1 -singlefile -r 72 -ppm "$pdf" "$OUT_DIR/invoice-pixels" >/dev/null

python3 - "$OUT_DIR/invoice-pixels.ppm" <<'PY'
import sys
from pathlib import Path

path=Path(sys.argv[1])
with path.open('rb') as f:
    if f.readline().strip()!=b'P6':
        raise SystemExit('render output is not binary PPM')
    tokens=[]
    while len(tokens)<3:
        line=f.readline()
        if not line:
            raise SystemExit('truncated PPM header')
        line=line.split(b'#',1)[0]
        tokens.extend(line.split())
    width,height,maxval=map(int,tokens[:3])
    pixels=f.read()

if (width,height)!=(595,842):
    raise SystemExit(f'unexpected rendered dimensions: {width}x{height}')
if maxval!=255:
    raise SystemExit(f'unexpected PPM max value: {maxval}')
expected=width*height*3
if len(pixels)!=expected:
    raise SystemExit(f'truncated pixel data: {len(pixels)} != {expected}')
nonwhite=sum(1 for i in range(0,len(pixels),3) if pixels[i:i+3] < b'\xfa\xfa\xfa')
if nonwhite < 5000:
    raise SystemExit(f'rendered page appears blank: only {nonwhite} non-white pixels')
print(f'PDF raster acceptance: {width}x{height}, non-white pixels={nonwhite}')
PY

test -s "$OUT_DIR/invoice-page.png"
file "$OUT_DIR/invoice-page.png" | tee "$OUT_DIR/render-file.txt"
grep -Fq 'PNG image data' "$OUT_DIR/render-file.txt"

printf 'GoJet invoice PDF real render acceptance: PASS (%s, %s)\n' "$invoice_number" "$amount"
