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
for i in {1..60};do curl -fsS "$BASE/health" >/dev/null 2>&1&&break;sleep 1;[[ $i -lt 60 ]]||exit 1;done

echo '[1/15] login bootstrap administrator and mark SMTP health connected'
r=$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}'); ADMIN=$(expect 200 "$r" admin-login|field "['token']")
mysqlq "UPDATE mail_health SET status='connected',last_error=NULL WHERE singleton_id=1;" >/dev/null

echo '[2/15] enable real registration policies'
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.enabled":true,"registration.require_email_verification":true,"registration.password_min_length":12,"registration.login_rate_limit":3,"registration.blocked_domains":"blocked.test","registration.forgot_password":true}' "$ADMIN")" registration-policy >/dev/null

echo '[3/15] blocked domain and password length really reject registration'
expect 422 "$(req POST /api/auth/register '{"email":"a@blocked.test","display_name":"Blocked","password":"LongEnoughPassword!"}')" blocked-domain >/dev/null
expect 422 "$(req POST /api/auth/register '{"email":"short@example.test","display_name":"Short","password":"1234567890"}')" password-minimum >/dev/null

echo '[4/15] verified-email policy never returns or keeps an authenticated session'
r=$(req POST /api/auth/register '{"email":"verify@example.test","display_name":"Verify User","password":"VerifyPassword!2026"}')
b=$(expect 201 "$r" verification-registration)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["verification_required"] is True; assert "token" not in d'
USER_ID=$(mysqlq "SELECT id FROM users WHERE email='verify@example.test';")
[[ $(mysqlq "SELECT COUNT(*) FROM user_sessions WHERE user_id=$USER_ID AND revoked_at IS NULL AND expires_at>NOW();") == 0 ]] || { echo 'registration left a live unverified session' >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='verify@example.test' AND message_type='verification';") -ge 1 ]] || { echo 'verification mail not queued' >&2; exit 1; }

echo '[5/15] correct password before verification still cannot create a live session'
r=$(req POST /api/auth/login '{"email":"verify@example.test","password":"VerifyPassword!2026"}')
expect 403 "$r" unverified-login >/dev/null
[[ $(mysqlq "SELECT COUNT(*) FROM user_sessions WHERE user_id=$USER_ID AND revoked_at IS NULL AND expires_at>NOW();") == 0 ]] || { echo 'unverified login left a live session' >&2; exit 1; }

echo '[6/15] verification link from real queued mail activates login'
HTML=$(mysqlq "SELECT html_body FROM mail_messages WHERE recipient='verify@example.test' AND message_type='verification' ORDER BY id DESC LIMIT 1;" 2>/dev/null || true)
if [[ -z "$HTML" ]]; then HTML=$(mysqlq "SELECT body_html FROM mail_messages WHERE recipient='verify@example.test' AND message_type='verification' ORDER BY id DESC LIMIT 1;" 2>/dev/null || true); fi
[[ -n "$HTML" ]] || { echo 'could not read rendered verification mail body' >&2; exit 1; }
TOKEN=$(printf '%s' "$HTML"|python3 -c 'import html,re,sys; s=html.unescape(sys.stdin.read()); m=re.search(r"/verifyemail\?token=([0-9a-f]{64})",s); assert m,"verification token missing"; print(m.group(1))')
expect 200 "$(req POST /api/auth/verifyemail "{\"token\":\"$TOKEN\"}")" verifyemail >/dev/null
r=$(req POST /api/auth/login '{"email":"verify@example.test","password":"VerifyPassword!2026"}'); expect 200 "$r" verified-login >/dev/null

echo '[7/15] login failure rate limit uses configured threshold'
for i in 1 2 3; do expect 401 "$(req POST /api/auth/login '{"email":"rate@example.test","password":"wrong-password"}')" "failure-$i" >/dev/null; done
expect 429 "$(req POST /api/auth/login '{"email":"rate@example.test","password":"wrong-password"}')" rate-limit >/dev/null

echo '[8/15] disabling password recovery changes real endpoint behavior'
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.forgot_password":false}' "$ADMIN")" disable-forgot >/dev/null
expect 403 "$(req POST /api/auth/forgotpassword '{"email":"verify@example.test"}')" forgot-disabled >/dev/null

echo '[9/15] social identity schema enforces provider ownership and browser binding boundaries'
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='user_social_identities';") == 1 ]] || { echo 'social identity table missing' >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='social_auth_attempts';") == 1 ]] || { echo 'social auth attempts table missing' >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='social_auth_attempts' AND column_name='pkce_verifier_hash' AND character_maximum_length=64;") == 1 ]] || { echo 'PKCE verifier hash column missing' >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='user_social_identities' AND index_name='social_identity_provider_subject_uniq' AND non_unique=0;") -ge 1 ]] || { echo 'provider subject unique constraint missing' >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='user_social_identities' AND index_name='social_identity_user_provider_uniq' AND non_unique=0;") -ge 1 ]] || { echo 'user provider unique constraint missing' >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='social_auth_attempts' AND index_name='social_auth_state_uniq' AND non_unique=0;") -ge 1 ]] || { echo 'state uniqueness constraint missing' >&2; exit 1; }

echo '[10/15] disabled and incomplete social providers are never exposed publicly'
r=$(req GET /api/public/auth/providers); b=$(expect 200 "$r" providers-empty)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["providers"] == []'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":true,"auth.social.github.client_id":"gojet-phase-d"}' "$ADMIN")" github-incomplete >/dev/null
r=$(req GET /api/public/auth/providers); b=$(expect 200 "$r" providers-incomplete)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["providers"] == []'

echo '[11/15] completed implemented provider is public while its secret stays encrypted and masked'
SECRET='GoJetPhaseD-Secret-2026'
expect 200 "$(req PUT /api/admin/settings/socialauth "{\"auth.social.github.client_secret\":\"$SECRET\"}" "$ADMIN")" github-secret >/dev/null
r=$(req GET /api/public/auth/providers); b=$(expect 200 "$r" providers-complete)
printf '%s' "$b"|python3 -c 'import json,sys; raw=sys.stdin.read(); d=json.loads(raw); assert d["providers"] == [{"id":"github","label":"GitHub"}]; assert "client_secret" not in raw.lower(); assert "gojetphased-secret-2026" not in raw.lower()'
r=$(req GET /api/admin/settings '' "$ADMIN"); b=$(expect 200 "$r" settings-masked)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["socialauth"]["auth.social.github.client_secret"] == "********"'
[[ $(mysqlq "SELECT is_encrypted FROM system_settings WHERE setting_key='auth.social.github.client_secret';") == 1 ]] || { echo 'social client secret is not marked encrypted' >&2; exit 1; }
STORED=$(mysqlq "SELECT setting_value FROM system_settings WHERE setting_key='auth.social.github.client_secret';")
[[ "$STORED" != *"$SECRET"* ]] || { echo 'social client secret stored in plaintext' >&2; exit 1; }

echo '[12/15] disabling a configured provider removes it from public discovery immediately'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":false}' "$ADMIN")" github-disable >/dev/null
r=$(req GET /api/public/auth/providers); b=$(expect 200 "$r" providers-disabled)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["providers"] == []'

echo '[13/15] configured providers without an implemented adapter stay hidden'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.google.enabled":true,"auth.social.google.client_id":"not-live-yet","auth.social.google.client_secret":"not-live-yet-secret"}' "$ADMIN")" google-config >/dev/null
r=$(req GET /api/public/auth/providers); b=$(expect 200 "$r" unsupported-hidden)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["providers"] == []'

echo '[14/15] GitHub start creates state nonce PKCE hashes and browser-bound cookies before redirect'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":true}' "$ADMIN")" github-enable >/dev/null
HEADERS=$(mktemp)
trap 'rm -f "$HEADERS"' EXIT
HTTP_CODE=$(curl -sS -D "$HEADERS" -o /dev/null -w '%{http_code}' "$BASE/api/public/auth/github/start?redirect=%2Fapp%2Fdashboard")
[[ "$HTTP_CODE" == 302 ]] || { echo "social start expected 302 got $HTTP_CODE" >&2; cat "$HEADERS" >&2; exit 1; }
LOCATION=$(awk 'BEGIN{IGNORECASE=1} /^Location:/{sub(/^[^:]*:[[:space:]]*/,""); sub(/\r$/,""); print; exit}' "$HEADERS")
STATE=$(python3 -c 'import sys,urllib.parse as u; q=u.parse_qs(u.urlparse(sys.argv[1]).query); print(q["state"][0])' "$LOCATION")
CHALLENGE=$(python3 -c 'import sys,urllib.parse as u; q=u.parse_qs(u.urlparse(sys.argv[1]).query); assert q["code_challenge_method"]==["S256"]; assert q["scope"]==["user:email"]; print(q["code_challenge"][0])' "$LOCATION")
python3 -c 'import sys,urllib.parse as u; p=u.urlparse(sys.argv[1]); assert p.scheme=="https" and p.netloc=="github.com" and p.path=="/login/oauth/authorize"' "$LOCATION"
[[ ${#CHALLENGE} -eq 43 ]] || { echo 'PKCE challenge length invalid' >&2; exit 1; }
STATE_HASH=$(printf '%s' "$STATE"|sha256sum|awk '{print $1}')
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_HASH' AND provider='github' AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() AND CHAR_LENGTH(nonce_hash)=64 AND CHAR_LENGTH(pkce_verifier_hash)=64;") == 1 ]] || { echo 'social attempt was not persisted with browser binding hashes' >&2; exit 1; }
for cookie in gojet_social_state gojet_social_nonce gojet_social_pkce; do grep -i "^Set-Cookie: $cookie=" "$HEADERS"|grep -qi 'HttpOnly' || { echo "$cookie is not HttpOnly" >&2; exit 1; }; grep -i "^Set-Cookie: $cookie=" "$HEADERS"|grep -qi 'SameSite=Lax' || { echo "$cookie is not SameSite=Lax" >&2; exit 1; }; done

echo '[15/15] disabling provider blocks callbacks before consuming an outstanding state'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":false}' "$ADMIN")" github-disable-callback >/dev/null
expect 403 "$(req GET "/api/public/auth/github/callback?code=fake-code&state=$STATE")" disabled-callback >/dev/null
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_HASH' AND consumed_at IS NULL;") == 1 ]] || { echo 'disabled callback consumed state unexpectedly' >&2; exit 1; }
printf 'GoJet authentication policy acceptance: PASS\n'
