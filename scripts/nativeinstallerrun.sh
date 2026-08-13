#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
BOOT="$ROOT/deploy/native/bootstrap.env"
STATE="$ROOT/storage/installer"
REQUEST="$STATE/request.ready"
LOCK="$ROOT/deploy/native/installed.lock"
SERVICES=(logreceiver redirectengine platformapi analyticsworker analyticsreconciler mailworker fileworker operationsmonitor)
LEGACY_SERVICES=(log-receiver redirect-engine platform-api analytics-worker analytics-reconciler mail-worker file-worker operations-monitor)

[[ $(id -u) -eq 0 ]] || { echo 'root required' >&2; exit 1; }
[[ -f "$BOOT" ]] || { echo 'bootstrap.env missing' >&2; exit 1; }
# shellcheck disable=SC1090
source "$BOOT"

write_failure(){
  local message=$1
  mkdir -p "$STATE"
  local tmp="$STATE/status.json.tmp"
  "$php" -r '$m=$argv[1];echo json_encode(["phase"=>"failed","progress"=>100,"message"=>$m,"result"=>"failed","updated_at"=>gmdate("c")],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);' "$message" > "$tmp"
  chown "$web_user:$web_group" "$tmp" 2>/dev/null || true
  chmod 0640 "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$STATE/status.json"
}

stop_existing_services(){
  local service
  for service in "${SERVICES[@]}"; do
    systemctl disable --now "gojet@$service.service" >/dev/null 2>&1 || true
  done
  for service in "${LEGACY_SERVICES[@]}"; do
    systemctl disable --now "gojet@$service.service" >/dev/null 2>&1 || true
  done
}

reenable_installer_path(){
  systemctl enable --now gojetinstaller.path >/dev/null 2>&1 || true
}

preflight_reserved_ports(){
  command -v ss >/dev/null 2>&1 || {
    write_failure '安装前端口检查失败：系统缺少 ss 命令（iproute2）'
    return 1
  }

  local port line owner
  for port in 18080 18090 18092; do
    line=$(ss -H -lntp 2>/dev/null | awk -v suffix=":$port" '$4 ~ (suffix "$" ) {print; exit}')
    if [[ -n "$line" ]]; then
      owner=$(printf '%s' "$line" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')
      write_failure "GoJet 保留端口 $port 已被占用：$owner。请停止冲突进程或服务后重试。"
      return 1
    fi
  done
}

preflight_empty_database(){
  [[ -f "$REQUEST" ]] || return 0
  declare -A request_cfg
  local line key encoded
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* ]] || continue
    key=${line%%=*}
    encoded=${line#*=}
    case "$key" in
      MYSQL_PORT|MYSQL_DATABASE|MYSQL_USER|MYSQL_PASSWORD)
        request_cfg[$key]=$(printf '%s' "$encoded" | base64 -d 2>/dev/null) || {
          write_failure "安装请求字段 $key 无效"
          return 1
        }
        ;;
    esac
  done < "$REQUEST"

  for key in MYSQL_PORT MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD; do
    if [[ -z "${request_cfg[$key]:-}" ]]; then
      write_failure "缺少安装参数：$key"
      return 1
    fi
  done
  [[ "${request_cfg[MYSQL_DATABASE]}" =~ ^[A-Za-z0-9_]+$ ]] || {
    write_failure '数据库名只能包含字母、数字和下划线'
    return 1
  }

  local existing
  existing=$(MYSQL_PWD="${request_cfg[MYSQL_PASSWORD]}" "$mysql" -N -s \
    -h 127.0.0.1 -P "${request_cfg[MYSQL_PORT]}" -u "${request_cfg[MYSQL_USER]}" \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${request_cfg[MYSQL_DATABASE]}'" 2>/dev/null) || {
      return 0
    }
  if [[ "$existing" != "0" ]]; then
    write_failure "全新安装要求使用空数据库；当前数据库已存在 $existing 个数据表。请在宝塔中新建空数据库后重试。"
    return 1
  fi
}

verify_current_runtime(){
  local service pid exe expected
  for service in "${SERVICES[@]}"; do
    systemctl is-active --quiet "gojet@$service.service" || {
      write_failure "安装后运行时校验失败：$service 未运行"
      return 1
    }
    pid=$(systemctl show "gojet@$service.service" -p MainPID --value)
    [[ "$pid" =~ ^[1-9][0-9]*$ ]] || {
      write_failure "安装后运行时校验失败：$service 没有有效 PID"
      return 1
    }
    exe=$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)
    expected="$ROOT/bin/$service"
    if [[ "$exe" != "$expected" ]]; then
      write_failure "安装后运行时校验失败：$service 实际运行 $exe，期望 $expected"
      return 1
    fi
  done
}

verify_fresh_admin(){
  [[ -f "$ROOT/deploy/native/gojet.env" ]] || {
    write_failure '安装后管理员校验失败：gojet.env 不存在'
    return 1
  }
  # shellcheck disable=SC1091
  set -a
  source "$ROOT/deploy/native/gojet.env"
  set +a

  local row_count admin_row
  row_count=$(MYSQL_PWD="$MYSQL_PASSWORD" "$mysql" -N -s -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" \
    -e 'SELECT COUNT(*) FROM administrators' 2>/dev/null) || {
      write_failure '安装后管理员校验失败：无法读取 administrators'
      return 1
    }
  [[ "$row_count" == "1" ]] || {
    write_failure "安装后管理员校验失败：应只有 1 名初始超级管理员，实际为 $row_count"
    return 1
  }
  admin_row=$(MYSQL_PWD="$MYSQL_PASSWORD" "$mysql" -N -s -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" \
    -e 'SELECT email,role,status,totp_enabled FROM administrators LIMIT 1' 2>/dev/null) || {
      write_failure '安装后管理员校验失败：无法读取初始超级管理员'
      return 1
    }
  local actual_email actual_role actual_status actual_totp
  IFS=$'\t' read -r actual_email actual_role actual_status actual_totp <<< "$admin_row"
  if [[ "${actual_email,,}" != "${ADMIN_BOOTSTRAP_EMAIL,,}" || "$actual_role" != 'super_admin' || "$actual_status" != 'active' || "$actual_totp" != '0' ]]; then
    write_failure '安装后管理员校验失败：初始管理员状态不符合 Fresh Install 约束'
    return 1
  fi
}

if [[ -f "$LOCK" ]]; then
  exec "$ROOT/scripts/nativeinstallerapply.sh"
fi

if ! preflight_empty_database; then
  exit 1
fi

stop_existing_services

if ! preflight_reserved_ports; then
  reenable_installer_path
  exit 1
fi

set +e
"$ROOT/scripts/nativeinstallerapply.sh"
helper_rc=$?
set -e
if [[ "$helper_rc" -ne 0 ]]; then
  # The canonical helper normally leaves the path active on failure. Re-enable
  # defensively so the browser can resubmit after correcting the cause.
  reenable_installer_path
  exit "$helper_rc"
fi

if ! verify_current_runtime || ! verify_fresh_admin; then
  rm -f "$LOCK"
  stop_existing_services
  reenable_installer_path
  exit 1
fi

exit 0
