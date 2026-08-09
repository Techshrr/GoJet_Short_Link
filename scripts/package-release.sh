#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
VERSION=${1:-$(git -C "$ROOT" describe --always)}
SAFE_VERSION=$(printf '%s' "$VERSION" | tr -c 'A-Za-z0-9._-' '-')
NAME="gojet-${SAFE_VERSION}-linux-production"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT INT TERM
TARGET="$STAGE/$NAME"

for tool in go zip sha256sum; do command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }; done
mkdir -p "$TARGET/app" "$TARGET/bin" "$TARGET/frontend" "$TARGET/installer" "$TARGET/services" "$TARGET/database/migrations" "$TARGET/deploy/nginx" "$TARGET/deploy/native" "$TARGET/scripts" "$TARGET/docs"

build() { (cd "$ROOT" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o "$TARGET/bin/$1" "$2"); }
build redirect-engine ./services/redirect-engine/cmd/server
build analytics-worker ./services/analytics-worker/cmd/worker
build analytics-reconciler ./services/analytics-reconciler/cmd/reconciler
build platform-api ./services/platform-api/cmd/server
build mail-worker ./services/platform-api/cmd/mail-worker
build file-worker ./services/platform-api/cmd/file-worker
build operations-monitor ./services/platform-api/cmd/operations-monitor
build log-receiver ./services/log-receiver/cmd/server

cp -R "$ROOT/app/." "$TARGET/app/"
cp -R "$ROOT/frontend/." "$TARGET/frontend/"
cp -R "$ROOT/installer/." "$TARGET/installer/"
cp -R "$ROOT/services/." "$TARGET/services/"
cp -R "$ROOT/database/migrations/." "$TARGET/database/migrations/"
cp "$ROOT/deploy/compose.production.yaml" "$TARGET/deploy/compose.production.yaml"
cp "$ROOT/deploy/compose.host-nginx.yaml" "$TARGET/deploy/compose.host-nginx.yaml"
cp "$ROOT/deploy/.env.production.example" "$TARGET/deploy/.env.production.example"
cp "$ROOT/deploy/nginx/gojet.conf" "$TARGET/deploy/nginx/gojet.conf"
cp "$ROOT/deploy/nginx/gojet-host.conf" "$TARGET/deploy/nginx/gojet-host.conf"
cp "$ROOT/deploy/nginx/gojet-native.conf" "$TARGET/deploy/nginx/gojet-native.conf"
cp "$ROOT/deploy/nginx/gojet-installer.conf" "$TARGET/deploy/nginx/gojet-installer.conf"
cp "$ROOT/deploy/native/gojet.env.example" "$ROOT/deploy/native/gojet@.service" "$TARGET/deploy/native/"
cp "$ROOT/scripts/lib.sh" "$ROOT/scripts/verify-release.sh" "$ROOT/scripts/verify-published-release.sh" "$TARGET/scripts/"
cp "$ROOT/docs/deployment.zh-CN.md" "$ROOT/docs/architecture.md" "$ROOT/docs/object-storage.zh-CN.md" "$ROOT/docs/operations-alerting.zh-CN.md" "$TARGET/docs/"
cp "$ROOT/go.mod" "$ROOT/go.sum" "$ROOT/Dockerfile" "$ROOT/install.sh" "$ROOT/install-host-nginx.sh" "$ROOT/install-native-lemp.sh" "$ROOT/launch-web-installer.sh" "$ROOT/upgrade.sh" "$ROOT/rollback.sh" "$ROOT/LICENSE" "$TARGET/"
cp "$ROOT/deploy/INSTALL.zh-CN.md" "$TARGET/INSTALL.md"
printf '%s\n' "$VERSION" > "$TARGET/VERSION"

chmod 0755 "$TARGET/install.sh" "$TARGET/install-host-nginx.sh" "$TARGET/install-native-lemp.sh" "$TARGET/launch-web-installer.sh" "$TARGET/upgrade.sh" "$TARGET/rollback.sh" "$TARGET/scripts/verify-release.sh" "$TARGET/scripts/verify-published-release.sh" "$TARGET"/bin/*
find "$TARGET" -type f \( -name '.env' -o -name '.env.production' -o -name '*.log' -o -name '*.tmp' \) -delete
find "$TARGET" -type f \( -name '*_test.go' -o -name '*_integration_test.go' \) -delete
find "$TARGET" -type d \( -name '.git' -o -name 'node_modules' -o -name 'test-results' -o -name 'tests' -o -name '__pycache__' \) -prune -exec rm -rf {} +

(cd "$TARGET" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/$NAME.zip" "$ROOT/dist/$NAME.zip.sha256"
(cd "$STAGE" && zip -q -r "$ROOT/dist/$NAME.zip" "$NAME")
(cd "$ROOT/dist" && sha256sum "$NAME.zip" > "$NAME.zip.sha256")
"$ROOT/scripts/verify-release.sh" "$ROOT/dist/$NAME.zip"
printf '%s\n' "$ROOT/dist/$NAME.zip"
