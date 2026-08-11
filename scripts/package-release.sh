#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
VERSION=${1:-$(git -C "$ROOT" describe --always)}
SAFE_VERSION=$(printf '%s' "$VERSION" | tr -c 'A-Za-z0-9._-' '-')
NAME="gojet-${SAFE_VERSION}-linux-production"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT INT TERM
TARGET="$STAGE/$NAME"

for tool in go zip sha256sum sed python3 curl git; do command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }; done
"$ROOT/scripts/prepare-pdf-fonts.sh"
mkdir -p "$TARGET/app" "$TARGET/bin" "$TARGET/frontend" "$TARGET/installer" "$TARGET/services" \
  "$TARGET/database/migrations" "$TARGET/deploy/nginx" "$TARGET/deploy/native" "$TARGET/scripts" "$TARGET/docs" \
  "$TARGET/public" "$TARGET/public/assets" "$TARGET/public/app" "$TARGET/public/admin" "$TARGET/public/install" "$TARGET/storage/installer" \
  "$TARGET/resources/fonts"

build() { (cd "$ROOT" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o "$TARGET/bin/$1" "$2"); }
build redirect-engine ./services/redirect-engine/cmd/server
build analytics-worker ./services/analytics-worker/cmd/worker
build analytics-reconciler ./services/analytics-reconciler/cmd/reconciler
build platform-api ./services/platform-api/cmd/server
build mail-worker ./services/platform-api/cmd/mail-worker
build file-worker ./services/platform-api/cmd/file-worker
build operations-monitor ./services/platform-api/cmd/operations-monitor
build log-receiver ./services/log-receiver/cmd/server

python3 "$ROOT/scripts/rebuild-public-product-pages.py"
python3 "$ROOT/scripts/rebuild-marketing-pages.py"

cp -R "$ROOT/app/." "$TARGET/app/"
cp -R "$ROOT/frontend/." "$TARGET/frontend/"
cp -R "$ROOT/installer/." "$TARGET/installer/"
cp -R "$ROOT/services/." "$TARGET/services/"
cp -R "$ROOT/database/migrations/." "$TARGET/database/migrations/"
cp "$ROOT/resources/fonts/NotoSansSC-VF.ttf" "$TARGET/resources/fonts/NotoSansSC-VF.ttf"
cp "$ROOT/resources/fonts/OFL.txt" "$TARGET/resources/fonts/OFL.txt"

cp -R "$ROOT/frontend/marketing-site/." "$TARGET/public/"
cp -R "$ROOT/frontend/user-console/." "$TARGET/public/app/"
cp -R "$ROOT/frontend/admin-console/." "$TARGET/public/admin/"
cp "$ROOT/frontend/shared/gojet-design-system.css" "$TARGET/public/assets/gojet-design-system.css"
cp "$ROOT/public/install/index.php" "$TARGET/public/install/index.php"

find "$TARGET/public" -type f -name '*.html' -exec sed -E -i "s#((src|href)=['\"][^'\"?#]+\.(css|js))(\?[^'\"]*)?(['\"])#\1?v=$SAFE_VERSION\5#g" {} \;

cp "$ROOT/deploy/compose.production.yaml" "$TARGET/deploy/compose.production.yaml"
cp "$ROOT/deploy/compose.host-nginx.yaml" "$TARGET/deploy/compose.host-nginx.yaml"
cp "$ROOT/deploy/.env.production.example" "$TARGET/deploy/.env.production.example"
cp "$ROOT/deploy/nginx/gojet.conf" "$TARGET/deploy/nginx/gojet.conf"
cp "$ROOT/deploy/nginx/gojet-host.conf" "$TARGET/deploy/nginx/gojet-host.conf"
cp "$ROOT/deploy/nginx/gojet-native.conf" "$TARGET/deploy/nginx/gojet-native.conf"
cp "$ROOT/deploy/nginx/gojet-bt-rewrite.conf" "$TARGET/deploy/nginx/gojet-bt-rewrite.conf"
cp "$ROOT/deploy/native/gojet.env.example" "$ROOT/deploy/native/gojet@.service" \
   "$ROOT/deploy/native/gojet-installer.service" "$ROOT/deploy/native/gojet-installer.path" "$TARGET/deploy/native/"
cp "$ROOT/scripts/lib.sh" "$ROOT/scripts/verify-release.sh" "$ROOT/scripts/verify-hardening-release.sh" "$ROOT/scripts/verify-published-release.sh" \
   "$ROOT/scripts/native-installer-run.sh" "$ROOT/scripts/native-installer-apply.sh" "$ROOT/scripts/install-docker.sh" "$TARGET/scripts/"
cp "$ROOT/docs/deployment.zh-CN.md" "$ROOT/docs/architecture.md" "$ROOT/docs/object-storage.zh-CN.md" \
   "$ROOT/docs/operations-alerting.zh-CN.md" "$ROOT/docs/v4-product-rebuild.zh-CN.md" "$ROOT/docs/V4_PRODUCT_HARDENING_AUDIT.md" "$TARGET/docs/"
cp "$ROOT/go.mod" "$ROOT/go.sum" "$ROOT/Dockerfile" "$ROOT/install.sh" "$ROOT/install-host-nginx.sh" \
   "$ROOT/install-native-lemp.sh" "$ROOT/launch-web-installer.sh" "$ROOT/LICENSE" "$TARGET/"
cp "$ROOT/deploy/INSTALL.zh-CN.md" "$TARGET/INSTALL.md"
printf '%s\n' "$VERSION" > "$TARGET/VERSION"
printf '%s\n' 'FRESH_INSTALL_ONLY=1' > "$TARGET/FRESH_INSTALL_ONLY"

chmod 0755 "$TARGET/install.sh" "$TARGET/install-host-nginx.sh" "$TARGET/install-native-lemp.sh" "$TARGET/launch-web-installer.sh" \
  "$TARGET/scripts/verify-release.sh" "$TARGET/scripts/verify-hardening-release.sh" "$TARGET/scripts/verify-published-release.sh" "$TARGET/scripts/native-installer-run.sh" \
  "$TARGET/scripts/native-installer-apply.sh" "$TARGET/scripts/install-docker.sh" "$TARGET"/bin/*
find "$TARGET" -type f \( -name '.env' -o -name '.env.production' -o -name '*.log' -o -name '*.tmp' \) -delete
find "$TARGET" -type f \( -name '*_test.go' -o -name '*_integration_test.go' \) -delete
find "$TARGET" -type d \( -name '.git' -o -name 'node_modules' -o -name 'test-results' -o -name 'tests' -o -name '__pycache__' \) -prune -exec rm -rf {} +

test -s "$TARGET/resources/fonts/NotoSansSC-VF.ttf" || { echo 'PDF Unicode font missing from production package' >&2; exit 1; }
test -s "$TARGET/resources/fonts/OFL.txt" || { echo 'PDF font license missing from production package' >&2; exit 1; }

(cd "$TARGET" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/$NAME.zip" "$ROOT/dist/$NAME.zip.sha256"
(cd "$STAGE" && zip -q -r "$ROOT/dist/$NAME.zip" "$NAME")
(cd "$ROOT/dist" && sha256sum "$NAME.zip" > "$NAME.zip.sha256")
"$ROOT/scripts/verify-release.sh" "$ROOT/dist/$NAME.zip"
printf '%s\n' "$ROOT/dist/$NAME.zip"
