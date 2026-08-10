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

admin_body=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login)
admin=$(printf '%s' "$admin_body"|field "['token']")
mail_payload='{"host":"127.0.0.1","port":2525,"username":"","password":"","encryption":"none","ehlo":"gojet.test","from_email":"noreply@gojet.test","from_name":"GoJet","reply_to":"support@gojet.test"}'
expect 200 "$(req PUT /api/admin/settings/mail "$mail_payload" "$admin")" save-smtp >/dev/null
settings=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" settings-readback)
printf '%s' "$settings" | python3 -c 'import json,sys; m=json.load(sys.stdin)["mail"]; assert m["host"]=="127.0.0.1"; assert int(m["port"])==2525; assert m["encryption"]=="none"; assert m["from_email"]=="noreply@gojet.test"; assert m["from_name"]=="GoJet"; assert m["reply_to"]=="support@gojet.test"; assert m["password_configured"] is False'
expect 200 "$(req POST /api/admin/mail/test '{"recipient":"smtp-acceptance@example.test"}' "$admin")" test-mail >/dev/null
for _ in $(seq 1 30); do grep -q 'smtp-acceptance@example.test' "$MAIL_LOG" && break; sleep .2; done
grep -q 'GoJet 邮件服务测试成功' "$MAIL_LOG"
grep -q '#16A66A\|#16a66a' "$MAIL_LOG"

required_templates=(verification account_welcome password_reset password_changed email_changed workspace_invitation workspace_role_changed workspace_owner_transferred workspace_member_removed invoice_created invoice_due_soon invoice_overdue invoice_paid invoice_voided payment_started payment_failed payment_refunded subscription_changed subscription_renewed subscription_cancellation_scheduled subscription_cancellation_revoked subscription_expiring subscription_cancelled file_quarantined domain_verification_failed)
for key in "${required_templates[@]}"; do
  count=$(mysqlq "SELECT COUNT(*) FROM mail_templates WHERE template_key='$key' AND status='active';")
  [[ "$count" == 1 ]] || { echo "required active mail template missing: $key" >&2; exit 1; }
done

suffix=$(date +%s)
user_email="mail-life-$suffix@example.test"
reg=$(expect 201 "$(req POST /api/auth/register "{\"email\":\"$user_email\",\"display_name\":\"邮件生命周期验收\",\"password\":\"MailLifecycle!2026\"}")" register)
token=$(printf '%s' "$reg"|field "['token']")
spaces=$(expect 200 "$(req GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')
expect 202 "$(req POST /api/auth/forgot-password "{\"email\":\"$user_email\"}")" password-reset-mail >/dev/null
expect 201 "$(req POST "/api/workspaces/$wid/billing/invoices" '{"plan_code":"pro","type":"purchase"}' "$token")" invoice-create >/dev/null

source /tmp/gojet/test-env
env MYSQL_DSN="root:root@tcp(127.0.0.1:3306)/$MYSQL_DATABASE?parseTime=true&multiStatements=true" SETTINGS_ENCRYPTION_KEY="$SETTINGS_ENCRYPTION_KEY" /tmp/gojet/mail-worker >/tmp/gojet/mail-worker.log 2>&1 & worker_pid=$!
for _ in $(seq 1 30); do
  welcome=$(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='$user_email' AND message_type='account_welcome';")
  invoice=$(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='$user_email' AND message_type='invoice_created';")
  [[ "$welcome" -ge 1 && "$invoice" -ge 1 ]] && break
  sleep .5
done
[[ "${welcome:-0}" -ge 1 ]] || { cat /tmp/gojet/mail-worker.log >&2; echo 'welcome lifecycle mail missing' >&2; exit 1; }
[[ "${invoice:-0}" -ge 1 ]] || { cat /tmp/gojet/mail-worker.log >&2; echo 'invoice-created lifecycle mail missing' >&2; exit 1; }
for _ in $(seq 1 40); do
  sent=$(mysqlq "SELECT COUNT(*) FROM mail_messages WHERE recipient='$user_email' AND status='sent';")
  [[ "$sent" -ge 2 ]] && break
  sleep .5
done
[[ "${sent:-0}" -ge 2 ]] || { cat /tmp/gojet/mail-worker.log >&2; echo 'lifecycle messages were not delivered by SMTP worker' >&2; exit 1; }
grep -q "$user_email" "$MAIL_LOG"
grep -q '新账单已生成\|账户已准备好' "$MAIL_LOG"

printf 'GoJet SMTP readback, branded test mail and lifecycle coverage acceptance: PASS\n'
