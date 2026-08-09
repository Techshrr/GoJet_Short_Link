#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -P3306 -uroot "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

for i in {1..60}; do curl -fsS "$BASE/health" >/dev/null 2>&1&&break;sleep 1;[[ $i -lt 60 ]]||exit 1;done
ADMIN=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login|field "['token']")

# Create a normal user through the public account flow and discover its personal workspace.
USER_BODY=$(expect 201 "$(req POST /api/auth/register '{"email":"links@example.test","display_name":"Link Owner","password":"LinkOwnerPassword!2026"}')" user-register)
USER=$(printf '%s' "$USER_BODY"|field "['token']")
WORKSPACES=$(expect 200 "$(req GET /api/workspaces '' "$USER")" workspaces)
WID=$(printf '%s' "$WORKSPACES"|python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["data"][0]["id"])')

expect 201 "$(req POST "/api/workspaces/$WID/links" '{"destination":"https://example.com/admin-lifecycle","code":"adminlife","redirect_status":302,"status":"active"}' "$USER")" create-link >/dev/null
LINK_ID=$(mysqlq "SELECT id FROM short_links WHERE workspace_id=$WID AND code='adminlife' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1;")
[[ -n "$LINK_ID" ]]||{ echo 'created link missing in MySQL' >&2; exit 1; }

LIST=$(expect 200 "$(req GET /api/admin/links '' "$ADMIN")" admin-link-list)
printf '%s' "$LIST"|python3 -c "import json,sys; d=json.load(sys.stdin); assert any(int(x['id'])==$LINK_ID for x in d['data'])"

expect 200 "$(req PATCH "/api/admin/links/$LINK_ID/status" '{"status":"paused"}' "$ADMIN")" pause-link >/dev/null
[[ $(mysqlq "SELECT status FROM short_links WHERE id=$LINK_ID;") == paused ]]||{ echo 'link was not paused' >&2; exit 1; }
expect 200 "$(req PATCH "/api/admin/links/$LINK_ID/status" '{"status":"active"}' "$ADMIN")" resume-link >/dev/null
[[ $(mysqlq "SELECT status FROM short_links WHERE id=$LINK_ID;") == active ]]||{ echo 'link was not reactivated' >&2; exit 1; }
expect 204 "$(req DELETE "/api/admin/links/$LINK_ID" '' "$ADMIN")" delete-link >/dev/null
STATE=$(mysqlq "SELECT CONCAT(status,':',IF(deleted_at IS NULL,'live','deleted')) FROM short_links WHERE id=$LINK_ID;")
[[ "$STATE" == 'paused:deleted' ]]||{ echo "unexpected deleted link state: $STATE" >&2; exit 1; }
printf 'GoJet V4 administrator link lifecycle acceptance: PASS\n'
