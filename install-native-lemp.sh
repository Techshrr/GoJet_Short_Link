#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
die(){ echo "GoJet native installer: $*" >&2; exit 1; }
require(){ command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }
[[ $(id -u) -eq 0 ]] || die "run as root: sudo ./install-native-lemp.sh"
case "$ROOT" in *' '*) die "installation path must not contain spaces";; esac
for tool in nginx php mysql redis-cli systemctl curl openssl; do require "$tool"; done
for binary in redirect-engine analytics-worker analytics-reconciler platform-api mail-worker file-worker operations-monitor log-receiver; do
 [[ -x "$ROOT/bin/$binary" ]] || die "release binary is missing or not executable: bin/$binary"
done
nginx -v 2>&1 | grep -Eq 'nginx/(1\.2[8-9]|1\.[3-9][0-9]|[2-9]\.)' || die "Nginx 1.28 or newer is required"
php -r 'exit(version_compare(PHP_VERSION,"8.3.0","ge")?0:1);' || die "PHP 8.3 or newer is required (PHP-FPM may coexist; GoJet does not execute PHP code)"
ENV_FILE="$ROOT/deploy/native/gojet.env"
[[ -f "$ENV_FILE" ]] || die "copy deploy/native/gojet.env.example to deploy/native/gojet.env and fill all values"
! grep -q 'replace-with-' "$ENV_FILE" || die "native environment still contains placeholders"
chmod 600 "$ENV_FILE"
sed -i "s|__GOJET_ROOT__|$ROOT|g" "$ENV_FILE"
set -a; source "$ENV_FILE"; set +a
[[ "$MYSQL_DATABASE" =~ ^[A-Za-z0-9_]+$ && "$MYSQL_USER" =~ ^[A-Za-z0-9_]+$ ]] || die "MySQL database and user names may only contain letters, digits, and underscore"
[[ "$MYSQL_PASSWORD" != *"'"* && "$MYSQL_ADMIN_PASSWORD" != *"'"* ]] || die "MySQL passwords must not contain a single quote"
[[ "$PUBLIC_BASE_URL" == https://* ]] || die "PUBLIC_BASE_URL must use https://"
GOJET_SERVER_NAME=${PUBLIC_BASE_URL#https://}; GOJET_SERVER_NAME=${GOJET_SERVER_NAME%%/*}; GOJET_SERVER_NAME=${GOJET_SERVER_NAME%%:*}
[[ "$GOJET_SERVER_NAME" =~ ^[A-Za-z0-9.-]+$ ]] || die "PUBLIC_BASE_URL contains an invalid hostname"
[[ "$MYSQL_DSN" == *"$MYSQL_PASSWORD"* ]] || die "MYSQL_DSN and MYSQL_PASSWORD do not match"
[[ ${#SETTINGS_ENCRYPTION_KEY} -gt 20 ]] || die "SETTINGS_ENCRYPTION_KEY is invalid"
printf '%s' "$SETTINGS_ENCRYPTION_KEY" | openssl base64 -d -A 2>/dev/null | wc -c | grep -qx 32 || die "SETTINGS_ENCRYPTION_KEY must decode to 32 bytes"
[[ "$LOG_INGEST_TOKEN" == "$LOG_WEBHOOK_TOKEN" ]] || die "log tokens must match"
redis-cli -h "${REDIS_ADDRESS%:*}" -p "${REDIS_ADDRESS##*:}" -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q PONG || die "Redis is unavailable"
mysql_version=$(MYSQL_PWD="$MYSQL_ADMIN_PASSWORD" mysql -N -s -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_ADMIN_USER" -e 'SELECT VERSION()')
[[ "$mysql_version" == 8.0.* ]] || die "MySQL 8.0 is required; server reported $mysql_version"
MYSQL_PWD="$MYSQL_ADMIN_PASSWORD" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_ADMIN_USER" -e "CREATE DATABASE IF NOT EXISTS \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS '$MYSQL_USER'@'127.0.0.1' IDENTIFIED BY '$MYSQL_PASSWORD'; ALTER USER '$MYSQL_USER'@'127.0.0.1' IDENTIFIED BY '$MYSQL_PASSWORD'; GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '$MYSQL_USER'@'127.0.0.1'; FLUSH PRIVILEGES;"
MYSQL_PWD="$MYSQL_PASSWORD" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "CREATE TABLE IF NOT EXISTS schema_migrations(name VARCHAR(255) PRIMARY KEY,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
for migration in "$ROOT"/database/migrations/*.sql; do
 name=$(basename "$migration")
 applied=$(MYSQL_PWD="$MYSQL_PASSWORD" mysql -N -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM schema_migrations WHERE name='$name'")
 if [[ "$applied" == 0 ]]; then MYSQL_PWD="$MYSQL_PASSWORD" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" < "$migration"; MYSQL_PWD="$MYSQL_PASSWORD" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "INSERT INTO schema_migrations(name) VALUES('$name')"; fi
done
# MySQL 管理员密码只用于建库和迁移，运行期不保留。
sed -i 's/^MYSQL_ADMIN_PASSWORD=.*/MYSQL_ADMIN_PASSWORD=""/' "$ENV_FILE"
id gojet >/dev/null 2>&1 || useradd --system --home-dir "$ROOT" --shell /usr/sbin/nologin gojet
mkdir -p "$ROOT/deploy/data/uploads" "$ROOT/deploy/data/files"
chown -R gojet:gojet "$ROOT/deploy/data"; chmod 0755 "$ROOT/deploy/data/uploads"; chmod 0750 "$ROOT/deploy/data/files"
chmod 0755 "$ROOT" "$ROOT/bin" "$ROOT/frontend" "$ROOT/frontend/marketing-site" "$ROOT/frontend/user-console" "$ROOT/frontend/admin-console"
sed "s|__GOJET_ROOT__|$ROOT|g" "$ROOT/deploy/native/gojet@.service" > /etc/systemd/system/gojet@.service
if [[ -d /www/server/panel/vhost/nginx ]]; then NGINX_DROPIN=/www/server/panel/vhost/nginx; else NGINX_DROPIN=/etc/nginx/conf.d; fi
[[ -d "$NGINX_DROPIN" ]] || die "Nginx virtual-host directory was not found"
sed -e "s|__GOJET_ROOT__|$ROOT|g" -e "s|__GOJET_SERVER_NAME__|$GOJET_SERVER_NAME|g" "$ROOT/deploy/nginx/gojet-native.conf" > "$NGINX_DROPIN/gojet.conf"
if [[ "$NGINX_DROPIN" == /etc/nginx/conf.d && -d /etc/nginx/sites-enabled ]]; then ln -sfn "$NGINX_DROPIN/gojet.conf" /etc/nginx/sites-enabled/gojet; fi
nginx -t
systemctl daemon-reload
services=(log-receiver redirect-engine platform-api analytics-worker analytics-reconciler mail-worker file-worker operations-monitor)
for service in "${services[@]}"; do systemctl enable --now "gojet@$service.service"; done
systemctl reload nginx 2>/dev/null || nginx -s reload
for _ in {1..60}; do curl -fsS http://127.0.0.1:18080/health >/dev/null && curl -fsS http://127.0.0.1:18090/health >/dev/null && break; sleep 2; done
curl -fsS http://127.0.0.1:18080/health >/dev/null; curl -fsS http://127.0.0.1:18090/health >/dev/null
printf 'GoJet native LEMP installation completed. PHP-FPM was detected but remains untouched.\n'
