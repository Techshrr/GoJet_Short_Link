#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="${1:-}"

if [[ -z "$BACKUP" || ! -d "$BACKUP" ]]; then
  echo "Usage: $0 /absolute/path/to/gojet-backup" >&2
  exit 64
fi

test -f "$BACKUP/composer.lock" || { echo "Backup does not look like a GoJet release." >&2; exit 65; }
test -f "$ROOT/artisan" || { echo "Current directory does not look like GoJet." >&2; exit 65; }

echo "Rollback is intentionally non-destructive by default."
echo "Validated backup: $BACKUP"
echo "Restore application files and the matching database backup during a maintenance window."
echo "See docs/UPGRADE_AND_BACKUP.md for the exact procedure."
exit 2
