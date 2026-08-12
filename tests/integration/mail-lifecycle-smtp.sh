#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}; MYSQL_PORT=${MYSQL_PORT:-3306}; MYSQL_USER=${MYSQL_USER:-root}; MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}; MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}
MAIL_LOG=/tmp/gojet/fake-smtp.log
SMTP_PORT=2525
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"; }
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

mkdir -p /tmp/gojet
: > "$MAIL_LOG"
cat >/tmp/gojet/fake-smtp.py <<'PY'
import socketserver,sys
log=sys.argv[1]
class H(socketserver.StreamRequestHandler):
 def reply(self,s): self.wfile.write((s+'\r\n').encode()); self.wfile.flush()
 def handle(self):
  self.reply('220 fake-smtp GoJet acceptance')
  data=False; msg=[]
  while True:
   line=self.rfile.readline()
   if not line: break
   text=line.decode('utf-8','replace').rstrip('\r\n')
   if data:
    if text=='.':
     with open(log,'a',encoding='utf-8') as f: f.write('\n'.join(msg)+'\n---MESSAGE---\n')
     msg=[];data=False;self.reply('250 queued')
    else: msg.append(text)
    continue
   cmd=text.upper()
   if cmd.startswith('EHLO') or cmd.startswith('HELO'): self.reply('250 localhost')
   elif cmd.startswith('NOOP'): self.reply('250 OK')
   elif cmd.startswith('MAIL FROM:') or cmd.startswith('RCPT TO:'): self.reply('250 OK')
   elif cmd=='DATA': data=True;self.reply('354 end with <CRLF>.<CRLF>')
   elif cmd.startswith('RSET'): self.reply('250 OK')
   elif cmd.startswith('QUIT'): self.reply('221 bye');break
   else: self.reply('250 OK')
class S(socketserver.ThreadingTCPServer): allow_reuse_address=True
S(('127.0.0.1',2525),H).serve_forever()
PY
python3 /tmp/gojet/fake-smtp.py "$MAIL_LOG" >/tmp/gojet/fake-smtp.out 2>&1 & smtp_pid=$!
cleanup(){ kill "$smtp_pid" 2>/dev/null || true; [[ -z "${worker_pid:-}" ]] || kill "$worker_pid" 2>/dev/null || true; }
trap cleanup EXIT
for _ in $(seq 1 30); do (echo >/dev/tcp/127.0.0.1/$SMTP_PORT) >/dev/null 2>&1 && break; sleep .2; done

source /tmp/gojet/test-env
start_worker(){
  [[ -z "${worker_pid:-}" ]] || { kill "$worker_pid" 2>/dev/null || true; wait "$worker_pid" 2>/dev/null || true; }
  env MYSQL_DSN="root:root@tcp(127.0.0.1:3306)/$MYSQL_DATABASE?parseTime=true&multiStatements=true" SETTINGS_ENCRYPTION_KEY="$SETTINGS_ENCRYPTION_KEY" PUBLIC_BASE_URL="${GOJET_PUBLIC_BASE:-http://127.0.0.1:18080}" /tmp/gojet/mail-worker >/tmp/gojet/mail-worker.log 2>&1 & worker_pid=$!
  sleep 1.3
}
wait_type(){ local email=$1 type=$2; local count=0; for _ in $(seq 1 30); do count=$(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='$email' AND message_type='$type';"); [[ "$count" -ge 1 ]] && return 0; sleep .2; done; cat /tmp/gojet/mail-worker.log >&2; echo "mail type missing: $type" >&2; return 1; }

admin_body=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login)
admin=$(printf '%s' "$admin_body"|field "['token']")
# Give this test its own explicit secret. Blank password means "preserve the
# currently stored secret" by design, so relying on a blank value would make
# this lifecycle test depend on whatever a previous settings test happened to
# save in the shared P0 database.
mail_payload='{"host":"127.0.0.1","port":2525,"username":"","password":"SMTPAcceptanceSecret!2026","encryption":"none","ehlo":"gojet.test","from_email":"noreply@gojet.test","from_name":"GoJet","reply_to":"support@gojet.test"}'
expect 200 "$(req PUT /api/admin/settings/mail "$mail_payload" "$admin")" save-smtp >/dev/null
settings=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" settings-readback)
printf '%s' "$settings" | python3 -c 'import json,sys; m=json.load(sys.stdin)["mail"]; assert m["host"]=="127.0.0.1"; assert int(m["port"])==2525; assert m["encryption"]=="none"; assert m["from_email"]=="noreply@gojet.test"; assert m["from_name"]=="GoJet"; assert m["reply_to"]=="support@gojet.test"; assert m["password_configured"] is True; assert "password" not in m'
expect 200 "$(req POST /api/admin/mail/test '{"recipient":"smtp-acceptance@example.test"}' "$admin")" test-mail >/dev/null
for _ in $(seq 1 30); do grep -q 'smtp-acceptance@example.test' "$MAIL_LOG" && break; sleep .2; done
python3 - "$MAIL_LOG" <<'PY'
from email import policy
from email.parser import Parser
from email.header import decode_header, make_header
import sys

path = sys.argv[1]
raw = open(path, encoding='utf-8').read()
parts = [part.strip() for part in raw.split('---MESSAGE---') if part.strip()]
target = next((part for part in parts if 'smtp-acceptance@example.test' in part), None)
assert target is not None, 'SMTP acceptance message was not captured'
message = Parser(policy=policy.default).parsestr(target)
subject = str(make_header(decode_header(message.get('Subject', ''))))
payload = message.get_payload(decode=True)
assert payload is not None, 'SMTP acceptance body did not decode'
body = payload.decode(message.get_content_charset() or 'utf-8')
assert subject == 'GoJet 邮件服务测试成功', f'unexpected decoded subject: {subject!r}'
assert '\ufffd' not in subject and '\ufffd' not in body, 'decoded SMTP message contains replacement characters'
for expected in ('#16A66A', 'border-radius:12px', 'padding:0 8px 18px', 'padding:18px 8px 0', '此邮件由 GoJet 自动发送'):
    if expected == '#16A66A':
        assert expected.lower() in body.lower(), f'branded SMTP body missing {expected!r}'
    else:
        assert expected in body, f'branded SMTP body missing {expected!r}'
assert 'border-bottom:3px solid' not in body, 'legacy in-card mail brand stripe is still present'
PY

required_templates=(verification account_welcome password_reset password_changed email_changed workspace_invitation workspace_role_changed workspace_owner_transferred workspace_member_removed invoice_created invoice_due_soon invoice_overdue invoice_paid invoice_voided payment_started payment_failed payment_refunded subscription_changed subscription_renewed subscription_cancellation_scheduled subscription_cancellation_revoked subscription_expiring subscription_cancelled file_quarantined domain_verification_failed)
for key in "${required_templates[@]}"; do
  count=$(mysqlq "SELECT COUNT(*) FROM mail_templates WHERE template_key='$key' AND status='active';")
  [[ "$count" == 1 ]] || { echo "required active mail template missing: $key" >&2; exit 1; }
done

suffix=$(date +%s)
user_email="mail-life-$suffix@example.test"
user_password='MailLifecycle!2026'
reg=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"$user_email\",\"display_name\":\"邮件生命周期验收\",\"password\":\"$user_password\"}")" register)
token=$(printf '%s' "$reg"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')

# Password-recovery creation is security-sensitive: GoJet deliberately revokes
# existing sessions. Assert that behavior before acquiring a fresh session for
# the remaining billing/mail lifecycle checks.
expect 202 "$(req POST /api/auth/forgot-password "{\"email\":\"$user_email\"}")" password-reset-mail >/dev/null
expect 401 "$(req GET /api/me '' "$token")" forgot-password-revokes-old-session >/dev/null
login=$(expect 200 "$(req POST /api/auth/login "{\"email\":\"$user_email\",\"password\":\"$user_password\"}")" relogin-after-password-recovery)
token=$(printf '%s' "$login"|field "['token']")
expect 200 "$(req GET /api/me '' "$token")" fresh-session-after-password-recovery >/dev/null

invoice_body=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"purchase"}' "$token")" invoice-create)
invoice_id=$(printf '%s' "$invoice_body"|field "['id']")

start_worker
wait_type "$user_email" account_welcome
wait_type "$user_email" password_reset
wait_type "$user_email" invoice_created

# Pending invoice approaching due date.
mysqlq "UPDATE billing_invoices SET status='pending',due_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 6 HOUR) WHERE id=$invoice_id;"
start_worker; wait_type "$user_email" invoice_due_soon
# Overdue invoice.
mysqlq "UPDATE billing_invoices SET status='overdue',due_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR) WHERE id=$invoice_id;"
start_worker; wait_type "$user_email" invoice_overdue
# Payment started and failed.
amount=$(mysqlq "SELECT amount_cents FROM billing_invoices WHERE id=$invoice_id;"); currency=$(mysqlq "SELECT currency FROM billing_invoices WHERE id=$invoice_id;")
merchant="GJMAIL${suffix}"
mysqlq "INSERT INTO payment_transactions(invoice_id,workspace_id,provider,merchant_order_no,amount_cents,currency,status,provider_order_id) VALUES($invoice_id,$wid,'stripe','$merchant',$amount,'$currency','pending','pi_mail_$suffix');"
start_worker; wait_type "$user_email" payment_started
mysqlq "UPDATE payment_transactions SET status='failed',failure_reason='支付渠道测试失败' WHERE merchant_order_no='$merchant';"
start_worker; wait_type "$user_email" payment_failed

# Manual settlement after the external attempt has ended queues invoice_paid and subscription_changed.
expect 200 "$(req POST "/api/admin/invoices/$invoice_id/settle" '{"status":"paid","note":"邮件生命周期验收"}' "$admin")" settle-paid >/dev/null
start_worker; wait_type "$user_email" invoice_paid; wait_type "$user_email" subscription_changed

# Cancellation scheduling and revocation each have their own customer notification.
expect 200 "$(req PATCH "/api/workspaces/$wid/billing/cancellation" '{"cancel":true}' "$token")" cancel-schedule >/dev/null
start_worker; wait_type "$user_email" subscription_cancellation_scheduled
expect 200 "$(req PATCH "/api/workspaces/$wid/billing/cancellation" '{"cancel":false}' "$token")" cancel-revoke >/dev/null
start_worker; wait_type "$user_email" subscription_cancellation_revoked

# Period-expiry warning.
mysqlq "UPDATE workspace_subscriptions SET status='active',period_ends_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 2 DAY) WHERE workspace_id=$wid;"
start_worker; wait_type "$user_email" subscription_expiring

# Renewal is a fresh invoice and emits both invoice_paid and subscription_renewed.
renew=$(expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"renewal"}' "$token")" renewal-invoice)
renew_id=$(printf '%s' "$renew"|field "['id']")
expect 200 "$(req POST "/api/admin/invoices/$renew_id/settle" '{"status":"paid","note":"续费邮件验收"}' "$admin")" renewal-paid >/dev/null
start_worker; wait_type "$user_email" subscription_renewed

# Ended subscription notification.
mysqlq "UPDATE workspace_subscriptions SET status='cancelled',cancel_at_period_end=TRUE,period_ends_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE workspace_id=$wid;"
start_worker; wait_type "$user_email" subscription_cancelled

# All required business lifecycle messages must have rendered fully with no unresolved placeholders.
unresolved=$(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='$user_email' AND (subject LIKE '%{{%' OR body_html LIKE '%{{%');")
[[ "$unresolved" == 0 ]] || { echo 'mail lifecycle contains unresolved template variables' >&2; exit 1; }
for type in account_welcome password_reset invoice_created invoice_due_soon invoice_overdue payment_started payment_failed invoice_paid subscription_changed subscription_cancellation_scheduled subscription_cancellation_revoked subscription_expiring subscription_renewed subscription_cancelled; do
  wait_type "$user_email" "$type"
done

for _ in $(seq 1 80); do
  pending=$(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='$user_email' AND status IN ('pending','sending');")
  [[ "$pending" == 0 ]] && break
  sleep .25
done
failed=$(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='$user_email' AND status='failed';")
[[ "$failed" == 0 ]] || { cat /tmp/gojet/mail-worker.log >&2; echo 'some lifecycle mail deliveries failed' >&2; exit 1; }
grep -q "$user_email" "$MAIL_LOG"
grep -q 'GoJet' "$MAIL_LOG"

printf 'GoJet branded SMTP and account/billing/payment/subscription mail lifecycle acceptance: PASS\n'
