#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DATA_DIR="$ROOT/deploy/data/geoip"
TARGET="$DATA_DIR/city.mmdb"
SOURCE_INFO="$DATA_DIR/source.txt"

fail(){ printf 'GoJet GeoIP: %s\n' "$*" >&2; exit 1; }
for cmd in curl gzip date tail grep stat; do
  command -v "$cmd" >/dev/null 2>&1 || fail "缺少必需命令：$cmd"
done

mkdir -p "$DATA_DIR"
chmod 0755 "$DATA_DIR"

valid_mmdb(){
  local file=$1 size
  [[ -s "$file" ]] || return 1
  size=$(stat -c '%s' "$file" 2>/dev/null || echo 0)
  (( size > 5000000 )) || return 1
  tail -c 131072 "$file" 2>/dev/null | grep -aFq 'MaxMind.com'
}

if valid_mmdb "$TARGET"; then
  printf '✅ GeoIP 城市数据库已存在：%s\n' "$TARGET"
  exit 0
fi

current=$(date -u +%Y-%m)
previous=$(date -u -d '1 month ago' +%Y-%m 2>/dev/null || true)
older=$(date -u -d '2 months ago' +%Y-%m 2>/dev/null || true)
releases=("$current")
[[ -n "$previous" && "$previous" != "$current" ]] && releases+=("$previous")
[[ -n "$older" && "$older" != "$current" && "$older" != "$previous" ]] && releases+=("$older")

tmp_gz="$DATA_DIR/.city.mmdb.gz.$$"
tmp_db="$DATA_DIR/.city.mmdb.$$"
cleanup(){ rm -f "$tmp_gz" "$tmp_db"; }
trap cleanup EXIT

selected=''
for release in "${releases[@]}"; do
  url="https://download.db-ip.com/free/dbip-city-lite-${release}.mmdb.gz"
  printf '正在下载 DB-IP City Lite %s（用于国家/地区/城市访问分析）…\n' "$release"
  if curl -fL --retry 3 --retry-delay 2 --connect-timeout 15 --max-time 1200 -o "$tmp_gz" "$url"; then
    if gzip -t "$tmp_gz" >/dev/null 2>&1 && gzip -dc "$tmp_gz" > "$tmp_db" && valid_mmdb "$tmp_db"; then
      selected="$release"
      break
    fi
  fi
  rm -f "$tmp_gz" "$tmp_db"
done

[[ -n "$selected" ]] || fail '无法下载或校验 DB-IP City Lite MMDB。为避免安装完成后访问地区全部显示未知，GoJet 已停止安装；请确认服务器可访问 download.db-ip.com 后重试。'

mv -f "$tmp_db" "$TARGET"
chmod 0644 "$TARGET"
cat > "$SOURCE_INFO" <<EOF
provider=DB-IP City Lite
release=$selected
source=https://db-ip.com/db/download/ip-to-city-lite
license=Creative Commons Attribution 4.0 International (CC BY 4.0)
attribution=IP Geolocation by DB-IP (https://db-ip.com)
installed_at=$(date -u +%FT%TZ)
EOF
chmod 0644 "$SOURCE_INFO"
rm -f "$tmp_gz"
trap - EXIT
printf '✅ GeoIP 城市数据库已安装：DB-IP City Lite %s\n' "$selected"
