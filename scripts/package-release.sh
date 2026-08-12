#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
VERSION=${1:-$(git -C "$ROOT" describe --always)}
SAFE_VERSION=$(printf '%s' "$VERSION" | tr -c 'A-Za-z0-9._-' '-')
NAME="gojet-${SAFE_VERSION}-linux-production"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT INT TERM
TARGET="$STAGE/$NAME"
PUBLIC_BUILD="$STAGE/public-build"
for tool in go zip sha256sum sed python3 curl git; do command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }; done
"$ROOT/scripts/prepare-pdf-fonts.sh"
python3 "$ROOT/scripts/build-public-site.py" --output "$PUBLIC_BUILD"
mkdir -p "$TARGET/bin" "$TARGET/installer" "$TARGET/database/migrations" "$TARGET/deploy/nginx" "$TARGET/deploy/native" "$TARGET/deploy/docker" "$TARGET/scripts" "$TARGET/docs" "$TARGET/public/app" "$TARGET/public/admin" "$TARGET/public/install" "$TARGET/storage/installer" "$TARGET/resources/fonts"
build() { (cd "$ROOT" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o "$TARGET/bin/$1" "$2"); }
build redirect-engine ./services/redirect-engine/cmd/server
build analytics-worker ./services/analytics-worker/cmd/worker
build analytics-reconciler ./services/analytics-reconciler/cmd/reconciler
build platform-api ./services/platform-api/cmd/server
build mail-worker ./services/platform-api/cmd/mail-worker
build file-worker ./services/platform-api/cmd/file-worker
build operations-monitor ./services/platform-api/cmd/operations-monitor
build log-receiver ./services/log-receiver/cmd/server
cp -R "$ROOT/installer/." "$TARGET/installer/"
cp -R "$ROOT/database/migrations/." "$TARGET/database/migrations/"
cp "$ROOT/resources/fonts/NotoSansSC-Regular.ttf" "$TARGET/resources/fonts/NotoSansSC-Regular.ttf"
cp "$ROOT/resources/fonts/OFL.txt" "$TARGET/resources/fonts/OFL.txt"
cp -R "$PUBLIC_BUILD/." "$TARGET/public/"
cp -R "$ROOT/frontend/user-console/." "$TARGET/public/app/"
cp -R "$ROOT/frontend/admin-console/." "$TARGET/public/admin/"
# Administrator settings have exactly one implementation owner. Do not allow a
# later release to silently reintroduce the legacy app.js implementation that
# used to be overridden only by script load order.
test -f "$TARGET/public/admin/settings.js" || { echo 'canonical administrator settings module is missing' >&2; exit 1; }
grep -Fq 'renderSettings=async function(){' "$TARGET/public/admin/settings.js" || { echo 'canonical administrator settings renderer is missing' >&2; exit 1; }
grep -Fq 'async function saveUnifiedSection(' "$TARGET/public/admin/settings.js" || { echo 'canonical administrator settings save contract is missing' >&2; exit 1; }
for legacy in 'function settingInput(' 'async function renderSettings(' 'async function saveSettingForm(' 'async function saveBrand(' 'async function deleteBrand('; do
  if grep -Fq "$legacy" "$TARGET/public/admin/app.js"; then
    echo "legacy administrator settings implementation leaked into production app.js: $legacy" >&2
    exit 1
  fi
done
cp "$ROOT/public/install/index.php" "$TARGET/public/install/index.php"
find "$TARGET/public" -type f -name '*.html' -exec sed -E -i "s#((src|href)=['\"][^'\"?#]+\.(css|js))(\?[^'\"]*)?(['\"])#\1?v=$SAFE_VERSION\5#g" {} \;
cp "$ROOT/deploy/compose.production.yaml" "$TARGET/deploy/compose.production.yaml"
cp "$ROOT/deploy/compose.host-nginx.yaml" "$TARGET/deploy/compose.host-nginx.yaml"
cp "$ROOT/deploy/.env.production.example" "$TARGET/deploy/.env.production.example"
cp "$ROOT/deploy/docker/service.Dockerfile" "$TARGET/deploy/docker/service.Dockerfile"
cp "$ROOT/deploy/docker/platform.Dockerfile" "$TARGET/deploy/docker/platform.Dockerfile"
cp "$ROOT/deploy/nginx/gojet.conf" "$TARGET/deploy/nginx/gojet.conf"
cp "$ROOT/deploy/nginx/gojet-host.conf" "$TARGET/deploy/nginx/gojet-host.conf"
cp "$ROOT/deploy/nginx/gojet-native.conf" "$TARGET/deploy/nginx/gojet-native.conf"
cp "$ROOT/deploy/nginx/gojet-bt-rewrite.conf" "$TARGET/deploy/nginx/gojet-bt-rewrite.conf"
cp "$ROOT/deploy/native/gojet.env.example" "$ROOT/deploy/native/gojet@.service" "$ROOT/deploy/native/gojet-installer.service" "$ROOT/deploy/native/gojet-installer.path" "$TARGET/deploy/native/"
cp "$ROOT/scripts/lib.sh" "$ROOT/scripts/verify-release.sh" "$ROOT/scripts/verify-published-release.sh" "$ROOT/scripts/native-installer-run.sh" "$ROOT/scripts/native-installer-apply.sh" "$ROOT/scripts/install-docker.sh" "$TARGET/scripts/"
cp "$ROOT/docs/deployment.zh-CN.md" "$ROOT/docs/architecture.md" "$ROOT/docs/object-storage.zh-CN.md" "$ROOT/docs/operations-alerting.zh-CN.md" "$TARGET/docs/"
cp "$ROOT/install.sh" "$ROOT/install-host-nginx.sh" "$ROOT/install-native-lemp.sh" "$ROOT/launch-web-installer.sh" "$ROOT/LICENSE" "$TARGET/"
cp "$ROOT/deploy/INSTALL.zh-CN.md" "$TARGET/INSTALL.md"
printf '%s\n' "$VERSION" > "$TARGET/VERSION"
printf '%s\n' 'FRESH_INSTALL_ONLY=1' > "$TARGET/FRESH_INSTALL_ONLY"
chmod 0755 "$TARGET/install.sh" "$TARGET/install-host-nginx.sh" "$TARGET/install-native-lemp.sh" "$TARGET/launch-web-installer.sh" "$TARGET/scripts/verify-release.sh" "$TARGET/scripts/verify-published-release.sh" "$TARGET/scripts/native-installer-run.sh" "$TARGET/scripts/native-installer-apply.sh" "$TARGET/scripts/install-docker.sh" "$TARGET"/bin/*
find "$TARGET" -type f \( -name '.env' -o -name '.env.production' -o -name '*.log' -o -name '*.tmp' \) -delete
find "$TARGET" -type d \( -name '.git' -o -name 'node_modules' -o -name 'test-results' -o -name 'tests' -o -name '__pycache__' \) -prune -exec rm -rf {} +
test -s "$TARGET/resources/fonts/NotoSansSC-Regular.ttf" || { echo 'PDF Unicode Regular font missing from production package' >&2; exit 1; }
test -s "$TARGET/resources/fonts/OFL.txt" || { echo 'PDF font license missing from production package' >&2; exit 1; }
for forbidden in app frontend services go.mod go.sum Dockerfile tests .github; do [ ! -e "$TARGET/$forbidden" ] || { echo "development artifact must not ship: $forbidden" >&2; exit 1; }; done
if find "$TARGET" -iname '*hardening*' -o -iname '*rc12*' | grep -q .; then echo 'engineering-stage filename leaked into production package' >&2; exit 1; fi
# The verifier contains the literal retired markers by definition. Scan the
# runtime/deployment payload, not the rule file that documents those markers.
if grep -R -n -E '/system-images/|SYSTEM_IMAGE_PATH|data/system/images|V4_PRODUCT_HARDENING|product-hardening|hardening-release' "$TARGET" --exclude=MANIFEST.sha256 --exclude=verify-release.sh; then echo 'retired engineering or system-image contract leaked into production package' >&2; exit 1; fi
(cd "$TARGET" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/$NAME.zip" "$ROOT/dist/$NAME.zip.sha256"
(cd "$STAGE" && zip -q -r "$ROOT/dist/$NAME.zip" "$NAME")
(cd "$ROOT/dist" && sha256sum "$NAME.zip" > "$NAME.zip.sha256")
"$ROOT/scripts/verify-release.sh" "$ROOT/dist/$NAME.zip"
printf '%s\n' "$ROOT/dist/$NAME.zip"