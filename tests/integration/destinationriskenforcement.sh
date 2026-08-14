#!/usr/bin/env bash
set -euo pipefail

API=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
PUBLIC=${GOJET_PUBLIC_BASE:-http://127.0.0.1:18080}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -P3306 -uroot "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$API$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }
public_code(){ curl -sS -o /dev/null -w '%{http_code}' "$PUBLIC/$1"; }
public_location(){ curl -sS -D - -o /dev/null "$PUBLIC/$1" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}'; }
nonredirect(){ local code=$1; [[ "$code" != 301 && "$code" != 302 && "$code" != 307 && "$code" != 308 ]]; }
wait_decision(){ local id=$1 want=$2; local got=''; for i in $(seq 1 25); do got=$(mysqlq "SELECT COALESCE(manual_decision,decision) FROM link_destination_risk WHERE link_id=$id LIMIT 1;" 2>/dev/null || true); [[ "$got" == "$want" ]]&&{ printf '%s' "$got"; return 0; }; sleep 1; done; echo "risk decision link=$id expected=$want got=${got:-missing}" >&2; return 1; }

ADMIN=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login|field "['token']")
USER=$(expect 201 "$(req POST /api/auth/register '{"email":"risk-gate@example.test","display_name":"Risk Gate","password":"RiskGatePassword!2026"}')" user-register|field "['token']")
WID=$(expect 200 "$(req GET /api/workspaces '' "$USER")" workspaces|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')

create_link(){ local code=$1 target=$2; expect 201 "$(req POST "/api/workspaces/$WID/links" "{\"destination\":\"$target\",\"code\":\"$code\",\"redirect_status\":302,\"status\":\"active\"}" "$USER")" "create-$code" >/dev/null; mysqlq "SELECT id FROM short_links WHERE workspace_id=$WID AND code='$code' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1;"; }

# Guaranteed REVIEW: .invalid cannot resolve. The redirect plane must never turn a
# failed DNS/reputation check into an implicit allow.
REVIEW_CODE=riskreview
REVIEW_ID=$(create_link "$REVIEW_CODE" 'https://risk-review.invalid/path')
initial=$(public_code "$REVIEW_CODE"); nonredirect "$initial" || { echo "fresh unscanned link redirected: $initial" >&2; exit 1; }
wait_decision "$REVIEW_ID" review >/dev/null
review_code=$(public_code "$REVIEW_CODE"); nonredirect "$review_code" || { echo "review link redirected" >&2; exit 1; }
DETAIL=$(expect 200 "$(req GET "/api/admin/destination-risks/$REVIEW_ID" '' "$ADMIN")" risk-detail)
printf '%s' "$DETAIL"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["risk"]["effective_decision"]=="review"; assert d["current_fingerprint"]==d["risk"]["target_fingerprint"]; assert d["stale"] is False'

# Manual allow is permitted only with an explicit reason and only for this exact
# target fingerprint; the redirect engine should immediately honor it.
expect 200 "$(req POST "/api/admin/destination-risks/$REVIEW_ID/override" '{"decision":"allow","reason":"Integration gate verified current target fingerprint"}' "$ADMIN")" override-allow >/dev/null
[[ "$(public_code "$REVIEW_CODE")" == 302 ]] || { echo 'manual allow did not restore redirect' >&2; exit 1; }
[[ "$(public_location "$REVIEW_CODE")" == 'https://risk-review.invalid/path' ]] || { echo 'manual allow location mismatch' >&2; exit 1; }

# Change the destination through the normal user API. The old ALLOW fingerprint
# must become unusable immediately, before the asynchronous rescan finishes.
CURRENT=$(expect 200 "$(req GET "/api/workspaces/$WID/links/$REVIEW_ID" '' "$USER")" get-link)
UPDATE=$(printf '%s' "$CURRENT" | python3 -c 'import json,sys; d=json.load(sys.stdin); d["Destination"]="https://risk-review-changed.invalid/new"; print(json.dumps({"link":d,"reason":"destination risk fingerprint gate"}))')
expect 200 "$(req PUT "/api/workspaces/$WID/links/$REVIEW_ID" "$UPDATE" "$USER")" update-link >/dev/null
changed_code=$(public_code "$REVIEW_CODE"); nonredirect "$changed_code" || { echo 'old manual allow survived destination edit' >&2; exit 1; }
for i in $(seq 1 20); do manual=$(mysqlq "SELECT COALESCE(manual_decision,'') FROM link_destination_risk WHERE link_id=$REVIEW_ID;"); [[ -z "$manual" ]]&&break; sleep .5; done
[[ -z "${manual:-}" ]] || { echo "manual override survived target change: $manual" >&2; exit 1; }
wait_decision "$REVIEW_ID" review >/dev/null

# Guaranteed BLOCK: localhost/private destinations are rejected before fetching.
BLOCK_CODE=riskblock
BLOCK_ID=$(create_link "$BLOCK_CODE" 'http://127.0.0.1/private')
wait_decision "$BLOCK_ID" block >/dev/null
blocked_code=$(public_code "$BLOCK_CODE"); nonredirect "$blocked_code" || { echo 'blocked SSRF link redirected' >&2; exit 1; }

# A security administrator can deliberately override a current BLOCK to ALLOW,
# and clearing that override must return immediately to the automatic BLOCK.
expect 200 "$(req POST "/api/admin/destination-risks/$BLOCK_ID/override" '{"decision":"allow","reason":"Integration gate manual exception for current fingerprint"}' "$ADMIN")" block-override >/dev/null
[[ "$(public_code "$BLOCK_CODE")" == 302 ]] || { echo 'manual allow of current block did not redirect' >&2; exit 1; }
expect 200 "$(req DELETE "/api/admin/destination-risks/$BLOCK_ID/override" '' "$ADMIN")" clear-override >/dev/null
blocked_again=$(public_code "$BLOCK_CODE"); nonredirect "$blocked_again" || { echo 'clear override did not restore automatic block' >&2; exit 1; }

# Re-scan deletes the current risk key before queueing work. Verify the link is
# fail-closed while the new scan is pending, then returns to its automatic state.
expect 202 "$(req POST "/api/admin/destination-risks/$REVIEW_ID/rescan" '' "$ADMIN")" rescan >/dev/null
rescan_code=$(public_code "$REVIEW_CODE"); nonredirect "$rescan_code" || { echo 'rescan window unexpectedly redirected' >&2; exit 1; }
wait_decision "$REVIEW_ID" review >/dev/null

LIST=$(expect 200 "$(req GET '/api/admin/destination-risks?decision=review&limit=50' '' "$ADMIN")" risk-list)
printf '%s' "$LIST"|python3 -c "import json,sys; d=json.load(sys.stdin); assert any(int(x['link_id'])==$REVIEW_ID for x in d['data'])"
AUDIT=$(mysqlq "SELECT COUNT(*) FROM audit_logs WHERE target_type='short_link' AND target_id IN ('$REVIEW_ID','$BLOCK_ID') AND action LIKE 'admin.destination_risk_%';")
[[ "$AUDIT" -ge 4 ]] || { echo "destination risk business audit incomplete: $AUDIT" >&2; exit 1; }

printf 'GoJet destination risk API + fingerprint + redirect enforcement acceptance: PASS\n'
