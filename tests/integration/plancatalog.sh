#!/usr/bin/env bash
set -euo pipefail

BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

admin=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login)
admin_token=$(printf '%s' "$admin"|field "['token']")

suffix="$(date +%s)$RANDOM"
code="team_${suffix}"
create_body=$(cat <<JSON
{"code":"$code","name":"团队协作版","description":"用于套餐目录验收","currency":"CNY","monthly_price_cents":8800,"link_limit":8000,"qr_limit":1500,"text_limit":1500,"bio_limit":80,"file_storage_bytes":21474836480,"member_limit":20,"analytics_retention_days":365,"features":["8,000 条短链接","20 位团队成员","365 天访问分析"]}
JSON
)
created=$(expect 201 "$(req POST /api/admin/plans "$create_body" "$admin_token")" create-plan)
plan_id=$(printf '%s' "$created"|field "['id']")
[[ "$(mysqlq "SELECT code FROM plans WHERE id=$plan_id;")" == "$code" ]] || { echo 'created plan was not persisted' >&2; exit 1; }
[[ "$(mysqlq "SELECT JSON_UNQUOTE(JSON_EXTRACT(features,'\$[1]')) FROM plans WHERE id=$plan_id;")" == '20 位团队成员' ]] || { echo 'plan feature list was not persisted as text list' >&2; exit 1; }

update_body='{"name":"团队协作版 Plus","description":"正常后台字段编辑","status":"active","monthly_price_cents":9900,"link_limit":9000,"qr_limit":1800,"text_limit":1800,"bio_limit":90,"file_storage_bytes":32212254720,"member_limit":25,"analytics_retention_days":400,"features":["9,000 条短链接","25 位团队成员","400 天访问分析"]}'
expect 200 "$(req PUT "/api/admin/plans/$plan_id" "$update_body" "$admin_token")" update-plan >/dev/null
[[ "$(mysqlq "SELECT CONCAT(name,'|',monthly_price_cents,'|',member_limit) FROM plans WHERE id=$plan_id;")" == '团队协作版 Plus|9900|25' ]] || { echo 'plan editor did not persist ordinary fields' >&2; exit 1; }

# An unused custom plan can be removed from future purchase choices without
# destroying historical rows.
expect 200 "$(req DELETE "/api/admin/plans/$plan_id" '' "$admin_token")" archive-unused >/dev/null
[[ "$(mysqlq "SELECT status FROM plans WHERE id=$plan_id;")" == archived ]] || { echo 'unused custom plan was not archived' >&2; exit 1; }

# The built-in registration fallback must never disappear while registration
# still assigns it to new workspaces.
starter_id=$(mysqlq "SELECT id FROM plans WHERE code='starter';")
starter_raw=$(req DELETE "/api/admin/plans/$starter_id" '' "$admin_token")
expect 422 "$starter_raw" archive-starter | grep -Fq '默认套餐'
[[ "$(mysqlq "SELECT status FROM plans WHERE id=$starter_id;")" == active ]] || { echo 'starter plan was incorrectly archived' >&2; exit 1; }

# A plan currently assigned to customers may be edited but cannot be removed
# from the active catalog until those subscriptions move away from it.
pro_id=$(mysqlq "SELECT id FROM plans WHERE code='pro';")
user_suffix="$(date +%s)-$RANDOM"
registration=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"plan-$user_suffix@example.test\",\"display_name\":\"套餐目录验收\",\"password\":\"PlanCatalogAcceptance!2026\"}")" register-user)
user_token=$(printf '%s' "$registration"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$user_token")" user-workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
mysqlq "UPDATE workspace_subscriptions SET plan_id=$pro_id,status='active' WHERE workspace_id=$wid;"
pro_raw=$(req DELETE "/api/admin/plans/$pro_id" '' "$admin_token")
expect 422 "$pro_raw" archive-in-use | grep -Fq '客户正在使用'
[[ "$(mysqlq "SELECT status FROM plans WHERE id=$pro_id;")" == active ]] || { echo 'in-use plan was incorrectly archived' >&2; exit 1; }

printf 'GoJet plan catalog lifecycle acceptance: PASS (created %s, protected starter and active subscriptions)\n' "$code"
