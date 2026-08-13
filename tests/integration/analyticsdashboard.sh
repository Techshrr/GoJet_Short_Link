#!/usr/bin/env bash
set -euo pipefail
mkdir -p test-results
exec > >(tee test-results/analyticsdashboard.log) 2>&1

BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}
REDIS_ADDRESS=${REDIS_ADDRESS:-127.0.0.1:6379}
REDIS_HOST=${REDIS_ADDRESS%:*}
REDIS_PORT=${REDIS_ADDRESS##*:}

mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"; }
redisq(){ redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "$@"; }
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

suffix="$(date +%s)$RANDOM"
registration=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"dashboard$suffix@example.test\",\"display_name\":\"数据看板验收\",\"password\":\"DashboardAcceptance!2026\"}")" register)
token=$(printf '%s' "$registration"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
created=$(expect 201 "$(req POST "/api/workspaces/$wid/links" '{"destination":"https://example.com/dashboard","title":"数据看板短链","redirect_status":302,"one_time":false}' "$token")" create-link)
lid=$(printf '%s' "$created"|field "['id']")

today=$(date -u +%F)
yesterday=$(date -u -d 'yesterday' +%F)
month=$(date -u +%Y-%m)
redisq SET "gojet:daily:$lid:$today" 7 >/dev/null
redisq SET "gojet:clicks:$lid" 12 >/dev/null
redisq PFADD "gojet:visitors-month:$lid:$month" visitor-a visitor-b visitor-c >/dev/null

mysqlq "INSERT INTO analytics_daily(link_id,metric_date,clicks,bot_visits) VALUES('$lid','$yesterday',5,0),('$lid','$today',4,0) ON DUPLICATE KEY UPDATE clicks=VALUES(clicks),bot_visits=VALUES(bot_visits);"
mysqlq "INSERT IGNORE INTO analytics_events(stream_id,link_id,destination_id,occurred_at,visitor_hash,referer_url,referer_host,source_type,country,region,city,device,browser,operating_system,language,visit_type,is_bot) VALUES
('dash${suffix}a','$lid','0',UTC_TIMESTAMP(),REPEAT('a',64),'https://search.example/','search.example','referer','SG','Singapore','Singapore','desktop','chrome','windows','zh-CN','redirect',0),
('dash${suffix}b','$lid','0',UTC_TIMESTAMP(),REPEAT('b',64),NULL,NULL,'direct','US','California','San Francisco','mobile','safari','ios','en-US','redirect',0);"

user_overview=$(expect 200 "$(req GET "/api/workspaces/$wid/overview" '' "$token")" user-overview)
printf '%s' "$user_overview" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["today_clicks"]==7,d
assert d["month_clicks"]>=12,d
assert d["unique_visitors"]==3,d
assert d["recent"] and d["recent"][0]["clicks"]==12,d["recent"]
assert d["trend"][-1]["clicks"]==7,d["trend"][-1]
assert d["source"]=="redis-realtime+mysql-history",d
print("workspace dashboard realtime consistency: PASS")
'

admin=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login)
admin_token=$(printf '%s' "$admin"|field "['token']")
admin_overview=$(expect 200 "$(req GET /api/admin/overview '' "$admin_token")" admin-overview)
printf '%s' "$admin_overview" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["today_clicks"]==7,d
print("administrator realtime today consistency: PASS")
'

analytics=$(expect 200 "$(req GET /api/admin/analytics/overview '' "$admin_token")" admin-analytics)
printf '%s' "$analytics" | python3 -c '
import json,sys
d=json.load(sys.stdin)
assert d["today_clicks"]==7,d
assert len(d["trend"])==30,d["trend"]
assert d["trend"][-1]["clicks"]==7,d["trend"][-1]
assert d["visits_30d"]>=2,d
assert d["unique_visitors_30d"]>=2,d
assert any(x["name"]=="referer" for x in d["sources"]),d["sources"]
assert any(x["name"]=="SG" for x in d["countries"]),d["countries"]
assert any(x["name"]=="desktop" for x in d["devices"]),d["devices"]
assert any(x["name"]=="chrome" for x in d["browsers"]),d["browsers"]
for key in ("stream_length","pending","retrying","dead_letters","reconciliation_lag"):
    assert key in d["pipeline"],d["pipeline"]
assert d["metric_source"]=="redis_realtime_mysql_history",d
print("administrator analytics dashboard payload: PASS")
'

printf 'GoJet Analytics Dashboard acceptance: PASS (workspace %s, link %s)\n' "$wid" "$lid"
