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

mysqlq "INSERT INTO system_settings(setting_key,setting_value,is_encrypted) VALUES
('payments.enabled','true',FALSE),
('payments.epay.enabled','true',FALSE),
('payments.epay.gateway','https://gateway.example.test',FALSE),
('payments.epay.pid','1000',FALSE),
('payments.epay.key','epay-acceptance-secret',FALSE),
('payments.epay.default_type','alipay',FALSE)
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),is_encrypted=FALSE;"

suffix="$(date +%s)-$RANDOM"
registration=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"epay-$suffix@example.test\",\"display_name\":\"易支付回调验收\",\"password\":\"EPayCallbackAcceptance!2026\"}")" register)
token=$(printf '%s' "$registration"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
invoice=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"purchase"}' "$token")" create-invoice)
invoice_id=$(printf '%s' "$invoice"|field "['id']")
amount_cents=$(mysqlq "SELECT amount_cents FROM billing_invoices WHERE id=$invoice_id;")
amount=$(python3 - "$amount_cents" <<'PY'
import sys
v=int(sys.argv[1])
print(f'{v//100}.{v%100:02d}')
PY
)

methods=$(expect 200 "$(req GET "/api/workspaces/$wid/billing/payment-methods" '' "$token")" payment-methods)
printf '%s' "$methods" | grep -Fq '"code":"epay"'
checkout=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices/$invoice_id/pay" '{"provider":"epay"}' "$token")" create-checkout)
order=$(printf '%s' "$checkout"|field "['merchant_order_no']")
redirect=$(printf '%s' "$checkout"|field "['redirect_url']")
[[ "$redirect" == https://gateway.example.test/submit.php\?* ]] || { echo "unexpected Epay checkout URL: $redirect" >&2; exit 1; }
printf '%s' "$redirect" | grep -Fq 'return_url='
python3 - "$redirect" <<'PY'
import sys,urllib.parse
q=urllib.parse.parse_qs(urllib.parse.urlsplit(sys.argv[1]).query)
assert q.get('notify_url') == ['http://127.0.0.1:18090/api/payments/epay/notify'] or q.get('notify_url',[""])[0].endswith('/api/payments/epay/notify')
assert q.get('return_url') == ['http://127.0.0.1:18090/api/payments/epay/return'] or q.get('return_url',[""])[0].endswith('/api/payments/epay/return')
PY
[[ "$(mysqlq "SELECT status FROM payment_transactions WHERE merchant_order_no='$order';")" == pending ]] || { echo 'Epay transaction was not pending before callback' >&2; exit 1; }

trade="EPAY$suffix"
form=$(python3 - "$order" "$trade" "$amount" <<'PY'
import hashlib,sys,urllib.parse
order,trade,money=sys.argv[1:]
values={
    'pid':'1000',
    'trade_no':trade,
    'out_trade_no':order,
    'type':'alipay',
    'name':'GoJet 专业版',
    'money':money,
    'trade_status':'TRADE_SUCCESS',
}
raw='&'.join(f'{k}={values[k]}' for k in sorted(values))+'epay-acceptance-secret'
values['sign']=hashlib.md5(raw.encode()).hexdigest()
values['sign_type']='MD5'
print(urllib.parse.urlencode(values))
PY
)

# Real Epay V1 deployments commonly deliver notify_url with GET. This is the
# production compatibility case that previously left a paid merchant order in
# GoJet's pending state.
notify=$(curl -sS -X GET -w $'\n%{http_code}' "$BASE/api/payments/epay/notify?$form")
expect 200 "$notify" epay-get-notify | grep -Fxq success

[[ "$(mysqlq "SELECT status FROM payment_transactions WHERE merchant_order_no='$order';")" == paid ]] || { echo 'Epay callback did not mark transaction paid' >&2; exit 1; }
[[ "$(mysqlq "SELECT provider_order_id FROM payment_transactions WHERE merchant_order_no='$order';")" == "$trade" ]] || { echo 'Epay provider reference was not persisted' >&2; exit 1; }
[[ "$(mysqlq "SELECT status FROM billing_invoices WHERE id=$invoice_id;")" == paid ]] || { echo 'Epay callback did not mark invoice paid' >&2; exit 1; }
[[ "$(mysqlq "SELECT paid_via FROM billing_invoices WHERE id=$invoice_id;")" == epay ]] || { echo 'invoice payment provider was not recorded' >&2; exit 1; }
[[ "$(mysqlq "SELECT payment_reference FROM billing_invoices WHERE id=$invoice_id;")" == "$trade" ]] || { echo 'invoice payment reference was not recorded' >&2; exit 1; }
[[ "$(mysqlq "SELECT p.code FROM workspace_subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.workspace_id=$wid;")" == pro ]] || { echo 'paid Epay invoice did not activate purchased plan' >&2; exit 1; }
[[ "$(mysqlq "SELECT status FROM workspace_subscriptions WHERE workspace_id=$wid;")" == active ]] || { echo 'paid Epay invoice did not activate subscription' >&2; exit 1; }
callback_row=$(mysqlq "SELECT CONCAT(merchant_order_no,'|',provider_reference,'|',outcome,'|',response_status) FROM payment_callback_events WHERE provider='epay' ORDER BY id DESC LIMIT 1;")
[[ "$callback_row" == "$order|$trade|accepted|200" ]] || { echo "GET callback observability mismatch: $callback_row" >&2; exit 1; }

# Provider retries may use POST even when the original callback used GET. The
# identical notification must remain idempotent and return the provider ack.
retry=$(curl -sS -X POST -H 'Content-Type: application/x-www-form-urlencoded' --data "$form" -w $'\n%{http_code}' "$BASE/api/payments/epay/notify")
expect 200 "$retry" epay-post-notify-retry | grep -Fxq success
[[ "$(mysqlq "SELECT COUNT(*) FROM subscription_events WHERE invoice_id=$invoice_id AND event_type='invoice.paid';")" == 1 ]] || { echo 'duplicate Epay callback created duplicate subscription events' >&2; exit 1; }

printf 'GoJet Epay GET/POST signed callback settlement acceptance: PASS (%s -> invoice %s -> pro)\n' "$order" "$invoice_id"
