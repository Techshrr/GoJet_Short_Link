#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[[ -f packagelock.json ]] || { echo "packagelock.json is missing" >&2; exit 1; }
cp packagelock.json package-lock.json
cleanup(){ rm -f package-lock.json; }
trap cleanup EXIT
npm ci "$@"
