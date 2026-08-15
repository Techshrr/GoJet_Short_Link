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

echo '[1/20] administrator login and mail health baseline'
r=$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}'); ADMIN=$(expect 200 "$r" admin-login|field "['token']")
mysqlq "UPDATE mail_health SET status='connected',last_error=NULL WHERE singleton_id=1;" >/dev/null

echo '[2/20] enable strict registration and recovery policy'
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.enabled":true,"registration.require_email_verification":true,"registration.password_min_length":12,"registration.login_rate_limit":3,"registration.blocked_domains":"blocked.test","registration.forgot_password":true}' "$ADMIN")" registration-policy >/dev/null

echo '[3/20] blocked domains and short passwords are rejected'
expect 422 "$(req POST /api/auth/register '{"email":"a@blocked.test","display_name":"Blocked","password":"LongEnoughPassword!"}')" blocked-domain >/dev/null
expect 422 "$(req POST /api/auth/register '{"email":"short@example.test","display_name":"Short","password":"1234567890"}')" password-minimum >/dev/null

echo '[4/20] email verification registration never returns or keeps a live session'
VERIFY_EMAIL="verify-${RANDOM}-${RANDOM}@example.test"
r=$(req POST /api/auth/register "{\"email\":\"$VERIFY_EMAIL\",\"display_name\":\"Verify User\",\"password\":\"VerifyPassword!2026\"}")
b=$(expect 201 "$r" verification-registration)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["verification_required"] is True; assert "token" not in d'
USER_ID=$(mysqlq "SELECT id FROM users WHERE email='$VERIFY_EMAIL';")
[[ -n "$USER_ID" ]] || { echo 'verification user missing' >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM user_sessions WHERE user_id=$USER_ID AND revoked_at IS NULL AND expires_at>NOW();") == 0 ]] || { echo 'registration left a live unverified session' >&2; exit 1; }
[[ $(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='$VERIFY_EMAIL' AND message_type='verification';") -ge 1 ]] || { echo 'verification mail not queued' >&2; exit 1; }

echo '[5/20] correct password before verification still fails closed'
r=$(req POST /api/auth/login "{\"email\":\"$VERIFY_EMAIL\",\"password\":\"VerifyPassword!2026\"}")
expect 403 "$r" unverified-login >/dev/null
[[ $(mysqlq "SELECT COUNT(*) FROM user_sessions WHERE user_id=$USER_ID AND revoked_at IS NULL AND expires_at>NOW();") == 0 ]] || { echo 'unverified login left a live session' >&2; exit 1; }

echo '[6/20] queued verification mail activates the account'
HTML=$(mysqlq "SELECT html_body FROM mail_messages WHERE recipient='$VERIFY_EMAIL' AND message_type='verification' ORDER BY id DESC LIMIT 1;" 2>/dev/null || true)
if [[ -z "$HTML" ]]; then HTML=$(mysqlq "SELECT body_html FROM mail_messages WHERE recipient='$VERIFY_EMAIL' AND message_type='verification' ORDER BY id DESC LIMIT 1;" 2>/dev/null || true); fi
[[ -n "$HTML" ]] || { echo 'could not read rendered verification mail body' >&2; exit 1; }
TOKEN=$(printf '%s' "$HTML"|python3 -c 'import html,re,sys; s=html.unescape(sys.stdin.read()); m=re.search(r"/verifyemail\?token=([0-9a-f]{64})",s); assert m,"verification token missing"; print(m.group(1))')
expect 200 "$(req POST /api/auth/verifyemail "{\"token\":\"$TOKEN\"}")" verifyemail >/dev/null
r=$(req POST /api/auth/login "{\"email\":\"$VERIFY_EMAIL\",\"password\":\"VerifyPassword!2026\"}"); expect 200 "$r" verified-login >/dev/null

echo '[7/20] configured login rate limit reaches an exact 429 boundary'
RATE_EMAIL="rate-${RANDOM}-${RANDOM}@example.test"
for i in 1 2 3; do expect 401 "$(req POST /api/auth/login "{\"email\":\"$RATE_EMAIL\",\"password\":\"wrong-password-$i\"}")" "failure-$i" >/dev/null; done
expect 429 "$(req POST /api/auth/login "{\"email\":\"$RATE_EMAIL\",\"password\":\"wrong-password-4\"}")" rate-limit >/dev/null

echo '[8/20] recovery switch changes real endpoint behavior without enumeration'
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.forgot_password":false}' "$ADMIN")" disable-forgot >/dev/null
expect 403 "$(req POST /api/auth/forgotpassword "{\"email\":\"$VERIFY_EMAIL\"}")" forgot-disabled >/dev/null
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.forgot_password":true}' "$ADMIN")" enable-forgot >/dev/null
expect 202 "$(req POST /api/auth/forgotpassword '{"email":"does-not-exist@example.test"}')" forgot-nonenumerating >/dev/null

echo '[9/20] social identity schema enforces ownership and one-time attempt invariants'
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='user_social_identities';") == 1 ]] || exit 1
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='social_auth_attempts';") == 1 ]] || exit 1
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='social_auth_attempts' AND column_name='pkce_verifier_hash' AND character_maximum_length=64;") == 1 ]] || exit 1
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='user_social_identities' AND column_name='provider_subject' AND character_maximum_length=255;") == 1 ]] || exit 1
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='user_social_identities' AND index_name='social_identity_provider_subject_uniq' AND non_unique=0;") -ge 1 ]] || exit 1
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='user_social_identities' AND index_name='social_identity_user_provider_uniq' AND non_unique=0;") -ge 1 ]] || exit 1
[[ $(mysqlq "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='social_auth_attempts' AND index_name='social_auth_state_uniq' AND non_unique=0;") -ge 1 ]] || exit 1

echo '[10/20] disabled and incomplete providers are never exposed to customers'
b=$(expect 200 "$(req GET /api/public/auth/providers)" providers-empty);printf '%s' "$b"|python3 -c 'import json,sys; assert json.load(sys.stdin)["providers"]==[]'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":true,"auth.social.github.client_id":"incomplete-client"}' "$ADMIN")" incomplete-github >/dev/null
b=$(expect 200 "$(req GET /api/public/auth/providers)" providers-incomplete);printf '%s' "$b"|python3 -c 'import json,sys; assert json.load(sys.stdin)["providers"]==[]'

echo '[11/20] all six customer providers can be configured without exposing secrets'
SOCIAL_PAYLOAD='{"auth.social.google.enabled":true,"auth.social.google.client_id":"google-client","auth.social.google.client_secret":"GoogleSecret-2026","auth.social.facebook.enabled":true,"auth.social.facebook.client_id":"facebook-client","auth.social.facebook.client_secret":"FacebookSecret-2026","auth.social.github.enabled":true,"auth.social.github.client_id":"github-client","auth.social.github.client_secret":"GitHubSecret-2026","auth.social.qq.enabled":true,"auth.social.qq.client_id":"qq-client","auth.social.qq.client_secret":"QQSecret-2026","auth.social.wechat.enabled":true,"auth.social.wechat.client_id":"wechat-client","auth.social.wechat.client_secret":"WechatSecret-2026","auth.social.rainbow.enabled":true,"auth.social.rainbow.client_id":"rainbow-client","auth.social.rainbow.client_secret":"RainbowSecret-2026","auth.social.rainbow.base_url":"https://login.example.com/connect.php"}'
expect 200 "$(req PUT /api/admin/settings/socialauth "$SOCIAL_PAYLOAD" "$ADMIN")" configure-six >/dev/null
b=$(expect 200 "$(req GET /api/public/auth/providers)" providers-six)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); assert [p["id"] for p in d["providers"]]==["google","facebook","github","qq","wechat","rainbow"]; r=next(p for p in d["providers"] if p["id"]=="rainbow"); assert [x["id"] for x in r["login_types"]][:3]==["qq","wx","alipay"]; assert "secret" not in str(d).lower(); assert "appkey" not in str(d).lower()'

echo '[12/20] every provider secret is encrypted at rest and masked to administrators'
r=$(req GET /api/admin/settings '' "$ADMIN"); b=$(expect 200 "$r" settings-masked)
printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); s=d["socialauth"]; ids=["google","facebook","github","qq","wechat","rainbow"]; assert all(s[f"auth.social.{p}.client_secret"]=="********" for p in ids); assert "auth.social.rainbow.login_type" not in s'
for pair in 'google GoogleSecret-2026' 'facebook FacebookSecret-2026' 'github GitHubSecret-2026' 'qq QQSecret-2026' 'wechat WechatSecret-2026' 'rainbow RainbowSecret-2026'; do set -- $pair; provider=$1; secret=$2; [[ $(mysqlq "SELECT is_encrypted FROM system_settings WHERE setting_key='auth.social.$provider.client_secret';") == 1 ]] || { echo "$provider secret is not encrypted" >&2; exit 1; }; stored=$(mysqlq "SELECT setting_value FROM system_settings WHERE setting_key='auth.social.$provider.client_secret';"); [[ "$stored" != *"$secret"* ]] || { echo "$provider secret stored in plaintext" >&2; exit 1; }; done

echo '[13/20] admin provider status is configuration only, never an admin login surface'
b=$(expect 200 "$(req GET /api/admin/auth/providers '' "$ADMIN")" admin-provider-status);printf '%s' "$b"|python3 -c 'import json,sys; d=json.load(sys.stdin); ps=d["providers"]; assert len(ps)==6; assert all(p["implemented"] for p in ps); assert all("callback_url" in p for p in ps if p["id"]!="rainbow"); assert "callback_url" not in next(p for p in ps if p["id"]=="rainbow"); assert "client_secret" not in str(d).lower()'

echo '[14/20] Google start uses authorization code PKCE and hardened browser cookies'
HEADERS_G=$(mktemp);HEADERS_H=$(mktemp);trap 'rm -f "$HEADERS_G" "$HEADERS_H"' EXIT
HTTP_CODE=$(curl -sS -D "$HEADERS_G" -o /dev/null -w '%{http_code}' "$BASE/api/public/auth/google/start?redirect=%2Fapp%2Fdashboard");[[ "$HTTP_CODE" == 302 ]]||exit 1
LOCATION_G=$(awk 'BEGIN{IGNORECASE=1}/^Location:/{sub(/^[^:]*:[[:space:]]*/,"");sub(/\r$/,"");print;exit}' "$HEADERS_G")
STATE_G=$(python3 -c 'import sys,urllib.parse as u;q=u.parse_qs(u.urlparse(sys.argv[1]).query);assert q["code_challenge_method"]==["S256"];print(q["state"][0])' "$LOCATION_G")
python3 -c 'import sys,urllib.parse as u;p=u.urlparse(sys.argv[1]);assert p.scheme=="https" and p.netloc=="accounts.google.com"' "$LOCATION_G"
STATE_G_HASH=$(printf '%s' "$STATE_G"|sha256sum|awk '{print $1}');[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_G_HASH' AND provider='google' AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() AND CHAR_LENGTH(nonce_hash)=64 AND CHAR_LENGTH(pkce_verifier_hash)=64;") == 1 ]]||exit 1
for cookie in gojet_social_state gojet_social_nonce gojet_social_pkce; do grep -i "^Set-Cookie: $cookie=" "$HEADERS_G"|grep -qi 'HttpOnly' || exit 1; grep -i "^Set-Cookie: $cookie=" "$HEADERS_G"|grep -qi 'SameSite=Lax' || exit 1; done

echo '[15/20] disabling Google blocks callback before consuming outstanding state'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.google.enabled":false}' "$ADMIN")" google-disable >/dev/null
expect 403 "$(req GET "/api/public/auth/google/callback?code=fake-code&state=$STATE_G")" google-disabled-callback >/dev/null
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_G_HASH' AND consumed_at IS NULL;") == 1 ]]||exit 1

echo '[16/20] GitHub start uses PKCE and hardened browser cookies'
HTTP_CODE=$(curl -sS -D "$HEADERS_H" -o /dev/null -w '%{http_code}' "$BASE/api/public/auth/github/start?redirect=%2Fapp%2Fdashboard");[[ "$HTTP_CODE" == 302 ]]||exit 1
LOCATION_H=$(awk 'BEGIN{IGNORECASE=1}/^Location:/{sub(/^[^:]*:[[:space:]]*/,"");sub(/\r$/,"");print;exit}' "$HEADERS_H")
STATE_H=$(python3 -c 'import sys,urllib.parse as u;q=u.parse_qs(u.urlparse(sys.argv[1]).query);assert q["code_challenge_method"]==["S256"];assert q["scope"]==["user:email"];print(q["state"][0])' "$LOCATION_H")
python3 -c 'import sys,urllib.parse as u;p=u.urlparse(sys.argv[1]);assert p.scheme=="https" and p.netloc=="github.com" and p.path=="/login/oauth/authorize"' "$LOCATION_H"
STATE_H_HASH=$(printf '%s' "$STATE_H"|sha256sum|awk '{print $1}');[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_H_HASH' AND provider='github' AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP() AND CHAR_LENGTH(nonce_hash)=64 AND CHAR_LENGTH(pkce_verifier_hash)=64;") == 1 ]]||exit 1
for cookie in gojet_social_state gojet_social_nonce gojet_social_pkce; do grep -i "^Set-Cookie: $cookie=" "$HEADERS_H"|grep -qi 'HttpOnly' || exit 1; grep -i "^Set-Cookie: $cookie=" "$HEADERS_H"|grep -qi 'SameSite=Lax' || exit 1; done

echo '[17/20] disabling GitHub blocks callback before consuming outstanding state'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.github.enabled":false}' "$ADMIN")" github-disable >/dev/null
expect 403 "$(req GET "/api/public/auth/github/callback?code=fake-code&state=$STATE_H")" github-disabled-callback >/dev/null
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$STATE_H_HASH' AND consumed_at IS NULL;") == 1 ]]||exit 1

echo '[18/20] disabling selected providers removes them from customer discovery immediately'
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.facebook.enabled":false,"auth.social.qq.enabled":false,"auth.social.wechat.enabled":false,"auth.social.rainbow.enabled":false}' "$ADMIN")" disable-four >/dev/null
b=$(expect 200 "$(req GET /api/public/auth/providers)" providers-none);printf '%s' "$b"|python3 -c 'import json,sys; assert json.load(sys.stdin)["providers"]==[]'

echo '[19/20] account policy and email-code endpoint remain available independently of social login'
expect 200 "$(req GET /api/public/account-policy)" account-policy >/dev/null
expect 422 "$(req POST /api/public/email-code '{}')" email-code-validation >/dev/null

echo '[20/20] customer authentication never weakens admin authentication credentials'
expect 401 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"wrong-password"}')" admin-wrong-password >/dev/null
expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-password-still-required >/dev/null
printf 'GoJet authentication policy acceptance: PASS\n'
