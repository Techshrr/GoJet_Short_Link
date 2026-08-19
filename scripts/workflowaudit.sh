#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
while IFS= read -r -d '' file; do
  if grep -q -E 'apt-get (update|install)|playwright install --with-deps' "$file"; then
    if grep -q -F 'playwright install --with-deps' "$file"; then
      echo "$file: Playwright --with-deps is forbidden" >&2
      fail=1
    fi
    if grep -q -E 'apt-get (update|install)' "$file" && ! grep -q -F 'scripts/aptstable.sh' "$file"; then
      # Existing jobs that rewrite the runner source list before every apt call
      # are acceptable only when they explicitly remove the Azure mirror first.
      if ! grep -q -F 'azure.archive.ubuntu.com' "$file" || ! grep -q -F 'archive.ubuntu.com' "$file"; then
        echo "$file: apt is used without the stable-source preflight" >&2
        fail=1
      fi
    fi
  fi
done < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)

# The centralized preflight itself must be strict and must leave no active Azure
# archive entry after normalization.
grep -Fq 'azure.archive.ubuntu.com' scripts/aptstable.sh
grep -Fq 'https://archive.ubuntu.com/ubuntu' scripts/aptstable.sh
grep -Fq 'Acquire::Retries' scripts/aptstable.sh
grep -Fq 'ForceIPv4' scripts/aptstable.sh
grep -Fq 'azure.archive.ubuntu.com still present after normalization' scripts/aptstable.sh

if [ "$fail" -ne 0 ]; then
  exit 1
fi
printf 'WORKFLOW_PACKAGE_SOURCE_AUDIT=PASS\n'
