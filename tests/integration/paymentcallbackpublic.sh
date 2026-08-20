#!/usr/bin/env bash
set -euo pipefail

BASE=${GOJET_PUBLIC_BASE:-http://127.0.0.1:18081}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_payment_public}

mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){
  local method=$1 path=$2 body=${3:-} token=${4:-}
  local args=(-sS -X "$method" -H 'Content-Type: application/json' -w $'\n%{http_code}')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(--data "$body")
  curl "${args[@]}" "$BASE$path"
}
expect(){
  local want=$1 raw=$2 label=$3 got body
  got=$(printf '%s\n' "$raw"|tail -n1)
  body=$(printf '%s\n' "$raw"|sed '$d')
  [[ "$got" == "$want" ]] || { echo "FAIL $label expected HTTP $want got $got" >&2; echo "$body" >&2; exit 1; }
  printf '%s' "$body"
}
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

for config in deploy/nginx/gojet.conf deploy/nginx/gojethost.conf deploy/nginx/gojetnative.conf deploy/nginx/gojetbtrewrite.conf; do
  grep -Fq 'location ^~ /api/payments/' "$config"
  grep -Fq 'proxy_request_buffering off;' "$config"
  grep -Fq 'client_max_body_size 3m;' "$config"
  grep -Fq 'add_header Cache-Control "no-store" always;' "$config"
done

echo '[1/8] configure Epay through persisted settings'
mysqlq "INSERT INTO system_settings(setting_key,setting_value,is_encrypted) VALUES
('payments.enabled','true',FALSE),
('payments.epay.enabled','true',FALSE),
('payments.epay.gateway','https://gateway.example.test',FALSE),
('payments.epay.pid','1000',FALSE),
('payments.epay.key','epay-public-callback-secret',FALSE),
('payments.epay.default_type','alipay',FALSE)
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_encrypted=FALSE;"

suffix="$(date +%s)$RANDOM"
registration=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"publiccallback$suffix@example.test\",\"display_name\":\"公网支付回调验收\",\"password\":\"PublicCallback!2026\"}")" register)
token=$(printf '%s' "$registration"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
invoice=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"purchase","billing_cycle":"monthly"}' "$token")" createinvoice)
invoice_id=$(printf '%s' "$invoice"|field "['id']")
checkout=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices/$invoice_id/pay" '{"provider":"epay"}' "$token")" checkout)
order=$(printf '%s' "$checkout"|field "['merchant_order_no']")
amount_cents=$(mysqlq "SELECT amount_cents FROM billing_invoices WHERE id=$invoice_id;")
amount=$(python3 - "$amount_cents" <<'PY'
import sys
value=int(sys.argv[1])
print(f'{value//100}.{value%100:02d}')
PY
)
[[ "$(mysqlq "SELECT status FROM payment_transactions WHERE merchant_order_no='$order';")" == pending ]]
transaction_id=$(mysqlq "SELECT id FROM payment_transactions WHERE merchant_order_no='$order';")
trade="EPAYPUBLIC$suffix"

valid_form=$(python3 - "$order" "$trade" "$amount" <<'PY'
import hashlib,sys,urllib.parse
order,trade,money=sys.argv[1:]
values={'pid':'1000','trade_no':trade,'out_trade_no':order,'type':'alipay','name':'GoJet 专业版','money':money,'trade_status':'TRADE_SUCCESS'}
raw='&'.join(f'{k}={values[k]}' for k in sorted(values))+'epay-public-callback-secret'
values['sign']=hashlib.md5(raw.encode()).hexdigest()
values['sign_type']='MD5'
print(urllib.parse.urlencode(values))
PY
)
invalid_form=$(python3 - "$valid_form" <<'PY'
import sys,urllib.parse
values=urllib.parse.parse_qs(sys.argv[1],keep_blank_values=True)
flat={k:v[-1] for k,v in values.items()}
flat['sign']='00000000000000000000000000000000'
print(urllib.parse.urlencode(flat))
PY
)

echo '[2/8] invalid signature reaches public Nginx but cannot settle'
invalid_headers=$(mktemp)
invalid_body=$(mktemp)
invalid_status=$(curl -sS -D "$invalid_headers" -o "$invalid_body" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'X-Request-ID: stage5invalidcallback0001' \
  --data "$invalid_form" "$BASE/api/payments/epay/notify")
[[ "$invalid_status" == 400 ]] || { cat "$invalid_body" >&2; exit 1; }
grep -Fxq fail "$invalid_body"
grep -Eiq '^X-Request-ID:[[:space:]]*stage5invalidcallback0001' "$invalid_headers"
grep -Eiq '^Cache-Control:[[:space:]]*no-store' "$invalid_headers"
[[ "$(mysqlq "SELECT status FROM payment_transactions WHERE id=$transaction_id;")" == pending ]]
[[ "$(mysqlq "SELECT status FROM billing_invoices WHERE id=$invoice_id;")" == pending ]]

echo '[3/8] valid signed GET callback settles through public Nginx'
valid_headers=$(mktemp)
valid_body=$(mktemp)
valid_status=$(curl -sS -D "$valid_headers" -o "$valid_body" -w '%{http_code}' -G \
  -H 'X-Request-ID: stage5validcallback0001' \
  "$BASE/api/payments/epay/notify?$valid_form")
[[ "$valid_status" == 200 ]] || { cat "$valid_body" >&2; exit 1; }
grep -Fxq success "$valid_body"
grep -Eiq '^X-Request-ID:[[:space:]]*stage5validcallback0001' "$valid_headers"
grep -Eiq '^Cache-Control:[[:space:]]*no-store' "$valid_headers"
[[ "$(mysqlq "SELECT status FROM payment_transactions WHERE id=$transaction_id;")" == paid ]]
[[ "$(mysqlq "SELECT provider_order_id FROM payment_transactions WHERE id=$transaction_id;")" == "$trade" ]]
[[ "$(mysqlq "SELECT status FROM billing_invoices WHERE id=$invoice_id;")" == paid ]]
[[ "$(mysqlq "SELECT paid_via FROM billing_invoices WHERE id=$invoice_id;")" == epay ]]
[[ "$(mysqlq "SELECT payment_reference FROM billing_invoices WHERE id=$invoice_id;")" == "$trade" ]]
[[ "$(mysqlq "SELECT p.code FROM workspace_subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.workspace_id=$wid;")" == pro ]]

echo '[4/8] identical provider retry remains idempotent'
replay_headers=$(mktemp)
replay_body=$(mktemp)
replay_status=$(curl -sS -D "$replay_headers" -o "$replay_body" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'X-Request-ID: stage5replaycallback0001' \
  --data "$valid_form" "$BASE/api/payments/epay/notify")
[[ "$replay_status" == 200 ]] || { cat "$replay_body" >&2; exit 1; }
grep -Fxq success "$replay_body"
grep -Eiq '^X-Request-ID:[[:space:]]*stage5replaycallback0001' "$replay_headers"
[[ "$(mysqlq "SELECT COUNT(*) FROM subscription_events WHERE invoice_id=$invoice_id AND event_type='invoice.paid';")" == 1 ]]

echo '[5/8] callback facts are persisted without raw payloads'
[[ "$(mysqlq "SELECT COUNT(*) FROM payment_callback_events WHERE provider='epay' AND merchant_order_no='$order';")" == 3 ]]
[[ "$(mysqlq "SELECT COUNT(*) FROM payment_callback_events WHERE provider='epay' AND merchant_order_no='$order' AND outcome='accepted' AND response_status=200;")" == 2 ]]
[[ "$(mysqlq "SELECT COUNT(*) FROM payment_callback_events WHERE provider='epay' AND merchant_order_no='$order' AND outcome='rejected' AND response_status=400;")" == 1 ]]
[[ "$(mysqlq "SELECT COUNT(*) FROM payment_callback_events WHERE merchant_order_no='$order' AND provider_reference='$trade' AND transaction_id=$transaction_id AND invoice_id=$invoice_id;")" == 3 ]]
[[ "$(mysqlq "SELECT COUNT(DISTINCT payload_sha256) FROM payment_callback_events WHERE merchant_order_no='$order';")" == 2 ]]
[[ "$(mysqlq "SELECT COUNT(*) FROM payment_callback_events WHERE merchant_order_no='$order' AND request_id IN ('stage5invalidcallback0001','stage5validcallback0001','stage5replaycallback0001');")" == 3 ]]

echo '[6/8] billing administrator can query callback observability'
admin=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" adminlogin)
admin_token=$(printf '%s' "$admin"|field "['token']")
callbacks=$(expect 200 "$(req GET '/api/admin/payment-callbacks?limit=100' '' "$admin_token")" callbacks)
callbacks_file=$(mktemp)
printf '%s' "$callbacks" > "$callbacks_file"
python3 - "$callbacks_file" "$order" "$transaction_id" "$invoice_id" "$trade" <<'PY'
import json,sys
path,order,transaction,invoice,trade=sys.argv[1:]
with open(path,encoding='utf-8') as handle:
    data=json.load(handle)['data']
rows=[row for row in data if row.get('merchant_order_no')==order]
assert len(rows)==3, rows
assert sorted(row['outcome'] for row in rows)==['accepted','accepted','rejected']
assert {int(row['response_status']) for row in rows}=={200,400}
assert all(int(row['transaction_id'])==int(transaction) for row in rows)
assert all(int(row['invoice_id'])==int(invoice) for row in rows)
assert all(row['provider_reference']==trade for row in rows)
assert {row['request_id'] for row in rows}=={'stage5invalidcallback0001','stage5validcallback0001','stage5replaycallback0001'}
assert all(len(row['payload_sha256'])==64 for row in rows)
assert all('payload' not in row and 'raw' not in row for row in rows)
print('administrator payment callback observability: PASS')
PY

echo '[7/8] callback route remains public while observability query remains protected'
unauthorized=$(curl -sS -o /tmp/gojetcallbackunauthorized -w '%{http_code}' "$BASE/api/admin/payment-callbacks")
[[ "$unauthorized" == 401 || "$unauthorized" == 403 ]]
public_probe=$(curl -sS -o /tmp/gojetcallbackprobe -w '%{http_code}' -X POST -H 'Content-Type: application/x-www-form-urlencoded' --data 'pid=1000' "$BASE/api/payments/epay/notify")
[[ "$public_probe" == 400 ]]
grep -Fxq fail /tmp/gojetcallbackprobe

echo '[8/8] no duplicate settlement after callback replay'
[[ "$(mysqlq "SELECT COUNT(*) FROM subscription_events WHERE invoice_id=$invoice_id AND event_type='invoice.paid';")" == 1 ]]
[[ "$(mysqlq "SELECT COUNT(*) FROM payment_transactions WHERE merchant_order_no='$order';")" == 1 ]]

printf 'GoJet public Epay GET callback ingress + observability acceptance: PASS (%s -> transaction %s -> invoice %s)\n' "$order" "$transaction_id" "$invoice_id"
