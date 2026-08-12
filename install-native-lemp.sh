#!/usr/bin/env bash
set -euo pipefail
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
printf '%s\n' 'GoJet 已统一使用标准 Web 安装向导。'
printf '%s\n' '此兼容入口将继续执行标准安装引导。'
exec "$ROOT/install.sh" "$@"