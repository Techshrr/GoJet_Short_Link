#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

canonical='frontend/admin-console/settings.js'
core='frontend/admin-console/app.js'
index='frontend/admin-console/index.html'

test -f "$canonical"
test -f "$core"
test -f "$index"

grep -Fq 'renderSettings=async function(){' "$canonical"
grep -Fq 'async function saveUnifiedSection(' "$canonical"

for legacy in \
  'function settingInput(' \
  'async function renderSettings(' \
  'async function saveSettingForm(' \
  'async function saveBrand(' \
  'async function deleteBrand('
do
  if grep -Fq "$legacy" "$core"; then
    echo "administrator settings implementation leaked back into app.js: $legacy" >&2
    exit 1
  fi
done

app_line=$(grep -n '<script src="/admin/app.js"></script>' "$index" | cut -d: -f1)
settings_line=$(grep -n '<script src="/admin/settings.js"></script>' "$index" | cut -d: -f1)
test -n "$app_line" -a -n "$settings_line"
test "$app_line" -lt "$settings_line"

printf 'administrator settings single-owner source contract: PASS\n'
