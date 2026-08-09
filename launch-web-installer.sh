#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
printf '%s\n' 'RC4 的 token + :18088 临时安装入口已停用。'
printf '%s\n' '正在切换到 GoJet 标准 /install/ 安装流程。'
exec "$ROOT/install.sh" "$@"
