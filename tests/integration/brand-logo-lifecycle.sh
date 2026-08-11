#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
UPLOAD_ROOT=${UPLOAD_STORAGE_PATH:-/tmp/gojet/uploads}
SYSTEM_IMAGE_ROOT=${SYSTEM_IMAGE_PATH:-/tmp/gojet/system/images}
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
raw=$(curl -sS -X POST -H "Authorization: Bearer $admin" -F "file=@$png;type=image/png" -w $'\n%{http_code}' "$BASE/api/admin/brand/logo")
body=$(expect 201 "$raw" upload-logo)
url=$(printf '%s' "$body"|field "['url']")
[[ "$url" == "/system-images/logo.png" ]] || { echo "brand logo URL is not stable: $url" >&2; exit 1; }

settings1=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-1)
printf '%s' "$settings1" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['brand']['logo']=='$url',d['brand']"
file="$SYSTEM_IMAGE_ROOT/logo.png"
[[ -s "$file" ]] || { echo "uploaded system logo missing at $file" >&2; exit 1; }
[[ ! -e "$UPLOAD_ROOT/logo.png" ]] || { echo "system logo leaked into user uploads: $UPLOAD_ROOT/logo.png" >&2; exit 1; }
if find "$UPLOAD_ROOT" -maxdepth 1 -type f -name 'logo-*' -print -quit | grep -q .; then
  echo "randomized brand logo leaked into user uploads" >&2
  exit 1
fi
settings2=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-2)
printf '%s' "$settings2" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['brand']['logo']=='$url'"

# Replacing the same logical slot must keep a stable URL/name and atomically
# replace the bytes instead of accumulating random files.
raw2=$(curl -sS -X POST -H "Authorization: Bearer $admin" -F "file=@$png;type=image/png" -w $'\n%{http_code}' "$BASE/api/admin/brand/logo")
body2=$(expect 201 "$raw2" replace-logo)
url2=$(printf '%s' "$body2"|field "['url']")
[[ "$url2" == "$url" ]] || { echo "brand replacement changed stable URL: $url -> $url2" >&2; exit 1; }
[[ $(find "$SYSTEM_IMAGE_ROOT" -maxdepth 1 -type f -name 'logo*' | wc -l) -eq 1 ]] || { echo "brand replacement left duplicate logo files" >&2; exit 1; }

expect 204 "$(req DELETE /api/admin/brand/logo '' "$admin")" delete-logo >/dev/null
settings3=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-after-delete)
printf '%s' "$settings3" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert "logo" not in d.get("brand",{}),d.get("brand")'
[[ ! -e "$file" ]] || { echo 'deleted system brand asset remained on disk' >&2; exit 1; }
rm -f "$png"
printf 'GoJet stable system-image logo upload/readback/replace/delete acceptance: PASS\n'