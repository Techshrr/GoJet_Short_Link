#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}; MYSQL_PORT=${MYSQL_PORT:-3306}; MYSQL_USER=${MYSQL_USER:-root}; MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}; MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

# Deterministic manual quote: USD/CNY 7.20 plus 1% markup => 7.272.
mysqlq "UPDATE plans SET monthly_price_cents=1000,currency='USD' WHERE code='pro';"
mysqlq "UPDATE system_settings SET setting_value='CNY',is_encrypted=FALSE WHERE setting_key='billing.settlement_currency';"
mysqlq "UPDATE system_settings SET setting_value='manual',is_encrypted=FALSE WHERE setting_key='billing.fx.provider';"
mysqlq "UPDATE system_settings SET setting_value='100',is_encrypted=FALSE WHERE setting_key='billing.fx.markup_bps';"
mysqlq "UPDATE system_settings SET setting_value='{\"USD/CNY\":\"7.20\"}',is_encrypted=FALSE WHERE setting_key='billing.fx.manual_rates';"
mysqlq "DELETE FROM fx_rate_cache;"

admin=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login|field "['token']")
suffix=$(date +%s)
body=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"fx-$suffix@example.test\",\"display_name\":\"汇率验收\",\"password\":\"FXAcceptance!2026\"}")" register)
token=$(printf '%s' "$body"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')

first=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"purchase","billing_cycle":"monthly"}' "$token")" first-invoice)
first_id=$(printf '%s' "$first"|field "['id']")
printf '%s' "$first" | python3 -c 'import json,sys; x=json.load(sys.stdin); assert x["source_amount_cents"]==1000; assert x["source_currency"]=="USD"; assert x["amount_cents"]==7272; assert x["currency"]=="CNY"; assert x["fx_provider"]=="manual"; assert x["fx_markup_bps"]==100; assert x["fx_rate"]=="7.272000000000",x'

# Changing the current quote must never mutate an issued invoice.
mysqlq "UPDATE system_settings SET setting_value='{\"USD/CNY\":\"8.00\"}' WHERE setting_key='billing.fx.manual_rates'; DELETE FROM fx_rate_cache;"
frozen=$(mysqlq "SELECT CONCAT(source_amount_cents,'|',source_currency,'|',amount_cents,'|',currency,'|',CAST(fx_rate AS CHAR),'|',fx_provider,'|',fx_markup_bps) FROM billing_invoices WHERE id=$first_id;")
[[ "$frozen" == '1000|USD|7272|CNY|7.272000000000|manual|100' ]] || { echo "issued invoice FX snapshot mutated: $frozen" >&2; exit 1; }

expect 200 "$(req POST "/api/admin/invoices/$first_id/settle" '{"status":"void","note":"汇率冻结验收后重新报价"}' "$admin")" void-first >/dev/null
second=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"purchase","billing_cycle":"monthly"}' "$token")" second-invoice)
printf '%s' "$second" | python3 -c 'import json,sys; x=json.load(sys.stdin); assert x["source_amount_cents"]==1000; assert x["source_currency"]=="USD"; assert x["amount_cents"]==8080; assert x["currency"]=="CNY"; assert x["fx_rate"]=="8.080000000000",x'

printf 'GoJet billing FX conversion and invoice freeze acceptance: PASS\n'
