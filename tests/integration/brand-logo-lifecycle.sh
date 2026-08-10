#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
UPLOAD_ROOT=${UPLOAD_STORAGE_PATH:-/tmp/gojet/uploads}
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

admin=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login|field "['token']")
png=$(mktemp --suffix=.png)
python3 - "$png" <<'PY'
import base64,sys
# 1x1 valid PNG
raw='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
open(sys.argv[1],'wb').write(base64.b64decode(raw))
PY
raw=$(curl -sS -X POST -H "Authorization: Bearer $admin" -F "file=@$png;type=image/png" -w $'\n%{http_code}' "$BASE/api/admin/brand/logo")
body=$(expect 201 "$raw" upload-logo)
url=$(printf '%s' "$body"|field "['url']")n
settings1=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-1)
printf '%s' "$settings1" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['brand']['logo']=='$url',d['brand']"
file="$UPLOAD_ROOT/$(basename "$url")"
[[ -s "$file" ]] || { echo "uploaded logo missing at $file" >&2; exit 1; }
settings2=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-2)
printf '%s' "$settings2" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['brand']['logo']=='$url'"

expect 204 "$(req DELETE /api/admin/brand/logo '' "$admin")" delete-logo >/dev/null
settings3=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-after-delete)
printf '%s' "$settings3" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert "logo" not in d.get("brand",{}),d.get("brand")'
[[ ! -e "$file" ]] || { echo 'deleted brand asset remained on disk' >&2; exit 1; }
rm -f "$png"
printf 'GoJet logo upload/readback/refresh/delete acceptance: PASS\n'
