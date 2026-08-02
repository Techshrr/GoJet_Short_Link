#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
VERSION=${1:-$(git -C "$ROOT" describe --always --dirty)}
NAME="GoJet-V4-Production-$VERSION"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT INT TERM
TARGET="$STAGE/$NAME"
mkdir -p "$TARGET/source" "$TARGET/database" "$TARGET/docker" "$TARGET/nginx" "$TARGET/scripts" "$TARGET/docs"

cp -R "$ROOT/app" "$ROOT/frontend" "$ROOT/services" "$TARGET/source/"
cp -R "$ROOT/tests" "$TARGET/source/"
cp "$ROOT/go.mod" "$ROOT/go.sum" "$ROOT/package.json" "$ROOT/package-lock.json" "$ROOT/playwright.config.js" "$TARGET/source/"
cp -R "$ROOT/database/." "$TARGET/database/"
cp "$ROOT/Dockerfile" "$ROOT/compose.yaml" "$ROOT/deploy/compose.production.yaml" "$TARGET/docker/"
cp -R "$ROOT/deploy/nginx/." "$TARGET/nginx/"
cp -R "$ROOT/scripts/." "$TARGET/scripts/"
cp -R "$ROOT/docs/." "$TARGET/docs/"
cp "$ROOT/install.sh" "$ROOT/upgrade.sh" "$ROOT/rollback.sh" "$ROOT/.env.example" "$ROOT/deploy/.env.production.example" "$ROOT/README.md" "$ROOT/LICENSE" "$TARGET/"
cp "$ROOT/Makefile" "$ROOT/package.json" "$ROOT/package-lock.json" "$ROOT/playwright.config.js" "$TARGET/"
cp -R "$ROOT/tests" "$TARGET/"

# Preserve the runnable repository layout used by the Compose build contexts.
cp -R "$ROOT/app" "$ROOT/frontend" "$ROOT/services" "$TARGET/"
cp "$ROOT/go.mod" "$ROOT/go.sum" "$ROOT/Dockerfile" "$ROOT/compose.yaml" "$TARGET/"
mkdir -p "$TARGET/deploy"
cp "$ROOT/deploy/compose.production.yaml" "$TARGET/deploy/"
cp -R "$ROOT/deploy/nginx" "$TARGET/deploy/"

find "$TARGET" -type f \( -name '.env' -o -name '.env.production' -o -name '*.log' \) -exec rm -f {} +
find "$TARGET" -type d -name '__pycache__' -prune -exec rm -rf {} +

mkdir -p "$ROOT/dist"
(cd "$STAGE" && zip -qr "$ROOT/dist/$NAME.zip" "$NAME")
sha256sum "$ROOT/dist/$NAME.zip" > "$ROOT/dist/$NAME.zip.sha256"
printf '%s\n' "$ROOT/dist/$NAME.zip"
