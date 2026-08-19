#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
BOOT="$ROOT/deploy/native/bootstrap.env"
STATE="$ROOT/storage/installer"
REQUEST="$STATE/request.ready"
PROCESSING="$STATE/request.processing"
LOCK="$ROOT/deploy/native/installed.lock"
REWRITE=""
REWRITE_BACKUP=""
REWRITE_EXISTED=0
NGINX_CHANGED=0
SERVICES=(logreceiver redirectengine platformapi analyticsworker analyticsreconciler mailworker fileworker operationsmonitor)
[[ $(id -u) -eq 0 ]] || { echo 'root required' >&2; exit 1; }
[[ -f "$BOOT" ]] || { echo 'bootstrap.env missing' >&2; exit 1; }
# bootstrap.env is generated only by root-owned install.sh and contains no user input.
# shellcheck disable=SC1090
source "$BOOT"

status(){
  local phase=$1 progress=$2 message=$3 result=${4:-running}
  local tmp="$STATE/status.json.tmp"
  "$php" -r '$p=$argv[1];$n=(int)$argv[2];$m=$argv[3];$r=$argv[4];echo json_encode(["phase"=>$p,"progress"=>$n,"message"=>$m,"result"=>$r,"updated_at"=>gmdate("c")],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);' "$phase" "$progress" "$message" "$result" > "$tmp"
  chown "$web_user:$web_group" "$tmp"
  chmod 0640 "$tmp"
  mv -f "$tmp" "$STATE/status.json"
}
fail(){
  local msg=$1
  set +e
  for service in "${SERVICES[@]}"; do
    systemctl stop "gojet@$service.service" >/dev/null 2>&1 || true
  done
  if [[ "$NGINX_CHANGED" -eq 1 && -n "$REWRITE" ]]; then
    if [[ "$REWRITE_EXISTED" -eq 1 && -f "$REWRITE_BACKUP" ]]; then
      cp -a "$REWRITE_BACKUP" "$REWRITE"
    else
      rm -f "$REWRITE"
    fi
    "$nginx" -t >/dev/null 2>&1 && (systemctl reload nginx >/dev/null 2>&1 || "$nginx" -s reload >/dev/null 2>&1) || true
  fi
  set -e
  status failed 100 "$msg" failed
  rm -f "$PROCESSING"
  exit 1
}
trap 'rc=$?; if [[ $rc -ne 0 && -f "$PROCESSING" ]]; then fail "安装执行失败（exit $rc），请查看 journalctl -u gojetinstaller.service"; fi' EXIT

[[ ! -f "$LOCK" ]] || { rm -f "$REQUEST"; exit 0; }
[[ -f "$REQUEST" ]] || exit 0
mv -f "$REQUEST" "$PROCESSING"
chmod 0600 "$PROCESSING"
status validate 5 '正在验证安装请求'

declare -A cfg
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -n "$line" ]] || continue
  [[ "$line" == *=* ]] || fail '安装请求格式无效'
  key=${line%%=*}
  encoded=${line#*=}
  case "$key" in
    MYSQL_PORT|MYSQL_DATABASE|MYSQL_USER|MYSQL_PASSWORD|REDIS_HOST|REDIS_PORT|REDIS_USERNAME|REDIS_PASSWORD|PUBLIC_BASE_URL|ADMIN_EMAIL|ADMIN_PASSWORD|ALERT_EMAIL)
      cfg[$key]=$(printf '%s' "$encoded" | base64 -d 2>/dev/null) || fail "安装请求字段 $key 无效" ;;
    *) fail "安装请求包含未知字段：$key" ;;
  esac
done < "$PROCESSING"

for key in MYSQL_PORT MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD REDIS_HOST REDIS_PORT PUBLIC_BASE_URL ADMIN_EMAIL ADMIN_PASSWORD; do
  [[ -n "${cfg[$key]:-}" ]] || fail "缺少安装参数：$key"
done
[[ "${cfg[MYSQL_PORT]}" =~ ^[0-9]{1,5}$ ]] && (( cfg[MYSQL_PORT] >= 1 && cfg[MYSQL_PORT] <= 65535 )) || fail 'MySQL 端口无效'
[[ "${cfg[REDIS_PORT]}" =~ ^[0-9]{1,5}$ ]] && (( cfg[REDIS_PORT] >= 1 && cfg[REDIS_PORT] <= 65535 )) || fail 'Redis 端口无效'
[[ "${cfg[MYSQL_DATABASE]}" =~ ^[A-Za-z0-9_]+$ ]] || fail '数据库名只能包含字母、数字和下划线'
[[ "${cfg[MYSQL_USER]}" =~ ^[A-Za-z0-9_.-]+$ ]] || fail '数据库用户名格式无效'
[[ "${cfg[PUBLIC_BASE_URL]}" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]] || fail '正式网址必须为 HTTPS 根地址'
[[ "${cfg[ADMIN_EMAIL]}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail '管理员邮箱格式无效'
if [[ -n "${cfg[ALERT_EMAIL]:-}" ]]; then
  [[ "${cfg[ALERT_EMAIL]}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail '告警邮箱格式无效'
fi
admin_password=${cfg[ADMIN_PASSWORD]}
mysql_password=${cfg[MYSQL_PASSWORD]}
redis_host=${cfg[REDIS_HOST]:-127.0.0.1}
redis_username=${cfg[REDIS_USERNAME]-}
redis_password=${cfg[REDIS_PASSWORD]-}
[[ ${#admin_password} -ge 12 && ${#admin_password} -le 256 ]] || fail '管理员密码长度必须为 12-256 位'
[[ ${#mysql_password} -le 512 && ${#redis_username} -le 256 && ${#redis_password} -le 512 ]] || fail '数据库或 Redis 认证参数过长'
for key in MYSQL_PASSWORD REDIS_HOST REDIS_USERNAME REDIS_PASSWORD ADMIN_PASSWORD ADMIN_EMAIL ALERT_EMAIL; do
  value=${cfg[$key]:-}
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || fail "安装参数 $key 包含非法控制字符"
done
[[ "$redis_host" != *[[:space:]]* ]] || fail 'Redis 地址格式无效'
HOST=${cfg[PUBLIC_BASE_URL]#https://}
HOST=${HOST%/}
HTTPS_PORT=443
if [[ "$HOST" == *:* ]]; then
  HTTPS_PORT=${HOST##*:}
  HOST=${HOST%%:*}
fi

status database 15 '正在验证 MySQL 连接与权限'
MYSQL_HOST=127.0.0.1
MYSQL_PWD="${cfg[MYSQL_PASSWORD]}" "$mysql" -N -s -h "$MYSQL_HOST" -P "${cfg[MYSQL_PORT]}" -u "${cfg[MYSQL_USER]}" "${cfg[MYSQL_DATABASE]}" -e 'SELECT VERSION()' > "$STATE/mysql-version.txt" 2>/dev/null || fail '无法使用所填数据库用户连接 MySQL；请在宝塔中先创建数据库和用户'
mysql_version=$(tr -d '\r\n' < "$STATE/mysql-version.txt")
[[ "$mysql_version" == 8.* ]] || fail "需要 MySQL 8.x，当前为 $mysql_version"
MYSQL_PWD="${cfg[MYSQL_PASSWORD]}" "$mysql" -h "$MYSQL_HOST" -P "${cfg[MYSQL_PORT]}" -u "${cfg[MYSQL_USER]}" "${cfg[MYSQL_DATABASE]}" -e "CREATE TABLE IF NOT EXISTS schema_migrations(name VARCHAR(255) PRIMARY KEY,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)" 2>/dev/null || fail '数据库用户缺少建表权限'

status database 27 '正在执行数据库迁移'
MYSQL_HOST="$MYSQL_HOST" MYSQL_PORT="${cfg[MYSQL_PORT]}" MYSQL_USER="${cfg[MYSQL_USER]}" MYSQL_PASSWORD="${cfg[MYSQL_PASSWORD]}" MYSQL_DATABASE="${cfg[MYSQL_DATABASE]}" MYSQL_BIN="$mysql" "$ROOT/scripts/runmigrations.sh" || fail '数据库迁移失败'

status redis 38 '正在验证 Redis'
is_loopback_redis_host(){
  local h=${1#[}
  h=${h%]}
  case "${h,,}" in localhost|::1|127.*) return 0;; *) return 1;; esac
}
[[ -z "$redis_username" || -n "$redis_password" ]] || fail 'Redis ACL 用户名已填写时必须同时填写密码'
if ! is_loopback_redis_host "$redis_host" && [[ -z "$redis_password" ]]; then
  fail '远程 Redis 不允许无认证连接；请配置密码或 ACL 用户名/密码'
fi
redis_args=(-h "$redis_host" -p "${cfg[REDIS_PORT]}")
[[ -z "$redis_username" ]] || redis_args+=(--user "$redis_username")
if [[ -n "$redis_password" ]]; then
  REDISCLI_AUTH="$redis_password" "$redis_cli" "${redis_args[@]}" ping 2>/dev/null | grep -qx PONG || fail 'Redis 认证连接失败；请检查地址、端口、用户名和密码'
else
  "$redis_cli" "${redis_args[@]}" ping 2>/dev/null | grep -qx PONG || fail '本机 Redis 连接失败；如 Redis 已启用认证请填写密码或 ACL 用户名/密码'
fi

status secrets 45 '正在生成系统安全密钥'
SETTINGS_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
VISITOR_HASH_KEY=$(openssl rand -hex 32)
QR_TRACKING_KEY=$(openssl rand -hex 32)
LOG_TOKEN=$(openssl rand -hex 32)
MYSQL_DSN="${cfg[MYSQL_USER]}:${cfg[MYSQL_PASSWORD]}@tcp(127.0.0.1:${cfg[MYSQL_PORT]})/${cfg[MYSQL_DATABASE]}?parseTime=true&charset=utf8mb4"
ALERT_EMAIL=${cfg[ALERT_EMAIL]:-${cfg[ADMIN_EMAIL]}}
CLAMAV_ADDRESS='disabled'
if [[ -S /run/clamav/clamd.ctl ]] && systemctl is-active --quiet clamav-daemon.service; then
  CLAMAV_ADDRESS='unix:///run/clamav/clamd.ctl'
fi

envq(){
  local v=$1
  v=${v//\\/\\\\}
  v=${v//\"/\\\"}
  printf '"%s"' "$v"
}
ENV_FILE="$ROOT/deploy/native/gojet.env"
{
  printf '# Generated by GoJet standard web installer. Do not edit while services are running.\n'
  printf 'MYSQL_HOST=%s\n' "$(envq '127.0.0.1')"
  printf 'MYSQL_PORT=%s\n' "$(envq "${cfg[MYSQL_PORT]}")"
  printf 'MYSQL_DATABASE=%s\n' "$(envq "${cfg[MYSQL_DATABASE]}")"
  printf 'MYSQL_USER=%s\n' "$(envq "${cfg[MYSQL_USER]}")"
  printf 'MYSQL_PASSWORD=%s\n' "$(envq "${cfg[MYSQL_PASSWORD]}")"
  printf 'MYSQL_DSN=%s\n' "$(envq "$MYSQL_DSN")"
  printf 'REDIS_ADDRESS=%s\n' "$(envq "${redis_host}:${cfg[REDIS_PORT]}")"
  printf 'REDIS_USERNAME=%s\n' "$(envq "$redis_username")"
  printf 'REDIS_PASSWORD=%s\n' "$(envq "$redis_password")"
  printf 'SETTINGS_ENCRYPTION_KEY=%s\n' "$(envq "$SETTINGS_ENCRYPTION_KEY")"
  printf 'ADMIN_BOOTSTRAP_EMAIL=%s\n' "$(envq "${cfg[ADMIN_EMAIL]}")"
  printf 'ADMIN_BOOTSTRAP_PASSWORD=%s\n' "$(envq "${cfg[ADMIN_PASSWORD]}")"
  printf 'PUBLIC_BASE_URL=%s\n' "$(envq "${cfg[PUBLIC_BASE_URL]%/}")"
  printf 'VISITOR_HASH_KEY=%s\n' "$(envq "$VISITOR_HASH_KEY")"
  printf 'QR_TRACKING_KEY=%s\n' "$(envq "$QR_TRACKING_KEY")"
  printf 'LOG_INGEST_TOKEN=%s\n' "$(envq "$LOG_TOKEN")"
  printf 'LOG_WEBHOOK_TOKEN=%s\n' "$(envq "$LOG_TOKEN")"
  printf 'LOG_WEBHOOK_URL=%s\n' "$(envq 'http://127.0.0.1:18092/v1/logs')"
  printf 'PLATFORM_HTTP_ADDRESS=%s\n' "$(envq '127.0.0.1:18090')"
  printf 'HTTP_ADDRESS=%s\n' "$(envq '127.0.0.1:18080')"
  printf 'LOG_RECEIVER_HTTP_ADDRESS=%s\n' "$(envq '127.0.0.1:18092')"
  printf 'UPLOAD_STORAGE_PATH=%s\n' "$(envq "$ROOT/deploy/data/uploads")"
  printf 'BRAND_ASSET_PATH=%s\n' "$(envq "$ROOT/deploy/data/brand")"
  printf 'GENERATED_QR_STORAGE_PATH=%s\n' "$(envq "$ROOT/deploy/data/generated/qr")"
  printf 'FILE_STORAGE_PATH=%s\n' "$(envq "$ROOT/deploy/data/files")"
  printf 'FILE_STORAGE_DRIVER=%s\n' "$(envq 'filesystem')"
  printf 'CLAMAV_ADDRESS=%s\n' "$(envq "$CLAMAV_ADDRESS")"
  printf 'ANALYTICS_GROUP=%s\n' "$(envq 'gojet-mysql')"
  printf 'ANALYTICS_CONSUMER=%s\n' "$(envq 'native-worker-1')"
  printf 'ANALYTICS_BATCH_SIZE=%s\n' "$(envq '100')"
  printf 'ANALYTICS_RECONCILE_BATCH=%s\n' "$(envq '500')"
  printf 'ANALYTICS_RECONCILE_INTERVAL_SECONDS=%s\n' "$(envq '60')"
  printf 'OPERATIONS_MONITOR_INTERVAL_SECONDS=%s\n' "$(envq '60')"
  printf 'ALERT_RECIPIENT=%s\n' "$(envq "$ALERT_EMAIL")"
} > "$ENV_FILE"
chmod 0600 "$ENV_FILE"

status services 58 '正在创建 GoJet 系统用户和服务'
id gojet >/dev/null 2>&1 || useradd --system --home-dir "$ROOT" --shell /usr/sbin/nologin gojet
if getent group clamav >/dev/null 2>&1; then
  usermod -aG clamav gojet || true
fi
mkdir -p "$ROOT/deploy/data/uploads" "$ROOT/deploy/data/brand" "$ROOT/deploy/data/generated/qr" "$ROOT/deploy/data/files"
chown -R gojet:gojet "$ROOT/deploy/data"
chmod 0755 "$ROOT/deploy/data" "$ROOT/deploy/data/uploads" "$ROOT/deploy/data/brand" "$ROOT/deploy/data/generated" "$ROOT/deploy/data/generated/qr"
chmod 0750 "$ROOT/deploy/data/files"
chmod 0755 "$ROOT" "$ROOT/bin" "$ROOT/public"
sed "s|__GOJET_ROOT__|$ROOT|g" "$ROOT/deploy/native/gojet@.service" > /etc/systemd/system/gojet@.service
systemctl daemon-reload

status nginx 68 '正在配置宝塔 Nginx 路由'
if [[ -d /www/server/panel/vhost/nginx && -f "/www/server/panel/vhost/nginx/$HOST.conf" ]]; then
  VHOST="/www/server/panel/vhost/nginx/$HOST.conf"
  REWRITE_DIR=/www/server/panel/vhost/rewrite
  REWRITE="$REWRITE_DIR/$HOST.conf"
  REWRITE_BACKUP="$REWRITE.gojet-preinstall.bak"
  mkdir -p "$REWRITE_DIR"
  grep -Fq "root $ROOT/public;" "$VHOST" || fail "宝塔站点运行目录尚未设置为 /public（期望 root $ROOT/public;）"
  grep -Fq "$REWRITE" "$VHOST" || fail '宝塔站点配置未包含标准 rewrite 文件，安装器为避免破坏 SSL 配置已停止'
  if [[ -f "$REWRITE" ]]; then
    REWRITE_EXISTED=1
    [[ -f "$REWRITE_BACKUP" ]] || cp -a "$REWRITE" "$REWRITE_BACKUP"
  fi
  sed "s|__GOJET_ROOT__|$ROOT|g" "$ROOT/deploy/nginx/gojetbtrewrite.conf" > "$REWRITE"
  NGINX_CHANGED=1
else
  fail "未找到宝塔站点配置 /www/server/panel/vhost/nginx/$HOST.conf；当前 Native 安装优先支持宝塔"
fi
"$nginx" -t || fail 'Nginx 配置验证失败，已恢复安装前 rewrite'
systemctl reload nginx 2>/dev/null || "$nginx" -s reload

status nginx 72 '正在验证后台静态资源路由'
PUBLIC_ORIGIN=${cfg[PUBLIC_BASE_URL]%/}
CURL_LOCAL=(curl --noproxy '*' -kfsS --resolve "$HOST:$HTTPS_PORT:127.0.0.1")
admin_html=$(mktemp)
"${CURL_LOCAL[@]}" "$PUBLIC_ORIGIN/admin/" > "$admin_html" || fail '管理员 V5 SPA 入口无法读取；已恢复安装前 rewrite'
grep -Fq '<div id="root"></div>' "$admin_html" || fail '管理员 V5 SPA root mount 缺失；已恢复安装前 rewrite'
admin_asset=$(grep -oE '/admin/assets/[^" ]+\.js' "$admin_html" | head -n1 || true)
[[ -n "$admin_asset" ]] || fail '管理员 V5 hashed JavaScript 资产引用缺失；已恢复安装前 rewrite'
"${CURL_LOCAL[@]}" "$PUBLIC_ORIGIN$admin_asset" >/dev/null || fail '管理员 V5 hashed JavaScript 无法读取；已恢复安装前 rewrite'
rm -f "$admin_html"

status services 76 '正在启动 8 个 GoJet 服务'
for service in "${SERVICES[@]}"; do
  systemctl enable --now "gojet@$service.service" || fail "服务启动失败：$service"
done

status health 88 '正在执行服务健康检查'
for service in "${SERVICES[@]}"; do
  systemctl is-active --quiet "gojet@$service.service" || fail "服务未保持运行：$service"
done
for _ in {1..45}; do
  if curl -fsS http://127.0.0.1:18080/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:18090/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:18092/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl -fsS http://127.0.0.1:18080/health >/dev/null || fail 'redirectengine 健康检查失败'
curl -fsS http://127.0.0.1:18090/health >/dev/null || fail 'platformapi 健康检查失败'
curl -fsS http://127.0.0.1:18092/health >/dev/null || fail 'logreceiver 健康检查失败'

status finalize 96 '正在锁定安装入口'
version=$(cat "$ROOT/VERSION" 2>/dev/null || echo development)
installation_id=$(openssl rand -hex 16)
printf 'version=%s\ninstalled_at=%s\ninstallation_id=%s\nmysql_schema=%s\nclamav=%s\n' \
  "$version" "$(date -u +%FT%TZ)" "$installation_id" \
  "$(tail -n 1 "$ROOT/database/migrations/migrationcatalog.txt")" "${CLAMAV_ADDRESS:-unavailable}" > "$LOCK"
chmod 0644 "$LOCK"
rm -f "$PROCESSING" "$STATE/mysql-version.txt"
status complete 100 'GoJet 安装完成，核心服务和后台静态资源均已通过健康检查' success
systemctl disable --now gojetinstaller.path >/dev/null 2>&1 || true
trap - EXIT
