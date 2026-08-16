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

read_generated_env(){
  local file=$1
  declare -n output=$2
  local line key raw decoded i ch next length

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" && "$line" != '#'* ]] || continue
    [[ "$line" == *=* ]] || return 1
    key=${line%%=*}
    case "$key" in
      MYSQL_HOST|MYSQL_PORT|MYSQL_DATABASE|MYSQL_USER|MYSQL_PASSWORD|ADMIN_BOOTSTRAP_EMAIL) ;;
      *) continue ;;
    esac
    raw=${line#*=}
    [[ ${#raw} -ge 2 && ${raw:0:1} == '"' && ${raw: -1} == '"' ]] || return 1
    raw=${raw:1:${#raw}-2}
    decoded=''
    length=${#raw}
    for ((i=0; i<length; i++)); do
      ch=${raw:i:1}
      if [[ "$ch" == "\\" ]]; then
        ((i+=1))
        (( i < length )) || return 1
        next=${raw:i:1}
        case "$next" in
          \\|\") decoded+="$next" ;;
          *) return 1 ;;
        esac
      else
        decoded+="$ch"
      fi
    done
    output["$key"]=$decoded
  done < "$file"
}

verify_fresh_admin(){
  local env_file="$ROOT/deploy/native/gojet.env"
  [[ -f "$env_file" ]] || {
    write_failure '安装后管理员校验失败：gojet.env 不存在'
    return 1
  }

  # gojet.env contains values supplied by the web installer. Never source it
  # into a root shell: parse only the generated quoted format without eval or
  # command substitution so $, backticks and similar password characters stay
  # literal during post-install verification.
  declare -A generated_env=()
  if ! read_generated_env "$env_file" generated_env; then
    write_failure '安装后管理员校验失败：gojet.env 格式无效'
    return 1
  fi
  local key
  for key in MYSQL_HOST MYSQL_PORT MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD ADMIN_BOOTSTRAP_EMAIL; do
    if [[ -z "${generated_env[$key]+present}" ]]; then
      write_failure "安装后管理员校验失败：gojet.env 缺少 $key"
      return 1
    fi
  done

  local row_count admin_row
  row_count=$(MYSQL_PWD="${generated_env[MYSQL_PASSWORD]}" "$mysql" -N -s \
    -h "${generated_env[MYSQL_HOST]}" -P "${generated_env[MYSQL_PORT]}" \
    -u "${generated_env[MYSQL_USER]}" "${generated_env[MYSQL_DATABASE]}" \
    -e 'SELECT COUNT(*) FROM administrators' 2>/dev/null) || {
      write_failure '安装后管理员校验失败：无法读取 administrators'
      return 1
    }
  [[ "$row_count" == "1" ]] || {
    write_failure "安装后管理员校验失败：应只有 1 名初始超级管理员，实际为 $row_count"
    return 1
  }
  admin_row=$(MYSQL_PWD="${generated_env[MYSQL_PASSWORD]}" "$mysql" -N -s \
    -h "${generated_env[MYSQL_HOST]}" -P "${generated_env[MYSQL_PORT]}" \
    -u "${generated_env[MYSQL_USER]}" "${generated_env[MYSQL_DATABASE]}" \
    -e 'SELECT email,role,status,totp_enabled FROM administrators LIMIT 1' 2>/dev/null) || {
      write_failure '安装后管理员校验失败：无法读取初始超级管理员'
      return 1
    }
  local actual_email actual_role actual_status actual_totp
  IFS=$'\t' read -r actual_email actual_role actual_status actual_totp <<< "$admin_row"
  if [[ "${actual_email,,}" != "${generated_env[ADMIN_BOOTSTRAP_EMAIL],,}" || "$actual_role" != 'super_admin' || "$actual_status" != 'active' || "$actual_totp" != '0' ]]; then
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