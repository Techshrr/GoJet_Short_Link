#!/usr/bin/env bash
set -euo pipefail

die(){ printf 'P22: %s\n' "$*" >&2; exit 1; }
note(){ printf '\n==> %s\n' "$*"; }

[[ $(id -u) -eq 0 ]] || die "root required"
TESTED_SHA=${TESTED_SHA:?TESTED_SHA is required}
P21_ARTIFACT_DIR=${P21_ARTIFACT_DIR:?P21_ARTIFACT_DIR is required}
SOURCE_ROOT=${SOURCE_ROOT:?SOURCE_ROOT is required}

HOST=gojet-p22.test
ROOT=/www/wwwroot/$HOST
MYSQL_DATABASE=gojet_p22
MYSQL_USER=gojetp22
MYSQL_PASSWORD='GoJetP22MySQL!2026'
MYSQL_ROOT_PASSWORD='root'
REDIS_PASSWORD='GoJetP22Redis!2026'
ADMIN_EMAIL=owner@example.test
ADMIN_PASSWORD='OwnerPassword!2026'
PUBLIC_BASE="https://$HOST"
API_BASE="$PUBLIC_BASE"
EVIDENCE=/tmp/gojet-p22-evidence
SERVICES=(logreceiver redirectengine platformapi analyticsworker analyticsreconciler mailworker fileworker operationsmonitor)
mkdir -p "$EVIDENCE"

cleanup(){
  set +e
  [[ -n "${SMTP_PID:-}" ]] && kill "$SMTP_PID" 2>/dev/null || true
}
trap cleanup EXIT

retry(){
  local tries=$1 delay=$2; shift 2
  local n=1
  until "$@"; do
    (( n >= tries )) && return 1
    sleep "$delay"; ((n+=1))
  done
}

note "Install fresh host dependencies"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  nginx php8.3-cli php8.3-fpm php8.3-mysql mysql-server redis-server \
  clamav clamav-daemon clamav-freshclam \
  curl jq unzip openssl ca-certificates zbar-tools poppler-utils \
  python3 python3-fonttools fonts-noto-cjk netcat-openbsd

systemctl enable --now mysql
systemctl enable --now redis-server
systemctl enable --now php8.3-fpm
systemctl enable --now nginx

note "Configure authenticated Redis and MySQL 8.x"
if grep -Eq '^[[:space:]]*#?[[:space:]]*requirepass[[:space:]]+' /etc/redis/redis.conf; then
  sed -ri "s|^[[:space:]]*#?[[:space:]]*requirepass[[:space:]].*|requirepass $REDIS_PASSWORD|" /etc/redis/redis.conf
else
  printf '\nrequirepass %s\n' "$REDIS_PASSWORD" >> /etc/redis/redis.conf
fi
systemctl restart redis-server
redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -qx PONG

mysql --protocol=socket -uroot <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PASSWORD}';
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '${MYSQL_PASSWORD}';
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_PASSWORD}';
ALTER USER '${MYSQL_USER}'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '${MYSQL_PASSWORD}';
ALTER USER '${MYSQL_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h127.0.0.1 -uroot -Nse 'SELECT VERSION()' | tee "$EVIDENCE/mysql-version.txt" | grep -E '^8\.'
MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE" -Nse 'SELECT 1' | grep -qx 1

note "Bring up real ClamAV daemon and signatures"
systemctl stop clamav-freshclam.service 2>/dev/null || true
for attempt in 1 2 3; do
  freshclam --stdout && break
  [[ $attempt -eq 3 ]] && die "freshclam could not prepare signatures"
  sleep 10
done
systemctl restart clamav-daemon.service
retry 30 2 test -S /run/clamav/clamd.ctl || die "ClamAV Unix socket unavailable"
systemctl is-active --quiet clamav-daemon.service
clamdscan --version | tee "$EVIDENCE/clamav-version.txt"

note "Create aaPanel/BT filesystem and binary contracts"
mkdir -p \
  /www/server/nginx/sbin /www/server/php/83/bin /www/server/mysql/bin /www/server/redis/src \
  /www/server/panel/vhost/nginx /www/server/panel/vhost/rewrite /www/wwwroot
ln -sfn "$(command -v nginx)" /www/server/nginx/sbin/nginx
ln -sfn "$(command -v php)" /www/server/php/83/bin/php
ln -sfn "$(command -v mysql)" /www/server/mysql/bin/mysql
ln -sfn "$(command -v redis-cli)" /www/server/redis/src/redis-cli

note "Verify and install immutable P21 artifact for exact SHA"
ARCHIVE="$P21_ARTIFACT_DIR/gojet-v5-native-linux-amd64.tar.gz"
[[ -f "$ARCHIVE" ]] || die "P21 archive missing: $ARCHIVE"
(
  cd "$P21_ARTIFACT_DIR"
  sha256sum -c gojet-v5-native-linux-amd64.tar.gz.sha256
)
rm -rf "$ROOT" /tmp/gojet-p22-stage
mkdir -p /tmp/gojet-p22-stage
tar -xzf "$ARCHIVE" -C /tmp/gojet-p22-stage
STAGED=/tmp/gojet-p22-stage/gojet-v5-native-linux-amd64
[[ -d "$STAGED" ]] || die "unexpected P21 archive root"
jq -e --arg sha "$TESTED_SHA" '.schema=="gojet-v5-native-version-manifest-v1" and .phase=="P21" and .gate=="G11" and .git_sha==$sha and .fresh_install_claimed==false' \
  "$STAGED/VERSION-MANIFEST.json" >/dev/null
mv "$STAGED" "$ROOT"
chown -R root:root "$ROOT"
find "$ROOT/bin" -type f -maxdepth 1 -exec chmod 0755 {} +
printf '%s\n' "$TESTED_SHA" > "$EVIDENCE/tested-sha.txt"
sha256sum "$ARCHIVE" | tee "$EVIDENCE/p21-archive.sha256"

note "Create trusted local HTTPS certificate and real Nginx/BT vhost"
cat >/tmp/gojet-p22-ca.cnf <<'EOF'
[req]
distinguished_name=dn
x509_extensions=v3_ca
prompt=no
[dn]
CN=GoJet P22 CI Root CA
[v3_ca]
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid:always
EOF
openssl req -x509 -newkey rsa:2048 -nodes -days 2 \
  -keyout /tmp/gojet-p22-ca.key -out /tmp/gojet-p22-ca.crt -config /tmp/gojet-p22-ca.cnf >/dev/null 2>&1
cat >/tmp/gojet-p22-leaf.cnf <<EOF
[req]
distinguished_name=dn
req_extensions=req_ext
prompt=no
[dn]
CN=$HOST
[req_ext]
subjectAltName=DNS:$HOST
extendedKeyUsage=serverAuth
EOF
openssl req -new -newkey rsa:2048 -nodes \
  -keyout /tmp/gojet-p22.key -out /tmp/gojet-p22.csr -config /tmp/gojet-p22-leaf.cnf >/dev/null 2>&1
openssl x509 -req -in /tmp/gojet-p22.csr -CA /tmp/gojet-p22-ca.crt -CAkey /tmp/gojet-p22-ca.key -CAcreateserial \
  -days 2 -out /tmp/gojet-p22.crt -extensions req_ext -extfile /tmp/gojet-p22-leaf.cnf >/dev/null 2>&1
install -m0644 /tmp/gojet-p22-ca.crt /usr/local/share/ca-certificates/gojet-p22-ca.crt
update-ca-certificates >/dev/null
grep -qE "(^|[[:space:]])$HOST([[:space:]]|$)" /etc/hosts || printf '127.0.0.1 %s\n' "$HOST" >> /etc/hosts

VHOST="/www/server/panel/vhost/nginx/$HOST.conf"
REWRITE="/www/server/panel/vhost/rewrite/$HOST.conf"
: > "$REWRITE"
PHP_SOCK=/run/php/php8.3-fpm.sock
[[ -S "$PHP_SOCK" ]] || die "PHP 8.3 FPM socket missing"
cat >"$VHOST" <<EOF
server {
    listen 80;
    server_name $HOST;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    server_name $HOST;
    root $ROOT/public;
    index index.html index.php;

    ssl_certificate /tmp/gojet-p22.crt;
    ssl_certificate_key /tmp/gojet-p22.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    include $REWRITE;

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param HTTPS on;
        fastcgi_pass unix:$PHP_SOCK;
    }
}
EOF
ln -sfn "$VHOST" "/etc/nginx/conf.d/$HOST.conf"
nginx -t
systemctl restart nginx
curl -fsS "$PUBLIC_BASE/" >/dev/null

note "Run package bootstrap and the four-step HTTPS Web Installer"
(
  cd "$ROOT"
  ./install.sh
)
[[ -f "$ROOT/storage/installer/bootstrap.ready" ]] || die "bootstrap.ready missing"
[[ -f "$ROOT/storage/installer/clamav.ready" ]] || die "clamav.ready missing"

COOKIE=/tmp/gojet-p22-installer.cookies
PAGE=/tmp/gojet-p22-installer.html
curl -fsS -c "$COOKIE" "$PUBLIC_BASE/install/" -o "$PAGE"
grep -Fq 'GoJet 安装向导' "$PAGE"
csrf=$(grep -oE 'name="csrf" value="[a-f0-9]{64}"' "$PAGE" | head -n1 | sed -E 's/.*value="([^"]+)".*/\1/')
[[ ${#csrf} -eq 64 ]] || die "installer CSRF token missing"

post_install(){
  curl -fsS -b "$COOKIE" -c "$COOKIE" "$PUBLIC_BASE/install/" "$@"
}
post_install \
  --data-urlencode "csrf=$csrf" --data-urlencode "action=environment" >"$PAGE"
grep -Fq '数据库与 Redis' "$PAGE" || die "installer environment step did not advance"

post_install \
  --data-urlencode "csrf=$csrf" --data-urlencode "action=connections" \
  --data-urlencode "mysql_port=3306" --data-urlencode "mysql_database=$MYSQL_DATABASE" \
  --data-urlencode "mysql_user=$MYSQL_USER" --data-urlencode "mysql_password=$MYSQL_PASSWORD" \
  --data-urlencode "redis_port=6379" --data-urlencode "redis_password=$REDIS_PASSWORD" >"$PAGE"
grep -Fq '站点与管理员' "$PAGE" || die "installer connections step did not advance"

post_install \
  --data-urlencode "csrf=$csrf" --data-urlencode "action=site" \
  --data-urlencode "public_url=$PUBLIC_BASE" --data-urlencode "admin_email=$ADMIN_EMAIL" \
  --data-urlencode "admin_password=$ADMIN_PASSWORD" --data-urlencode "admin_password_confirm=$ADMIN_PASSWORD" \
  --data-urlencode "alert_email=$ADMIN_EMAIL" >"$PAGE"
grep -Fq '确认安装' "$PAGE" || die "installer site step did not advance"

post_install \
  --data-urlencode "csrf=$csrf" --data-urlencode "action=install" >"$PAGE"
grep -Eq '安装任务|正在安装|安装已提交' "$PAGE" || true

for _ in $(seq 1 120); do
  [[ -f "$ROOT/deploy/native/installed.lock" ]] && break
  if [[ -f "$ROOT/storage/installer/status.json" ]] && jq -e '.result=="failed"' "$ROOT/storage/installer/status.json" >/dev/null 2>&1; then
    cat "$ROOT/storage/installer/status.json" >&2
    journalctl -u gojetinstaller.service --no-pager -n 200 >&2 || true
    die "web installer failed"
  fi
  sleep 2
done
[[ -f "$ROOT/deploy/native/installed.lock" ]] || {
  cat "$ROOT/storage/installer/status.json" >&2 2>/dev/null || true
  journalctl -u gojetinstaller.service --no-pager -n 200 >&2 || true
  die "web installer did not finish"
}
cp "$ROOT/deploy/native/installed.lock" "$EVIDENCE/installed.lock"
cp "$ROOT/storage/installer/status.json" "$EVIDENCE/installer-status.json" 2>/dev/null || true
curl -sS -o /dev/null -w '%{http_code}\n' "$PUBLIC_BASE/install/" | tee "$EVIDENCE/install-locked-http.txt" | grep -qx 404

note "G12 Fresh Install acceptance"
php -v | head -n1 | tee "$EVIDENCE/php-version.txt"
nginx -v 2>"$EVIDENCE/nginx-version.txt"
redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -qx PONG
for service in "${SERVICES[@]}"; do
  systemctl is-active --quiet "gojet@$service.service" || die "service not active: $service"
done
curl -fsS "$API_BASE/health" | tee "$EVIDENCE/nginx-platform-health.json" >/dev/null
curl -fsS "$PUBLIC_BASE/admin/" | grep -Fq '<div id="root"></div>'
curl -fsS "$PUBLIC_BASE/app/" | grep -Fq '<div id="root"></div>'
curl -fsS "$PUBLIC_BASE/docs/" >/dev/null

note "G13 restart and reconnect validation"
for service in "${SERVICES[@]}"; do systemctl restart "gojet@$service.service"; done
for service in "${SERVICES[@]}"; do systemctl is-active --quiet "gojet@$service.service"; done
systemctl restart nginx
nginx -t
systemctl restart redis-server
redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -qx PONG
retry 60 1 curl -fsS "$API_BASE/health" >/dev/null || die "platform failed after Redis restart"
systemctl restart mysql
MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE" -Nse 'SELECT 1' | grep -qx 1
retry 60 1 curl -fsS "$API_BASE/health" >/dev/null || die "platform failed after MySQL restart"
printf '8 systemd services + nginx + Redis/MySQL reconnect: PASS\n' | tee "$EVIDENCE/restart-reconnect.txt"

note "G13 real ClamAV EICAR"
EICAR=/tmp/gojet-p22-eicar.txt
printf '%s' 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' >"$EICAR"
set +e
clamdscan --fdpass "$EICAR" | tee "$EVIDENCE/clamav-eicar.txt"
eicar_rc=${PIPESTATUS[0]}
set -e
[[ $eicar_rc -eq 1 ]] || die "EICAR was not detected by ClamAV (rc=$eicar_rc)"
grep -Fq 'FOUND' "$EVIDENCE/clamav-eicar.txt"
rm -f "$EICAR"

export GOJET_TEST_BASE="$API_BASE"
export GOJET_PUBLIC_BASE="$PUBLIC_BASE"
export MYSQL_HOST=127.0.0.1
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD="$MYSQL_ROOT_PASSWORD"
export MYSQL_DATABASE="$MYSQL_DATABASE"
export UPLOAD_STORAGE_PATH="$ROOT/deploy/data/uploads"
export GENERATED_QR_STORAGE_PATH="$ROOT/deploy/data/generated/qr"
export FILE_STORAGE_PATH="$ROOT/deploy/data/files"

note "G13 QR real render/decode/redirect"
bash "$SOURCE_ROOT/tests/integration/qrreale2e.sh" | tee "$EVIDENCE/qr.txt"

note "G13 file real upload/download lifecycle"
bash "$SOURCE_ROOT/tests/integration/filesharelifecycle.sh" | tee "$EVIDENCE/files.txt"

note "G13 PDF real render"
bash "$SOURCE_ROOT/tests/integration/invoicepdfrender.sh" | tee "$EVIDENCE/pdf.txt"

note "G13 production OAuth provider adapter contracts"
bash "$SOURCE_ROOT/tests/integration/socialprovideradapters.sh" | tee "$EVIDENCE/oauth.txt"

note "G13 production payment signed channel contract"
bash "$SOURCE_ROOT/tests/integration/epaycallback.sh" | tee "$EVIDENCE/payment.txt"

note "G13 real SMTP transport through installed mail worker"
cat >/tmp/gojet-p22-smtp.py <<'PY'
import socket
from pathlib import Path
host='127.0.0.1'; port=2525
log=Path('/tmp/gojet-p22-evidence/smtp-session.txt')
with socket.socket() as s:
    s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
    s.bind((host,port)); s.listen(5)
    while True:
        c,_=s.accept()
        with c:
            c.sendall(b'220 gojet-p22.test ESMTP\r\n')
            data_mode=False
            buf=b''
            while True:
                d=c.recv(4096)
                if not d: break
                buf+=d
                while b'\n' in buf:
                    line,buf=buf.split(b'\n',1)
                    line=line.rstrip(b'\r')
                    with log.open('ab') as f: f.write(line+b'\n')
                    upper=line.upper()
                    if data_mode:
                        if line==b'.':
                            data_mode=False; c.sendall(b'250 queued\r\n')
                        continue
                    if upper.startswith((b'EHLO',b'HELO')):
                        c.sendall(b'250-gojet-p22.test\r\n250 SIZE 10485760\r\n')
                    elif upper.startswith(b'MAIL FROM:'): c.sendall(b'250 ok\r\n')
                    elif upper.startswith(b'RCPT TO:'): c.sendall(b'250 ok\r\n')
                    elif upper==b'DATA': data_mode=True; c.sendall(b'354 end with .\r\n')
                    elif upper==b'RSET': c.sendall(b'250 reset\r\n')
                    elif upper==b'NOOP': c.sendall(b'250 ok\r\n')
                    elif upper==b'QUIT': c.sendall(b'221 bye\r\n'); break
                    else: c.sendall(b'250 ok\r\n')
                else:
                    continue
                break
PY
python3 /tmp/gojet-p22-smtp.py &
SMTP_PID=$!
retry 20 1 nc -z 127.0.0.1 2525 || die "SMTP acceptance server did not start"

admin_json=$(curl -fsS -H 'Content-Type: application/json' \
  --data "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$API_BASE/api/admin/auth/login")
ADMIN_TOKEN=$(jq -r '.token' <<<"$admin_json")
[[ -n "$ADMIN_TOKEN" && "$ADMIN_TOKEN" != null ]] || die "admin login token missing"

curl -fsS -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"host":"127.0.0.1","port":2525,"username":"","password":"SMTPAcceptanceSecret!2026","encryption":"none","ehlo":"gojet-p22.test","from_email":"no-reply@gojet-p22.test","from_name":"GoJet P22","reply_to":"support@gojet-p22.test"}' \
  "$API_BASE/api/admin/settings/mail" >/dev/null
curl -fsS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"recipient":"p22-mail@example.test"}' \
  "$API_BASE/api/admin/mail/test" >/dev/null
for _ in $(seq 1 60); do
  [[ -f "$EVIDENCE/smtp-session.txt" ]] && grep -Fq 'p22-mail@example.test' "$EVIDENCE/smtp-session.txt" && break
  sleep 1
done
grep -Fq 'p22-mail@example.test' "$EVIDENCE/smtp-session.txt" || die "SMTP message was not delivered"
printf 'Installed SMTP transport + mail worker: PASS\n' | tee "$EVIDENCE/mail.txt"

note "G13 Cloudflare Turnstile production Siteverify path"
# Cloudflare's official always-pass test credentials are intentionally used only
# inside this ephemeral Fresh Install Gate. The application still calls the
# production Siteverify endpoint because TURNSTILE_VERIFY_URL is unset.
TURNSTILE_SITE='1x00000000000000000000AA'
TURNSTILE_SECRET='1x0000000000000000000000000000000AA'
TURNSTILE_TOKEN='XXXX.DUMMY.TOKEN.XXXX'
curl -fsS -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"turnstile.enabled\":true,\"turnstile.site_key\":\"$TURNSTILE_SITE\",\"turnstile.secret\":\"$TURNSTILE_SECRET\",\"turnstile.fail_open\":false,\"turnstile.allowed_hostnames\":[],\"turnstile.registration\":true}" \
  "$API_BASE/api/admin/bot-protection" >/dev/null
public_turnstile=$(curl -fsS "$API_BASE/api/public/turnstile")
jq -e --arg key "$TURNSTILE_SITE" '.enabled==true and .site_key==$key' <<<"$public_turnstile" >/dev/null
suffix=$(date +%s)
register_code=$(curl -sS -o "$EVIDENCE/turnstile-register.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"turnstile-$suffix@example.test\",\"display_name\":\"P22 Turnstile\",\"password\":\"TurnstileP22!2026\",\"turnstile_token\":\"$TURNSTILE_TOKEN\"}" \
  "$API_BASE/api/auth/register")
[[ "$register_code" == 201 ]] || { cat "$EVIDENCE/turnstile-register.json" >&2; die "Turnstile-protected registration returned $register_code"; }
printf 'Cloudflare production Siteverify endpoint + official dummy credential flow: PASS\n' | tee "$EVIDENCE/turnstile.txt"

note "G13 outward OAuth provider TLS reachability"
for url in \
  https://www.facebook.com/dialog/oauth \
  https://graph.qq.com/oauth2.0/authorize \
  https://open.weixin.qq.com/connect/qrconnect
do
  code=$(curl -L -sS -o /dev/null --connect-timeout 10 --max-time 20 -w '%{http_code}' "$url" || true)
  [[ "$code" =~ ^(2|3|4)[0-9][0-9]$ ]] || die "OAuth provider endpoint unreachable: $url ($code)"
  printf '%s %s\n' "$code" "$url" >>"$EVIDENCE/oauth-reachability.txt"
done

note "Write P22 evidence summary"
cat >"$EVIDENCE/summary.txt" <<EOF
P22 Fresh Install Candidate: PASS
tested_sha=$TESTED_SHA
G12=PASS
G13=PASS
artifact=gojet-v5-native-linux-amd64-$TESTED_SHA
runtime=Nginx + PHP 8.3 + MySQL 8.x + authenticated Redis + systemd + ClamAV
validated=8-service-restart,nginx-restart,mysql-redis-reconnect,eicar,qr,file,pdf,mail,oauth,turnstile,payment
EOF
cat "$EVIDENCE/summary.txt"
