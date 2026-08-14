#!/usr/bin/env sh
set -eu
[ "$#" -eq 1 ] || { echo "usage: $0 <GoJetProduction.zip>" >&2; exit 2; }
ARCHIVE=$1
[ -f "$ARCHIVE" ] || { echo "archive not found: $ARCHIVE" >&2; exit 1; }
for tool in unzip sha256sum python3; do command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }; done
unzip -tq "$ARCHIVE" >/dev/null
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM
unzip -q "$ARCHIVE" -d "$TMP"
ROOT=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)
[ -n "$ROOT" ] || { echo 'release root is missing' >&2; exit 1; }
[ "$(grep -cve '^[[:space:]]*$' "$ROOT/database/migrations/migrationcatalog.txt")" -eq 44 ] || { echo 'migration catalog count is invalid' >&2; exit 1; }
[ "$(find "$ROOT/database/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l)" -eq 44 ] || { echo 'migration SQL count is invalid' >&2; exit 1; }
for migration in linkdestinationrisk.sql socialauth.sql socialsubjectwidth.sql; do
  grep -Fxq "$migration" "$ROOT/database/migrations/migrationcatalog.txt" || { echo "migration catalog is missing $migration" >&2; exit 1; }
done
for path in public/install/index.php public/install/install.css public/install/wizard.css public/install/install.js database/migrations/supportticketmessageip.sql database/migrations/officialshortdomains.sql database/migrations/emailauthcodes.sql database/migrations/mailinvoicepresentation.sql database/migrations/linkdestinationrisk.sql database/migrations/socialauth.sql database/migrations/socialsubjectwidth.sql; do
  [ -s "$ROOT/$path" ] || { echo "release is missing $path" >&2; exit 1; }
done
(cd "$ROOT" && sha256sum -c MANIFEST.sha256 >/dev/null)
printf 'fresh-install release verification passed: %s\n' "$ARCHIVE"
