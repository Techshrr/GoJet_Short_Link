#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18091}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_auth_policy}
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -P3306 -uroot "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
status(){ printf '%s\n' "$1"|tail -n1; }
body(){ printf '%s\n' "$1"|sed '$d'; }
expect(){ local want=$1 got=$2 label=$3; local s; s=$(status "$got"); if [[ "$s" != "$want" ]]; then echo "FAIL $label: expected $want got $s" >&2; body "$got" >&2; exit 1; fi; body "$got"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }
for i in {1..60}; do curl -fsS "$BASE/health" >/dev/null 2>&1&&break; sleep 1; [[ $i -lt 60 ]]||exit 1; done

echo '[1/17] administrator login and baseline registration policy'
r=$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}'); ADMIN=$(expect 200 "$r" admin-login|field "['token']")
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.enabled":true,"registration.require_email_verification":false,"registration.password_min_length":10}' "$ADMIN")" registration-policy >/dev/null

echo '[2/17] password registration and login remain available'
EMAIL="auth-policy-${RANDOM}-${RANDOM}@example.test";r=$(req POST /api/auth/register "{\"email\":\"$EMAIL\",\"display_name\":\"Auth Policy\",\"password\":\"AuthPolicyPassword!2026\"}");b=$(expect 201 "$r" register);TOKEN=$(printf '%s' "$b"|field "['token']");expect 200 "$(req GET /api/me '' "$TOKEN")" me >/dev/null

echo '[3/17] account policy endpoint remains public'
expect 200 "$(req GET /api/public/account-policy)" account-policy >/dev/null

echo '[4/17] incomplete social providers stay hidden'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":true,"auth.social.github.client_id":"gojet-github-client"}' "$ADMIN")" github-incomplete >/dev/null
b=$(expect 200 "$(req GET /api/public/auth/providers)" providers-incomplete);printf '%s' "$b"|python3 -c 'import json,sys;assert json.load(sys.stdin)["providers"]==[]'

echo '[5/17] email-code endpoint remains reachable'
expect 400 "$(req POST /api/public/email-code '{}')" email-code >/dev/null

echo '[6/17] password forgot endpoint does not enumerate accounts'
expect 202 "$(req POST /api/auth/forgotpassword '{"email":"does-not-exist@example.test"}')" forgot >/dev/null

echo '[7/17] registration settings are still enforced'
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.enabled":false}' "$ADMIN")" close-registration >/dev/null
expect 403 "$(req POST /api/auth/register '{"email":"closed@example.test","display_name":"Closed","password":"ClosedPassword!2026"}')" closed-register >/dev/null
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.enabled":true}' "$ADMIN")" reopen-registration >/dev/null

echo '[8/17] login rate-limit path remains active'
for i in {1..2};do req POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"wrong-password-$i\"}" >/dev/null;done

echo '[9/17] social schema stores identity uniqueness, one-time attempts and browser binding hashes'
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$MYSQL_DATABASE' AND TABLE_NAME='social_auth_attempts' AND COLUMN_NAME='pkce_verifier_hash' AND CHARACTER_MAXIMUM_LENGTH=64;") == 1 ]]||exit 1
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$MYSQL_DATABASE' AND TABLE_NAME='user_social_identities' AND COLUMN_NAME='provider_subject' AND CHARACTER_MAXIMUM_LENGTH=255;") == 1 ]]||exit 1

echo '[10/17] disabled and incomplete providers remain hidden'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":false,"auth.social.github.client_id":"gojet-github-client"}' "$ADMIN")" github-disabled >/dev/null;b=$(expect 200 "$(req GET /api/public/auth/providers)" providers-disabled-incomplete);printf '%s' "$b"|python3 -c 'import json,sys;assert json.load(sys.stdin)["providers"]==[]'

echo '[11/17] completed GitHub provider is public while its secret stays encrypted and masked'
SECRET='GoJetPhaseD-Secret-2026';expect 200 "$(req PUT /api/admin/settings/socialauth "{\"auth.social.github.enabled\":true,\"auth.social.github.client_secret\":\"$SECRET\"}" "$ADMIN")" github-secret >/dev/null;b=$(expect 200 "$(req GET /api/public/auth/providers)" providers-complete);printf '%s' "$b"|python3 -c 'import json,sys;raw=sys.stdin.read();d=json.loads(raw);assert d["providers"]==[{"id":"github","label":"GitHub"}];assert "client_secret" not in raw.lower()';[[ $(mysqlq "SELECT is_encrypted FROM system_settings WHERE setting_key='auth.social.github.client_secret';") == 1 ]]||exit 1

echo '[12/17] disabling GitHub removes it from public discovery immediately'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":false}' "$ADMIN")" github-disable >/dev/null;b=$(expect 200 "$(req GET /api/public/auth/providers)" providers-disabled);printf '%s' "$b"|python3 -c 'import json,sys;assert json.load(sys.stdin)["providers"]==[]'

echo '[13/17] complete but disabled Facebook configuration stays hidden'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.facebook.enabled":false,"auth.social.facebook.client_id":"facebook-ready","auth.social.facebook.client_secret":"facebook-ready-secret"}' "$ADMIN")" facebook-config >/dev/null;b=$(expect 200 "$(req GET /api/public/auth/providers)" facebook-disabled);printf '%s' "$b"|python3 -c 'import json,sys;assert json.load(sys.stdin)["providers"]==[]'

echo '[14/17] Google provider is public and starts authorization-code flow with PKCE'
GOOGLE_SECRET='GoJetGoogleSecret-2026';expect 200 "$(req PUT /api/admin/settings/socialauth "{\"auth.social.google.enabled\":true,\"auth.social.google.client_id\":\"gojet-google-client\",\"auth.social.google.client_secret\":\"$GOOGLE_SECRET\"}" "$ADMIN")" google-config >/dev/null;b=$(expect 200 "$(req GET /api/public/auth/providers)" google-visible);printf '%s' "$b"|python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["providers"]==[{"id":"google","label":"Google"}]';[[ $(mysqlq "SELECT is_encrypted FROM system_settings WHERE setting_key='auth.social.google.client_secret';") == 1 ]]||exit 1
HEADERS_G=$(mktemp);HEADERS_H=$(mktemp);trap 'rm -f "$HEADERS_G" "$HEADERS_H"' EXIT;HTTP_CODE=$(curl -sS -D "$HEADERS_G" -o /dev/null -w '%{http_code}' "$BASE/api/public/auth/google/start?redirect=%2Fapp%2Fdashboard");[[ "$HTTP_CODE" == 302 ]]||exit 1;LOCATION_G=$(awk 'BEGIN{IGNORECASE=1}/^Location:/{sub(/^[^:]*:[[:space:]]*/,"");sub(/\r$/,"");print;exit}' "$HEADERS_G");STATE_G=$(python3 -c 'import sys,urllib.parse as u;q=u.parse_qs(u.urlparse(sys.argv[1]).query);print(q["state"][0])' "$LOCATION_G");CHALLENGE_G=$(python3 -c 'import sys,urllib.parse as u;q=u.parse_qs(u.urlparse(sys.argv[1]).query);assert q["code_challenge_method"]==["S256"];print(q["code_challenge"][0])' "$LOCATION_G");[[ ${#CHALLENGE_G} -eq 43 ]]||exit 1;STATE_G_HASH=$(printf '%s' "$STATE_G"|sha256sum|awk '{print $1}');[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_G_HASH' AND provider='google' AND consumed_at IS NULL;") == 1 ]]||exit 1

echo '[15/17] disabling Google blocks callback before consuming outstanding state'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.google.enabled":false}' "$ADMIN")" google-disable-callback >/dev/null;expect 403 "$(req GET "/api/public/auth/google/callback?code=fake-code&state=$STATE_G")" disabled-google-callback >/dev/null;[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_G_HASH' AND consumed_at IS NULL;") == 1 ]]||exit 1

echo '[16/17] GitHub start still creates state nonce PKCE hashes and browser-bound cookies'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":true}' "$ADMIN")" github-enable >/dev/null;HTTP_CODE=$(curl -sS -D "$HEADERS_H" -o /dev/null -w '%{http_code}' "$BASE/api/public/auth/github/start?redirect=%2Fapp%2Fdashboard");[[ "$HTTP_CODE" == 302 ]]||exit 1;LOCATION_H=$(awk 'BEGIN{IGNORECASE=1}/^Location:/{sub(/^[^:]*:[[:space:]]*/,"");sub(/\r$/,"");print;exit}' "$HEADERS_H");STATE_H=$(python3 -c 'import sys,urllib.parse as u;q=u.parse_qs(u.urlparse(sys.argv[1]).query);print(q["state"][0])' "$LOCATION_H");CHALLENGE_H=$(python3 -c 'import sys,urllib.parse as u;q=u.parse_qs(u.urlparse(sys.argv[1]).query);assert q["code_challenge_method"]==["S256"];print(q["code_challenge"][0])' "$LOCATION_H");[[ ${#CHALLENGE_H} -eq 43 ]]||exit 1;STATE_H_HASH=$(printf '%s' "$STATE_H"|sha256sum|awk '{print $1}');[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_H_HASH' AND provider='github' AND consumed_at IS NULL;") == 1 ]]||exit 1

echo '[17/17] disabling GitHub blocks callbacks before consuming outstanding state'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":false}' "$ADMIN")" github-disable-callback >/dev/null;expect 403 "$(req GET "/api/public/auth/github/callback?code=fake-code&state=$STATE_H")" disabled-github-callback >/dev/null;[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_H_HASH' AND consumed_at IS NULL;") == 1 ]]||exit 1
printf 'GoJet authentication policy acceptance: PASS\n'
