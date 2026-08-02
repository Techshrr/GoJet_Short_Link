#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${GOJET_RELEASE_VERSION:-4.0.0}"
STAMP="${GOJET_RELEASE_STAMP:-$(date -u +%Y%m%d)}"
DIST="${DIST_DIR:-$ROOT/dist}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$ROOT"

if [[ "${SKIP_VALIDATION:-0}" != "1" ]]; then
  bash scripts/validate-release.sh
fi

test -f vendor/autoload.php || { echo 'vendor/ is required for the production package.' >&2; exit 1; }
test -f public/build/manifest.json || { echo 'public/build is required for the production package.' >&2; exit 1; }
test -x bin/gojet-redirector || { echo 'bin/gojet-redirector is required for the production package.' >&2; exit 1; }

rm -rf "$DIST"
mkdir -p "$DIST" "$WORK/source" "$WORK/production"

common_excludes=(
  --exclude='.git/' --exclude='.env' --exclude='.env.*.local' --exclude='node_modules/'
  --exclude='dist/' --exclude='storage/logs/*' --exclude='storage/framework/cache/data/*'
  --exclude='storage/framework/sessions/*' --exclude='storage/framework/views/*'
)

rsync -a "${common_excludes[@]}" --exclude='vendor/' --exclude='public/build/' --exclude='bin/gojet-redirector' ./ "$WORK/source/"
# Keep tests, CI definitions, and the redirect-plane source in the install archive.
# They are part of the acceptance evidence and make every shipped binary auditable
# and reproducible. Runtime-only dependencies remain present in this flavor.
rsync -a "${common_excludes[@]}" ./ "$WORK/production/"

commit="$(git rev-parse --short=12 HEAD 2>/dev/null || echo uncommitted)"
binary_sha="$(sha256sum bin/gojet-redirector | awk '{print $1}')"
for flavor in source production; do
  count="$(find "$WORK/$flavor" -type f | wc -l | tr -d ' ')"
  cat > "$WORK/$flavor/RELEASE-MANIFEST.txt" <<MANIFEST
GoJet V4
Version: $VERSION
Build stamp: $STAMP
Source commit: $commit
Package flavor: $flavor
File count: $count
Go redirector SHA-256: $binary_sha
Generated UTC: $(date -u +%Y-%m-%dT%H:%M:%SZ)
MANIFEST
done

source_zip="$DIST/GOJET-V4-SOURCE-${VERSION}-${STAMP}.zip"
production_zip="$DIST/GOJET-V4-PRODUCTION-${VERSION}-${STAMP}.zip"
(
  cd "$WORK/source"
  zip -q -9 -r "$source_zip" .
)
(
  cd "$WORK/production"
  zip -q -9 -r "$production_zip" .
)

unzip -tq "$source_zip" >/dev/null
unzip -tq "$production_zip" >/dev/null
sha256sum "$source_zip" "$production_zip" > "$DIST/SHA256SUMS.txt"
cp docs/VALIDATION_REPORT.md "$DIST/VALIDATION-REPORT.md"
cp docs/ACCEPTANCE_CHECKLIST.md "$DIST/ACCEPTANCE-CHECKLIST.md"

printf 'Created:\n%s\n%s\n%s\n' "$source_zip" "$production_zip" "$DIST/SHA256SUMS.txt"
