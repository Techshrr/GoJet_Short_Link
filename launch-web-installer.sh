#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
[[ $(id -u) -eq 0 ]] || { echo '请使用 sudo ./launch-web-installer.sh'; exit 1; }
command -v nginx >/dev/null && command -v php >/dev/null || { echo '需要 Nginx 和 PHP 8.3'; exit 1; }
TOKEN=$(openssl rand -hex 24)
SOCKET=''
for candidate in /tmp/php-cgi-83.sock /run/php/php8.3-fpm.sock /www/server/php/83/var/run/php-fpm.sock; do
  [[ -S "$candidate" ]] && { SOCKET=$candidate; break; }
done
if [[ -z "$SOCKET" ]]; then SOCKET=$(find /run/php /www/server/php/83/var/run -type s \( -name '*8.3*fpm*.sock' -o -name 'php-fpm.sock' \) 2>/dev/null | head -1 || true); fi
[[ -n "$SOCKET" ]] || { echo '未找到 PHP 8.3 FPM socket，请确认 PHP-FPM 已启动'; exit 1; }
WEB_USER=$(stat -c '%U' "$SOCKET")
INSTALL_DIR="$ROOT/deploy/native"
install -d -o "$WEB_USER" -g "$WEB_USER" -m 0700 "$INSTALL_DIR"
printf '%s' "$TOKEN" > "$INSTALL_DIR/.installer-token"
chown "$WEB_USER:$WEB_USER" "$INSTALL_DIR/.installer-token"; chmod 0600 "$INSTALL_DIR/.installer-token"
if [[ -d /www/server/panel/vhost/nginx ]]; then NGINX_DROPIN=/www/server/panel/vhost/nginx; else NGINX_DROPIN=/etc/nginx/conf.d; fi
[[ -d "$NGINX_DROPIN" ]] || { echo '找不到 Nginx 虚拟主机配置目录'; exit 1; }
CONF="$NGINX_DROPIN/gojet-installer.conf"
reload_nginx(){ systemctl reload nginx 2>/dev/null || nginx -s reload; }
cleanup(){ rm -f "$CONF" "$INSTALL_DIR/.installer-token" "$INSTALL_DIR/.install-request"; nginx -t >/dev/null 2>&1 && reload_nginx || true; }
trap cleanup EXIT INT TERM
sed -e "s|__GOJET_ROOT__|$ROOT|g" -e "s|__PHP_FPM_SOCKET__|$SOCKET|g" "$ROOT/deploy/nginx/gojet-installer.conf" > "$CONF"
nginx -t && reload_nginx
IP=$(hostname -I | awk '{print $1}')
printf '\n请在浏览器打开： http://%s:18088/?token=%s\n配置完成前请保持此窗口运行（最长 30 分钟）。\n\n' "$IP" "$TOKEN"
for _ in $(seq 1 1800); do
  if [[ -f "$INSTALL_DIR/.install-request" ]]; then
    requested=$(cat "$INSTALL_DIR/.install-request")
    [[ "$requested" == "$TOKEN" ]] || { sleep 1; continue; }
    rm -f "$INSTALL_DIR/.install-request"
    "$ROOT/install-native-lemp.sh"
    printf '\n安装完成。临时安装页面已关闭。\n'
    exit 0
  fi
  sleep 1
done
echo '安装页面等待超时，请重新运行启动器。' >&2
exit 1
