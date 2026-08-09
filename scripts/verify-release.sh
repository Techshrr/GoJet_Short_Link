#!/usr/bin/env sh
set -eu
[ "$#" -eq 1 ] || { echo "usage: $0 <gojet-production.zip>" >&2; exit 2; }
ARCHIVE=$1
[ -f "$ARCHIVE" ] || { echo "archive not found: $ARCHIVE" >&2; exit 1; }
for tool in unzip sha256sum; do command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }; done
unzip -tq "$ARCHIVE" >/dev/null
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT INT TERM
unzip -q "$ARCHIVE" -d "$TMP"
ROOT=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)
[ -n "$ROOT" ] || { echo "release root is missing" >&2; exit 1; }
for path in INSTALL.md VERSION MANIFEST.sha256 install.sh install-host-nginx.sh install-native-lemp.sh launch-web-installer.sh installer/index.php scripts/verify-published-release.sh upgrade.sh rollback.sh deploy/compose.production.yaml deploy/compose.host-nginx.yaml deploy/.env.production.example deploy/nginx/gojet.conf deploy/nginx/gojet-host.conf deploy/nginx/gojet-native.conf deploy/nginx/gojet-installer.conf deploy/native/gojet.env.example deploy/native/gojet@.service database/migrations app frontend services go.mod go.sum; do
  [ -e "$ROOT/$path" ] || { echo "release is missing $path" >&2; exit 1; }
done
for binary in redirect-engine analytics-worker analytics-reconciler platform-api mail-worker file-worker operations-monitor log-receiver; do
  [ -x "$ROOT/bin/$binary" ] || { echo "native executable is missing: bin/$binary" >&2; exit 1; }
done
for forbidden in .git node_modules tests test-results package.json playwright.config.js compose.yaml Makefile; do
  [ ! -e "$ROOT/$forbidden" ] || { echo "development artifact must not ship: $forbidden" >&2; exit 1; }
done
if find "$ROOT" -type f -name '*_test.go' | grep -q .; then echo "Go test sources must not ship" >&2; exit 1; fi
(cd "$ROOT" && sha256sum -c MANIFEST.sha256 >/dev/null)
actual=$(sed -n '/^services:$/,/^volumes:$/p' "$ROOT/deploy/compose.production.yaml" | sed -n 's/^  \([a-z][a-z0-9-]*\):$/\1/p' | sort | tr '\n' ' ')
expected='analytics-reconciler analytics-worker clamav file-worker log-receiver mail-worker mysql nginx operations-monitor platform-api redirect-engine redis '
[ "$actual" = "$expected" ] || { echo "production Compose service set is invalid: $actual" >&2; exit 1; }
printf 'release verification passed: %s\n' "$ARCHIVE"
