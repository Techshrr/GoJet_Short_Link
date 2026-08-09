#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
printf '%s\n' 'GoJet RC4 的直接 Native 安装方式已经停用。'
printf '%s\n' '现在使用标准 /install/ Web 安装向导；此兼容入口将执行 install.sh。'
exec "$ROOT/install.sh" "$@"
