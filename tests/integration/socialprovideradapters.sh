#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18091}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_auth_policy}
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -P3306 -uroot "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
status(){ printf '%s\n' "$1"|tail -n1; }
body(){ printf '%s\n' "$1"|sed '$d'; }
expect(){ local want=$1 got=$2 label=$3; local s; s=$(status "$got"); [[ "$s" == "$want" ]]||{ echo "FAIL $label expected $want got $s" >&2;body "$got" >&2;exit 1;};body "$got"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }
for i in {1..60};do curl -fsS "$BASE/health" >/dev/null 2>&1&&break;sleep 1;[[ $i -lt 60 ]]||exit 1;done
ADMIN=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login|field "['token']")

QQ_SECRET='QQAdapterSecret-2026'
expect 200 "$(req PUT /api/admin/settings/socialauth "{\"auth.social.qq.enabled\":true,\"auth.social.qq.client_id\":\"qq-app-2026\",\"auth.social.qq.client_secret\":\"$QQ_SECRET\"}" "$ADMIN")" qq-config >/dev/null
b=$(expect 200 "$(req GET /api/public/auth/providers)" qq-public)
printf '%s' "$b"|python3 -c 'import json,sys; p={x["id"] for x in json.load(sys.stdin)["providers"]}; assert "qq" in p'
[[ $(mysqlq "SELECT is_encrypted FROM system_settings WHERE setting_key='auth.social.qq.client_secret';") == 1 ]]||{ echo 'QQ secret not encrypted' >&2;exit 1; }
H=$(mktemp); trap 'rm -f "$H"' EXIT
CODE=$(curl -sS -D "$H" -o /dev/null -w '%{http_code}' "$BASE/api/public/auth/qq/start?redirect=%2Fapp%2Fsettings")
[[ "$CODE" == 302 ]]||{ echo "QQ start expected 302 got $CODE" >&2;cat "$H" >&2;exit 1; }
LOCATION=$(awk 'BEGIN{IGNORECASE=1}/^Location:/{sub(/^[^:]*:[[:space:]]*/,"");sub(/\r$/,"");print;exit}' "$H")
STATE=$(python3 -c 'import sys,urllib.parse as u;p=u.urlparse(sys.argv[1]);assert p.scheme=="https" and p.netloc=="graph.qq.com" and p.path=="/oauth2.0/authorize";q=u.parse_qs(p.query);assert q["response_type"]==["code"] and q["scope"]==["get_user_info"];assert "code_challenge" not in q;print(q["state"][0])' "$LOCATION")
HASH=$(printf '%s' "$STATE"|sha256sum|awk '{print $1}')
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$HASH' AND provider='qq' AND consumed_at IS NULL AND CHAR_LENGTH(nonce_hash)=64 AND CHAR_LENGTH(pkce_verifier_hash)=64;") == 1 ]]||{ echo 'QQ attempt browser binding missing' >&2;exit 1; }
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.qq.enabled":false}' "$ADMIN")" qq-disable >/dev/null
expect 403 "$(req GET "/api/public/auth/qq/callback?code=fake&state=$STATE")" qq-disabled-callback >/dev/null
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$HASH' AND consumed_at IS NULL;") == 1 ]]||{ echo 'disabled QQ callback consumed state' >&2;exit 1; }

WX_SECRET='WeChatAdapterSecret-2026'
expect 200 "$(req PUT /api/admin/settings/socialauth "{\"auth.social.wechat.enabled\":true,\"auth.social.wechat.client_id\":\"wx-app-2026\",\"auth.social.wechat.client_secret\":\"$WX_SECRET\"}" "$ADMIN")" wechat-config >/dev/null
b=$(expect 200 "$(req GET /api/public/auth/providers)" wechat-public)
printf '%s' "$b"|python3 -c 'import json,sys; p={x["id"] for x in json.load(sys.stdin)["providers"]}; assert "wechat" in p'
[[ $(mysqlq "SELECT is_encrypted FROM system_settings WHERE setting_key='auth.social.wechat.client_secret';") == 1 ]]||{ echo 'WeChat secret not encrypted' >&2;exit 1; }
: >"$H";CODE=$(curl -sS -D "$H" -o /dev/null -w '%{http_code}' "$BASE/api/public/auth/wechat/start?redirect=%2Fapp%2Fsettings")
[[ "$CODE" == 302 ]]||{ echo "WeChat start expected 302 got $CODE" >&2;cat "$H" >&2;exit 1; }
LOCATION=$(awk 'BEGIN{IGNORECASE=1}/^Location:/{sub(/^[^:]*:[[:space:]]*/,"");sub(/\r$/,"");print;exit}' "$H")
STATE=$(python3 -c 'import sys,urllib.parse as u;p=u.urlparse(sys.argv[1]);assert p.scheme=="https" and p.netloc=="open.weixin.qq.com" and p.path=="/connect/qrconnect" and p.fragment=="wechat_redirect";q=u.parse_qs(p.query);assert q["response_type"]==["code"] and q["scope"]==["snsapi_login"];assert "code_challenge" not in q;print(q["state"][0])' "$LOCATION")
HASH=$(printf '%s' "$STATE"|sha256sum|awk '{print $1}')
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$HASH' AND provider='wechat' AND consumed_at IS NULL AND CHAR_LENGTH(nonce_hash)=64 AND CHAR_LENGTH(pkce_verifier_hash)=64;") == 1 ]]||{ echo 'WeChat attempt browser binding missing' >&2;exit 1; }
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.wechat.enabled":false}' "$ADMIN")" wechat-disable >/dev/null
expect 403 "$(req GET "/api/public/auth/wechat/callback?code=fake&state=$STATE")" wechat-disabled-callback >/dev/null
[[ $(mysqlq "SELECT COUNT(*) FROM social_auth_attempts WHERE state_hash='$HASH' AND consumed_at IS NULL;") == 1 ]]||{ echo 'disabled WeChat callback consumed state' >&2;exit 1; }

RAINBOW_SECRET='RainbowAdapterSecret-2026'
expect 200 "$(req PUT /api/admin/settings/socialauth "{\"auth.social.rainbow.enabled\":true,\"auth.social.rainbow.client_id\":\"rainbow-app-2026\",\"auth.social.rainbow.client_secret\":\"$RAINBOW_SECRET\",\"auth.social.rainbow.base_url\":\"https://u.cccyun.cc\",\"auth.social.rainbow.login_type\":\"qq\"}" "$ADMIN")" rainbow-config >/dev/null
b=$(expect 200 "$(req GET /api/public/auth/providers)" rainbow-public)
printf '%s' "$b"|python3 -c 'import json,sys; p={x["id"] for x in json.load(sys.stdin)["providers"]}; assert "rainbow" in p'
[[ $(mysqlq "SELECT is_encrypted FROM system_settings WHERE setting_key='auth.social.rainbow.client_secret';") == 1 ]]||{ echo 'Rainbow secret not encrypted' >&2;exit 1; }
expect 200 "$(req PUT /api/admin/settings/socialauth '{"auth.social.rainbow.base_url":"https://127.0.0.1"}' "$ADMIN")" rainbow-unsafe-base >/dev/null
b=$(expect 200 "$(req GET /api/public/auth/providers)" rainbow-hidden-unsafe)
printf '%s' "$b"|python3 -c 'import json,sys; p={x["id"] for x in json.load(sys.stdin)["providers"]}; assert "rainbow" not in p'

printf 'QQ, WeChat and Rainbow social provider adapter acceptance: PASS\n'
