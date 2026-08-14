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

r=$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')
ADMIN=$(expect 200 "$r" admin-login|field "['token']")
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.enabled":true,"registration.require_email_verification":false,"registration.password_min_length":10}' "$ADMIN")" registration-policy >/dev/null
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":true,"auth.social.github.client_id":"bind-api-client","auth.social.github.client_secret":"bind-api-secret"}' "$ADMIN")" github-config >/dev/null

EMAIL="bind-api-${RANDOM}-${RANDOM}@example.test"
r=$(req POST /api/auth/register "{\"email\":\"$EMAIL\",\"display_name\":\"Bind API User\",\"password\":\"BindApiPassword!2026\"}")
b=$(expect 201 "$r" user-register)
TOKEN=$(printf '%s' "$b"|field "['token']")
USER_ID=$(mysqlq "SELECT id FROM users WHERE email='$EMAIL';")
[[ -n "$USER_ID" ]] || { echo 'registered user missing' >&2; exit 1; }

r=$(req GET /api/me/social-identities '' "$TOKEN"); b=$(expect 200 "$r" identity-list)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["password_login_enabled"] is True; p={x["id"]:x for x in d["providers"]}; assert p["github"]["configured"] is True and p["github"]["linked"] is False; assert d["identities"]==[]'

HEADERS=$(mktemp); BODY=$(mktemp); JAR=$(mktemp)
trap 'rm -f "$HEADERS" "$BODY" "$JAR"' EXIT
HTTP_CODE=$(curl -sS -D "$HEADERS" -c "$JAR" -o "$BODY" -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$BASE/api/me/social/github/bind/start")
[[ "$HTTP_CODE" == 200 ]] || { echo "bind start expected 200 got $HTTP_CODE" >&2; cat "$BODY" >&2; exit 1; }
AUTHORIZE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["authorize_url"])' "$BODY")
STATE=$(python3 -c 'import sys,urllib.parse as u; p=u.urlparse(sys.argv[1]); assert p.scheme=="https" and p.netloc=="github.com" and p.path=="/login/oauth/authorize"; q=u.parse_qs(p.query); assert q["code_challenge_method"]==["S256"]; print(q["state"][0])' "$AUTHORIZE")
STATE_HASH=$(printf '%s' "$STATE"|sha256sum|awk '{print $1}')
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_HASH' AND provider='github' AND mode='bind' AND user_id=$USER_ID AND consumed_at IS NULL AND CHAR_LENGTH(nonce_hash)=64 AND CHAR_LENGTH(pkce_verifier_hash)=64;") == 1 ]] || { echo 'bind attempt was not persisted against authenticated user' >&2; exit 1; }
for cookie in gojet_social_state gojet_social_nonce gojet_social_pkce; do grep -i "^Set-Cookie: $cookie=" "$HEADERS"|grep -qi 'HttpOnly' || { echo "$cookie is not HttpOnly" >&2; exit 1; }; grep -i "^Set-Cookie: $cookie=" "$HEADERS"|grep -qi 'SameSite=Lax' || { echo "$cookie is not SameSite=Lax" >&2; exit 1; }; done

expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":false}' "$ADMIN")" github-disable >/dev/null
HTTP_CODE=$(curl -sS -b "$JAR" -o "$BODY" -w '%{http_code}' "$BASE/api/public/auth/github/callback?code=fake-code&state=$STATE")
[[ "$HTTP_CODE" == 403 ]] || { echo "disabled bind callback expected 403 got $HTTP_CODE" >&2; cat "$BODY" >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_HASH' AND consumed_at IS NULL;") == 1 ]] || { echo 'disabled bind callback consumed outstanding state' >&2; exit 1; }
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":true}' "$ADMIN")" github-reenable >/dev/null

mysqlq "INSERT INTO user_social_identities(user_id,provider,provider_subject,provider_email,email_verified) VALUES($USER_ID,'github','seed-password-$USER_ID','$EMAIL',TRUE);" >/dev/null
expect 204 "$(req DELETE /api/me/social/github '' "$TOKEN")" password-user-unbind >/dev/null

EMAIL2="bind-social-only-${RANDOM}-${RANDOM}@example.test"
r=$(req POST /api/auth/register "{\"email\":\"$EMAIL2\",\"display_name\":\"Social Only API\",\"password\":\"SocialOnlyPassword!2026\"}")
b=$(expect 201 "$r" second-register)
TOKEN2=$(printf '%s' "$b"|field "['token']")
USER2=$(mysqlq "SELECT id FROM users WHERE email='$EMAIL2';")
mysqlq "UPDATE users SET password_login_enabled=FALSE WHERE id=$USER2; INSERT INTO user_social_identities(user_id,provider,provider_subject,provider_email,email_verified) VALUES($USER2,'github','sole-github-$USER2','$EMAIL2',TRUE);" >/dev/null
expect 409 "$(req DELETE /api/me/social/github '' "$TOKEN2")" last-credential-blocked >/dev/null
mysqlq "INSERT INTO user_social_identities(user_id,provider,provider_subject,provider_email,email_verified) VALUES($USER2,'google','second-google-$USER2','$EMAIL2',TRUE);" >/dev/null
expect 204 "$(req DELETE /api/me/social/github '' "$TOKEN2")" second-provider-allows-unbind >/dev/null
expect 409 "$(req DELETE /api/me/social/google '' "$TOKEN2")" remaining-last-credential-blocked >/dev/null

printf 'social bind/unbind API acceptance: PASS\n'
