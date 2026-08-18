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

admin_body=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login)
admin=$(printf '%s' "$admin_body"|field "['token']")
suffix=$(date +%s)
user_body=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"billing-conflict-$suffix@example.test\",\"display_name\":\"账单冲突验收\",\"password\":\"BillingConflict!2026\"}")" register)
user=$(printf '%s' "$user_body"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$user")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')

invoice_body=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"purchase","billing_cycle":"monthly"}' "$user")" request-invoice)
invoice_id=$(printf '%s' "$invoice_body"|field "['id']")
amount=$(mysqlq "SELECT amount_cents FROM billing_invoices WHERE id=$invoice_id;")
currency=$(mysqlq "SELECT currency FROM billing_invoices WHERE id=$invoice_id;")
order="GJCONFLICT${suffix}"
mysqlq "INSERT INTO payment_transactions(invoice_id,workspace_id,provider,merchant_order_no,amount_cents,currency,status) VALUES($invoice_id,$wid,'stripe','$order',$amount,'$currency','pending');"

blocked=$(req POST "/api/admin/invoices/$invoice_id/settle" '{"status":"paid","note":"人工核对"}' "$admin")
expect 422 "$blocked" api-conflict >/dev/null
printf '%s\n' "$blocked" | sed '$d' | grep -q '进行中的在线支付'

set +e
db_error=$(MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "UPDATE billing_invoices SET status='void' WHERE id=$invoice_id;" 2>&1)
db_rc=$?
set -e
[[ $db_rc -ne 0 ]] || { echo 'database trigger allowed manual settlement during active payment' >&2; exit 1; }
printf '%s' "$db_error" | grep -q '进行中的在线支付'
[[ "$(mysqlq "SELECT status FROM billing_invoices WHERE id=$invoice_id;")" == pending ]] || { echo 'blocked invoice state changed unexpectedly' >&2; exit 1; }

mysqlq "UPDATE payment_transactions SET status='failed',failure_reason='acceptance cleanup' WHERE merchant_order_no='$order';"
expect 200 "$(req POST "/api/admin/invoices/$invoice_id/settle" '{"status":"paid","note":"外部支付已结束，人工核销"}' "$admin")" manual-settle-after-payment-ended >/dev/null
[[ "$(mysqlq "SELECT status FROM billing_invoices WHERE id=$invoice_id;")" == paid ]] || { echo 'manual settlement did not complete after payment ended' >&2; exit 1; }
[[ "$(mysqlq "SELECT paid_via FROM billing_invoices WHERE id=$invoice_id;")" == manual ]] || { echo 'manual settlement source was not recorded' >&2; exit 1; }

printf 'GoJet billing external-payment conflict acceptance: PASS\n'
