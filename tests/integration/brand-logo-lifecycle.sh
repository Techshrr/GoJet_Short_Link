#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
UPLOAD_ROOT=${UPLOAD_STORAGE_PATH:-/tmp/gojet/uploads}
BRAND_ROOT=${BRAND_ASSET_PATH:-/tmp/gojet/brand}
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

admin=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login|field "['token']")
png=$(mktemp --suffix=.png)
python3 - "$png" <<'PY'
import base64,sys
raw='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
open(sys.argv[1],'wb').write(base64.b64decode(raw))
PY

upload_asset(){
  local asset=$1 expected_url=$2
  local raw body url
  raw=$(curl -sS -X POST -H "Authorization: Bearer $admin" -F "file=@$png;type=image/png" -w $'\n%{http_code}' "$BASE/api/admin/brand/$asset")
  body=$(expect 201 "$raw" "upload-$asset")
  url=$(printf '%s' "$body"|field "['url']")
  [[ "$url" == "$expected_url" ]] || { echo "brand $asset URL is not stable: $url" >&2; exit 1; }
}

upload_asset logo /assets/images/logo.png
upload_asset favicon /assets/images/favicon.png

settings1=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-1)
printf '%s' "$settings1" | python3 -c 'import json,sys; d=json.load(sys.stdin); b=d["brand"]; assert b["logo"]=="/assets/images/logo.png",b; assert b["favicon"]=="/assets/images/favicon.png",b; assert set(k for k in b if k not in {"brand.primary_color"}) <= {"logo","favicon"},b'

[[ -s "$BRAND_ROOT/logo.png" ]] || { echo "uploaded brand logo missing" >&2; exit 1; }
[[ -s "$BRAND_ROOT/favicon.png" ]] || { echo "uploaded favicon missing" >&2; exit 1; }
[[ ! -e "$UPLOAD_ROOT/logo.png" && ! -e "$UPLOAD_ROOT/favicon.png" ]] || { echo "brand asset leaked into user uploads" >&2; exit 1; }

for retired in logo-dark logo-light logo-square apple-touch-icon pwa-icon share-image login-image mail-logo; do
  raw=$(curl -sS -X POST -H "Authorization: Bearer $admin" -F "file=@$png;type=image/png" -w $'\n%{http_code}' "$BASE/api/admin/brand/$retired")
  expect 404 "$raw" "retired-$retired-rejected" >/dev/null
done

# Replacing the canonical logo must keep the stable URL and a single stored file.
raw2=$(curl -sS -X POST -H "Authorization: Bearer $admin" -F "file=@$png;type=image/png" -w $'\n%{http_code}' "$BASE/api/admin/brand/logo")
body2=$(expect 201 "$raw2" replace-logo)
url2=$(printf '%s' "$body2"|field "['url']")
[[ "$url2" == "/assets/images/logo.png" ]] || { echo "brand replacement changed stable URL: $url2" >&2; exit 1; }
[[ $(find "$BRAND_ROOT" -maxdepth 1 -type f -name 'logo*' | wc -l) -eq 1 ]] || { echo "brand replacement left duplicate logo files" >&2; exit 1; }

expect 204 "$(req DELETE /api/admin/brand/logo '' "$admin")" delete-logo >/dev/null
settings2=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-after-delete)
printf '%s' "$settings2" | python3 -c 'import json,sys; d=json.load(sys.stdin); b=d.get("brand",{}); assert "logo" not in b,b; assert b["favicon"]=="/assets/images/favicon.png",b'
[[ ! -e "$BRAND_ROOT/logo.png" ]] || { echo 'deleted brand logo remained on disk' >&2; exit 1; }

expect 204 "$(req DELETE /api/admin/brand/favicon '' "$admin")" delete-favicon >/dev/null
[[ ! -e "$BRAND_ROOT/favicon.png" ]] || { echo 'deleted favicon remained on disk' >&2; exit 1; }
rm -f "$png"
printf 'GoJet canonical logo/favicon brand asset lifecycle acceptance: PASS\n'
