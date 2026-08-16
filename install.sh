#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
die(){ echo "GoJet installer bootstrap: $*" >&2; exit 1; }
[[ $(id -u) -eq 0 ]] || die "请使用 sudo ./install.sh"
case "$ROOT" in *' '*) die "安装路径不能包含空格";; esac

if [[ "${1:-}" == "--docker" ]]; then
  exec "$ROOT/scripts/installdocker.sh"
fi

find_cmd(){
  local name=$1; shift
  local p
  for p in "$@"; do [[ -x "$p" ]] && { printf '%s\n' "$p"; return 0; }; done
  if command -v "$name" >/dev/null 2>&1; then command -v "$name"; return 0; fi
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
command -v gzip >/dev/null 2>&1 || die "需要 gzip"

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
for binary in redirectengine analyticsworker analyticsreconciler platformapi mailworker fileworker operationsmonitor logreceiver; do
  [[ -x "$ROOT/bin/$binary" ]] || die "发布包缺少可执行文件 bin/$binary"
done
[[ -f "$ROOT/scripts/installgeoip.sh" ]] || die "发布包缺少 scripts/installgeoip.sh"

printf '正在准备访问分析 GeoIP 城市数据库…\n'
bash "$ROOT/scripts/installgeoip.sh" || die "GeoIP 城市数据库准备失败"

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

prepare_aapanel_installer_route(){
  local vhost_dir=/www/server/panel/vhost/nginx
  local rewrite_dir=/www/server/panel/vhost/rewrite
  local site_hint vhost='' rewrite='' candidate
  local matches=0
  local backup tmp
  local need_redirect=0 need_php=0

  [[ -d "$vhost_dir" ]] || return 0
  site_hint=$(basename "$ROOT")

  if [[ -f "$vhost_dir/$site_hint.conf" ]] && grep -Fq "root $ROOT/public;" "$vhost_dir/$site_hint.conf"; then
    vhost="$vhost_dir/$site_hint.conf"
  else
    shopt -s nullglob
    for candidate in "$vhost_dir"/*.conf; do
      grep -Fq "root $ROOT/public;" "$candidate" || continue
      vhost="$candidate"
      ((matches+=1))
    done
    shopt -u nullglob
    (( matches <= 1 )) || die "检测到多个宝塔站点使用 $ROOT/public，无法安全确定安装入口所属站点"
  fi

  [[ -n "$vhost" ]] || return 0
  rewrite=$(sed -n 's|^[[:space:]]*include[[:space:]]\+\(/www/server/panel/vhost/rewrite/[^;]*\.conf\);.*|\1|p' "$vhost" | head -n1)
  [[ -n "$rewrite" ]] || die "宝塔站点未包含标准 rewrite 文件，无法安全开放 /install/"
  [[ "$rewrite" == "$rewrite_dir/"*.conf ]] || die "宝塔 rewrite 路径异常：$rewrite"

  install -d -m 0755 "$rewrite_dir"
  touch "$rewrite"

  if ! grep -Fq 'location = /install { return 302 /install/; }' "$rewrite"; then
    if grep -Eq 'location[[:space:]]*=[[:space:]]*/install[[:space:]]*\{' "$rewrite"; then
      die "宝塔 rewrite 已存在非标准 /install 路由，请先检查 $rewrite"
    fi
    need_redirect=1
  fi
  if ! grep -Fq 'location = /install/ { rewrite ^ /install/index.php last; }' "$rewrite"; then
    if grep -Eq 'location[[:space:]]*=[[:space:]]*/install/[[:space:]]*\{' "$rewrite"; then
      die "宝塔 rewrite 已存在非标准 /install/ 路由，请先检查 $rewrite"
    fi
    need_php=1
  fi

  (( need_redirect == 1 || need_php == 1 )) || return 0

  backup="$STATE/aapanel-rewrite.bootstrap.bak"
  tmp="$rewrite.gojet-bootstrap.$$"
  cp -a "$rewrite" "$backup"
  {
    printf '# GoJet installer bootstrap route. Runtime install will replace the complete GoJet rewrite.\n'
    if (( need_redirect == 1 )); then
      printf 'location = /install { return 302 /install/; }\n'
    fi
    if (( need_php == 1 )); then
      printf 'location = /install/ { rewrite ^ /install/index.php last; }\n'
    fi
    cat "$rewrite"
  } > "$tmp"
  cat "$tmp" > "$rewrite"
  rm -f "$tmp"

  if ! "$NGINX" -t; then
    cp -a "$backup" "$rewrite"
    "$NGINX" -t >/dev/null 2>&1 || true
    die "为安装页保留 PHP-FPM 路由后 Nginx 校验失败，已恢复原 rewrite"
  fi
  "$NGINX" -s reload
  sleep 1
  rm -f "$backup"
  printf '✅ 已为宝塔站点预留 /install/ PHP-FPM 安装路由\n'
}

prepare_aapanel_installer_route

sed "s|__GOJET_ROOT__|$ROOT|g" "$ROOT/deploy/native/gojetinstaller.service" > /etc/systemd/system/gojetinstaller.service
sed "s|__GOJET_ROOT__|$ROOT|g" "$ROOT/deploy/native/gojetinstaller.path" > /etc/systemd/system/gojetinstaller.path
systemctl daemon-reload
systemctl enable --now gojetinstaller.path

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