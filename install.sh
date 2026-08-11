#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
die(){ echo "GoJet installer bootstrap: $*" >&2; exit 1; }
[[ $(id -u) -eq 0 ]] || die "请使用 sudo ./install.sh"
case "$ROOT" in *' '*) die "安装路径不能包含空格";; esac

if [[ "${1:-}" == "--docker" ]]; then
  exec "$ROOT/scripts/install-docker.sh"
fi

find_cmd(){
  local name=$1; shift
  if command -v "$name" >/dev/null 2>&1; then command -v "$name"; return 0; fi
  local p
  for p in "$@"; do [[ -x "$p" ]] && { printf '%s\n' "$p"; return 0; }; done
  return 1
}

NGINX=$(find_cmd nginx /www/server/nginx/sbin/nginx) || die "未找到 Nginx"
PHP=$(find_cmd php /www/server/php/83/bin/php) || die "未找到 PHP 8.3 CLI"
MYSQL=$(find_cmd mysql /www/server/mysql/bin/mysql) || die "未找到 MySQL 客户端"
REDIS_CLI=$(find_cmd redis-cli /www/server/redis/src/redis-cli /usr/local/bin/redis-cli) || die "未找到 redis-cli"
command -v systemctl >/dev/null 2>&1 || die "需要 systemd/systemctl"
command -v openssl >/dev/null 2>&1 || die "需要 openssl"
command -v base64 >/dev/null 2>&1 || die "需要 base64"
command -v curl >/dev/null 2>&1 || die "需要 curl"

"$PHP" -r 'exit(version_compare(PHP_VERSION,"8.3.0",">=")?0:1);' || die "PHP 8.3 或更高版本才受支持"
REQUIRED_PHP_EXTENSIONS=(pdo_mysql openssl session filter json hash)
missing_php_extensions=()
for extension in "${REQUIRED_PHP_EXTENSIONS[@]}"; do
  if ! "$PHP" -r 'exit(extension_loaded($argv[1])?0:1);' "$extension"; then
    missing_php_extensions+=("$extension")
  fi
done
if (( ${#missing_php_extensions[@]} > 0 )); then
  die "PHP 缺少必需扩展：${missing_php_extensions[*]}"
fi
[[ -f "$ROOT/public/install/index.php" ]] || die "发布包缺少 public/install/index.php"
for binary in redirect-engine analytics-worker analytics-reconciler platform-api mail-worker file-worker operations-monitor log-receiver; do
  [[ -x "$ROOT/bin/$binary" ]] || die "发布包缺少可执行文件 bin/$binary"
done

WEB_USER=''
for candidate in www www-data nginx; do
  if id "$candidate" >/dev/null 2>&1; then WEB_USER=$candidate; break; fi
done
[[ -n "$WEB_USER" ]] || die "未找到 Web/PHP-FPM 用户（www/www-data/nginx）"
WEB_GROUP=$(id -gn "$WEB_USER")

STATE="$ROOT/storage/installer"
install -d -o "$WEB_USER" -g "$WEB_GROUP" -m 0700 "$ROOT/storage" "$STATE"
rm -f "$STATE/request.ready" "$STATE/request.processing"
printf '%s\n' "root=$ROOT" "web_user=$WEB_USER" "web_group=$WEB_GROUP" "nginx=$NGINX" "php=$PHP" "mysql=$MYSQL" "redis_cli=$REDIS_CLI" > "$ROOT/deploy/native/bootstrap.env"
chmod 0600 "$ROOT/deploy/native/bootstrap.env"

sed "s|__GOJET_ROOT__|$ROOT|g" "$ROOT/deploy/native/gojet-installer.service" > /etc/systemd/system/gojet-installer.service
sed "s|__GOJET_ROOT__|$ROOT|g" "$ROOT/deploy/native/gojet-installer.path" > /etc/systemd/system/gojet-installer.path
systemctl daemon-reload
systemctl enable --now gojet-installer.path

touch "$STATE/bootstrap.ready"
chown "$WEB_USER:$WEB_GROUP" "$STATE/bootstrap.ready"
chmod 0600 "$STATE/bootstrap.ready"
rm -f "$STATE/clamav.ready"
if [[ -S /run/clamav/clamd.ctl ]] && systemctl is-active --quiet clamav-daemon.service; then
  printf '%s\n' 'unix:///run/clamav/clamd.ctl' > "$STATE/clamav.ready"
  chown "$WEB_USER:$WEB_GROUP" "$STATE/clamav.ready"
  chmod 0600 "$STATE/clamav.ready"
fi

SITE_HINT=$(basename "$ROOT")
printf '\nGoJet 标准安装入口已准备完成。\n\n'
printf '1. 宝塔网站目录：%s\n' "$ROOT"
printf '2. 宝塔运行目录：/public\n'
printf '3. PHP 版本：8.3\n'
printf '4. 为站点启用 HTTPS/SSL\n'
if [[ "$SITE_HINT" == *.* ]]; then
  printf '5. 浏览器访问：https://%s/install/\n\n' "$SITE_HINT"
else
  printf '5. 浏览器访问：https://你的域名/install/\n\n'
fi
printf '安装页不会要求 MySQL root 密码，也不会生成临时 token 或使用 18088 端口。\n'