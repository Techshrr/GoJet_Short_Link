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

mysqlq "UPDATE plans SET monthly_price_cents=1234,currency='USD' WHERE code='pro';"
mysqlq "UPDATE system_settings SET setting_value='CNY',is_encrypted=FALSE WHERE setting_key='billing.settlement_currency';"
mysqlq "UPDATE system_settings SET setting_value='manual',is_encrypted=FALSE WHERE setting_key='billing.fx.provider';"
mysqlq "UPDATE system_settings SET setting_value='0',is_encrypted=FALSE WHERE setting_key='billing.fx.markup_bps';"
mysqlq "UPDATE system_settings SET setting_value='{\"USD/CNY\":\"7.20\"}',is_encrypted=FALSE WHERE setting_key='billing.fx.manual_rates';"
mysqlq "DELETE FROM fx_rate_cache;"

# Production Native uses the system Noto CJK collection. Glyph correctness is
# validated below through the actual generated PDF (pdftotext + raster), rather
# than a source-tree fontTools preflight against a legacy bundled font path.
PDF_FONT_PATH=${PDF_FONT_PATH:-/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc}
[[ -f "$PDF_FONT_PATH" ]] || { echo "production PDF font missing: $PDF_FONT_PATH" >&2; exit 1; }
printf 'Production PDF font present: %s\n' "$PDF_FONT_PATH"

logo="$OUT_DIR/acceptance-logo.png"
python3 - "$logo" <<'PY'
import struct,sys,zlib
from pathlib import Path
w,h=160,48
raw=bytearray()
for y in range(h):
    raw.append(0)
    for x in range(w):
        if 8 <= x < 44 and 8 <= y < 40:
            rgba=(22,166,106,255)
        elif 54 <= x < 148 and 17 <= y < 31:
            rgba=(18,28,24,255)
        else:
            rgba=(255,255,255,0)
        raw.extend(rgba)
def chunk(kind,data):
    return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
Path(sys.argv[1]).write_bytes(png)
PY
admin=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login)
admin_token=$(printf '%s' "$admin" | field "['token']")
logo_status=$(curl -sS -o "$OUT_DIR/logo-upload.json" -w '%{http_code}' -H "Authorization: Bearer $admin_token" -F "file=@$logo;type=image/png" "$BASE/api/admin/brand/logo")
[[ "$logo_status" == 201 ]] || { echo "FAIL brand-logo-upload expected 201 got $logo_status" >&2; cat "$OUT_DIR/logo-upload.json" >&2; exit 1; }
grep -Fq '"url":"/assets/images/logo.png"' "$OUT_DIR/logo-upload.json"

suffix="$(date +%s)-$RANDOM"
registration=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"pdf-$suffix@example.test\",\"display_name\":\"霍召席账单验收\",\"password\":\"PDFRenderAcceptance!2026\"}")" register)
token=$(printf '%s' "$registration" | field "['token']")
workspaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$workspaces" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
workspace_name=$(mysqlq "SELECT name FROM workspaces WHERE id=$wid;")
[[ "$workspace_name" == '霍召席账单验收 的工作区' ]] || { echo "unexpected Chinese workspace name: $workspace_name" >&2; exit 1; }
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

# Browser-facing download flow: prepare over authenticated JSON, then consume a
# short-lived native URL exactly once. This is the production path used by the UI.
ticket=$(expect 200 "$(req POST "/api/workspaces/$wid/billing/invoices/$invoice_id/download-ticket" '{}' "$token")" prepare-download)
download_url=$(printf '%s' "$ticket" | field "['url']")
download_filename=$(printf '%s' "$ticket" | field "['filename']")
[[ "$download_url" == /api/public/invoice-download/* ]] || { echo "unexpected invoice download URL: $download_url" >&2; exit 1; }
[[ "$download_filename" == GoJetInvoice*.pdf ]] || { echo "unexpected invoice filename: $download_filename" >&2; exit 1; }
prepared_headers="$OUT_DIR/prepared-invoice.headers"
prepared_pdf="$OUT_DIR/prepared-invoice.pdf"
curl -fsS -D "$prepared_headers" -o "$prepared_pdf" "$BASE$download_url"
grep -Eiq '^content-type:[[:space:]]*application/pdf' "$prepared_headers"
grep -Eiq '^content-disposition:.*attachment' "$prepared_headers"
grep -Fq '%PDF-' < <(head -c 8 "$prepared_pdf")
test "$(wc -c < "$prepared_pdf")" -gt 1500
second_status=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$download_url")
[[ "$second_status" == 404 ]] || { echo "prepared invoice URL must be single-use; got $second_status" >&2; exit 1; }

pdfinfo "$pdf" | tee "$OUT_DIR/pdfinfo.txt"
grep -Eq '^Pages:[[:space:]]+1$' "$OUT_DIR/pdfinfo.txt"
grep -Eq '^Page size:[[:space:]]+595 x 842 pts' "$OUT_DIR/pdfinfo.txt"

pdftotext -enc UTF-8 "$pdf" "$OUT_DIR/invoice.txt"
grep -Fq "$invoice_number" "$OUT_DIR/invoice.txt"
grep -Fq 'GoJet' "$OUT_DIR/invoice.txt"
grep -Fq '账单' "$OUT_DIR/invoice.txt"
grep -Fq '账单编号' "$OUT_DIR/invoice.txt"
grep -Fq '服务方' "$OUT_DIR/invoice.txt"
grep -Fq '客户 / 工作区' "$OUT_DIR/invoice.txt"
grep -Fq "$workspace_name" "$OUT_DIR/invoice.txt"
grep -Fq '专业版' "$OUT_DIR/invoice.txt"
grep -Fq '购买套餐' "$OUT_DIR/invoice.txt"
grep -Fq '最终结算金额' "$OUT_DIR/invoice.txt"
grep -Fq '此账单由 GoJet 自动生成。金额与汇率以账单生成时保存的快照为准。' "$OUT_DIR/invoice.txt"
grep -Fq 'USD 12.34' "$OUT_DIR/invoice.txt"
grep -Fq "$amount" "$OUT_DIR/invoice.txt"
if grep -Fq '�' "$OUT_DIR/invoice.txt"; then
  echo 'PDF extracted text contains Unicode replacement characters' >&2
  cat "$OUT_DIR/invoice.txt" >&2
  exit 1
fi

pdfimages -list "$pdf" | tee "$OUT_DIR/pdfimages.txt"
awk 'NR>2 && $3=="image" { found=1 } END { exit(found?0:1) }' "$OUT_DIR/pdfimages.txt" || { echo 'configured brand logo was not embedded in invoice PDF' >&2; exit 1; }

pdftoppm -f 1 -singlefile -r 144 -png "$pdf" "$OUT_DIR/invoice-page" >/dev/null
pdftoppm -f 1 -singlefile -r 72 "$pdf" "$OUT_DIR/invoice-pixels" >/dev/null

python3 - "$OUT_DIR/invoice-pixels.ppm" <<'PY'
import sys
from pathlib import Path
path=Path(sys.argv[1])
with path.open('rb') as f:
    if f.readline().strip()!=b'P6': raise SystemExit('render output is not binary PPM')
    tokens=[]
    while len(tokens)<3:
        line=f.readline()
        if not line: raise SystemExit('truncated PPM header')
        line=line.split(b'#',1)[0]; tokens.extend(line.split())
    width,height,maxval=map(int,tokens[:3]); pixels=f.read()
if (width,height)!=(595,842): raise SystemExit(f'unexpected rendered dimensions: {width}x{height}')
if maxval!=255: raise SystemExit(f'unexpected PPM max value: {maxval}')
expected=width*height*3
if len(pixels)!=expected: raise SystemExit(f'truncated pixel data: {len(pixels)} != {expected}')
nonwhite=sum(1 for i in range(0,len(pixels),3) if pixels[i:i+3] < b'\xfa\xfa\xfa')
if nonwhite < 5000: raise SystemExit(f'rendered page appears blank: only {nonwhite} non-white pixels')
print(f'PDF raster acceptance: {width}x{height}, non-white pixels={nonwhite}')
PY

test -s "$OUT_DIR/invoice-page.png"
file "$OUT_DIR/invoice-page.png" | tee "$OUT_DIR/render-file.txt"
grep -Fq 'PNG image data' "$OUT_DIR/render-file.txt"
printf 'GoJet invoice PDF real Chinese render and prepared download acceptance: PASS (%s, %s, %s)\n' "$invoice_number" "$amount" "$workspace_name"