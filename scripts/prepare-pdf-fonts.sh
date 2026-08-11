#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DEST=${PDF_FONT_DIR:-$ROOT/resources/fonts}
FONT="$DEST/NotoSansSC-VF.ttf"
LICENSE="$DEST/OFL.txt"
NOTO_COMMIT='f8d157532fbfaeda587e826d4cd5b21a49186f7c'
FONT_BLOB='5371a543be5fc670c7cdee9760c03554ee3e9b8e'
LICENSE_BLOB='d952d62c065f3f35fb83a173496e90b21525aef3'
FONT_SIZE='17773132'
FONT_URL="https://raw.githubusercontent.com/notofonts/noto-cjk/$NOTO_COMMIT/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf"
LICENSE_URL="https://raw.githubusercontent.com/notofonts/noto-cjk/$NOTO_COMMIT/Sans/LICENSE"

for tool in curl git stat; do
  command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required to prepare PDF fonts" >&2; exit 1; }
done
mkdir -p "$DEST"

verify_blob(){
  local file=$1 expected=$2 label=$3
  [[ -s "$file" ]] || return 1
  local actual
  actual=$(git hash-object --no-filters "$file")
  [[ "$actual" == "$expected" ]] || { echo "$label integrity check failed: expected $expected got $actual" >&2; return 1; }
}

download_verified(){
  local url=$1 target=$2 expected=$3 label=$4
  if verify_blob "$target" "$expected" "$label"; then return 0; fi
  rm -f "$target"
  local tmp="$target.download"
  rm -f "$tmp"
  curl --fail --location --silent --show-error --retry 4 --retry-all-errors --connect-timeout 15 --max-time 180 "$url" -o "$tmp"
  verify_blob "$tmp" "$expected" "$label" || { rm -f "$tmp"; exit 1; }
  mv -f "$tmp" "$target"
}

download_verified "$FONT_URL" "$FONT" "$FONT_BLOB" 'Noto Sans SC font'
[[ "$(stat -c %s "$FONT")" == "$FONT_SIZE" ]] || { echo "unexpected Noto Sans SC font size" >&2; exit 1; }
# TrueType/OpenType sfnt magic: 00 01 00 00 or 'true'. This pinned file uses 00 01 00 00.
[[ "$(od -An -tx1 -N4 "$FONT" | tr -d ' \n')" == '00010000' ]] || { echo 'downloaded PDF font is not a TrueType sfnt file' >&2; exit 1; }
download_verified "$LICENSE_URL" "$LICENSE" "$LICENSE_BLOB" 'Noto Sans CJK license'
chmod 0644 "$FONT" "$LICENSE"
printf 'PDF font resources ready: %s\n' "$FONT"
