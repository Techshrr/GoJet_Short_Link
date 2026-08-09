#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }
for i in {1..30};do curl -fsS "$BASE/health" >/dev/null 2>&1&&break;sleep 1;done
OWNER_BODY=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" owner-login)
OWNER=$(printf '%s' "$OWNER_BODY"|field "['token']")
OWNER_ID=$(printf '%s' "$OWNER_BODY"|field "['administrator']['id']")
ROGUE_BODY=$(expect 201 "$(req POST /api/admin/administrators '{"email":"adminmanager@example.test","display_name":"Admin Manager","password":"AdminManager!2026","role":"custom","permissions":["admins.manage"]}' "$OWNER")" create-admin-manager)
ROGUE_ID=$(printf '%s' "$ROGUE_BODY"|field "['id']")
ROGUE_LOGIN=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"adminmanager@example.test","password":"AdminManager!2026"}')" admin-manager-login)
ROGUE=$(printf '%s' "$ROGUE_LOGIN"|field "['token']")
# platform.read is a mandatory shell baseline even if the custom role did not request it explicitly.
ME=$(expect 200 "$(req GET /api/admin/auth/me '' "$ROGUE")" custom-admin-me)
printf '%s' "$ME"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert "platform.read" in d["permissions"]'
expect 200 "$(req GET /api/admin/administrators '' "$ROGUE")" list-admins >/dev/null
expect 403 "$(req POST /api/admin/administrators '{"email":"escalated@example.test","display_name":"Escalated","password":"EscalatedPassword!2026","role":"custom","permissions":["settings.manage"]}' "$ROGUE")" block-create-admin >/dev/null
expect 403 "$(req PATCH "/api/admin/administrators/$ROGUE_ID" '{"role":"custom","status":"active","permissions":["admins.manage","settings.manage"]}' "$ROGUE")" block-update-admin >/dev/null
expect 403 "$(req DELETE "/api/admin/administrators/$OWNER_ID/sessions" '' "$ROGUE")" block-revoke-owner >/dev/null
printf 'GoJet V4 administrator permission boundary acceptance: PASS\n'
