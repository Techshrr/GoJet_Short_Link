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
"$ROOT/scripts/preparepdffonts.sh"
python3 "$ROOT/scripts/buildpublicsite.py" --output "$PUBLIC_BUILD"
mkdir -p "$TARGET/bin" "$TARGET/installer" "$TARGET/database/migrations" "$TARGET/deploy/nginx" "$TARGET/deploy/native" "$TARGET/deploy/docker" "$TARGET/scripts" "$TARGET/docs" "$TARGET/public/app" "$TARGET/public/admin" "$TARGET/public/install" "$TARGET/public/assets/images" "$TARGET/public/generated/qr" "$TARGET/storage/installer" "$TARGET/resources/fonts"
build() { (cd "$ROOT" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags='-s -w' -o "$TARGET/bin/$1" "$2"); }
build redirectengine ./services/redirectengine/cmd/server
build analyticsworker ./services/analyticsworker/cmd/worker
build analyticsreconciler ./services/analyticsreconciler/cmd/reconciler
build platformapi ./services/platformapi/cmd/server
build mailworker ./services/platformapi/cmd/mailworker
build fileworker ./services/platformapi/cmd/fileworker
build operationsmonitor ./services/platformapi/cmd/operationsmonitor
build logreceiver ./services/logreceiver/cmd/server
cp -R "$ROOT/installer/." "$TARGET/installer/"
cp -R "$ROOT/database/migrations/." "$TARGET/database/migrations/"
cp "$ROOT/resources/fonts/NotoSansSC-Regular.ttf" "$TARGET/resources/fonts/NotoSansSC-Regular.ttf"
cp "$ROOT/resources/fonts/OFL.txt" "$TARGET/resources/fonts/OFL.txt"
cp -R "$PUBLIC_BUILD/." "$TARGET/public/"
cp -R "$ROOT/frontend/userconsole/." "$TARGET/public/app/"
cp -R "$ROOT/frontend/adminconsole/." "$TARGET/public/admin/"
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
# Public asset URLs are stable paths. Cache invalidation is handled by HTTP
# cache policy/deployment, never by version query strings in source or release.
if grep -R -I -n -F '?v=' "$TARGET/public"; then
  echo 'version query string leaked into production public assets' >&2
  exit 1
fi
cp "$ROOT/deploy/compose.production.yaml" "$TARGET/deploy/compose.production.yaml"
cp "$ROOT/deploy/compose.hostnginx.yaml" "$TARGET/deploy/compose.hostnginx.yaml"
cp "$ROOT/deploy/.env.production.example" "$TARGET/deploy/.env.production.example"
cp "$ROOT/deploy/docker/service.Dockerfile" "$TARGET/deploy/docker/service.Dockerfile"
cp "$ROOT/deploy/docker/platform.Dockerfile" "$TARGET/deploy/docker/platform.Dockerfile"
cp "$ROOT/deploy/nginx/gojet.conf" "$TARGET/deploy/nginx/gojet.conf"
cp "$ROOT/deploy/nginx/gojethost.conf" "$TARGET/deploy/nginx/gojethost.conf"
cp "$ROOT/deploy/nginx/gojetnative.conf" "$TARGET/deploy/nginx/gojetnative.conf"
cp "$ROOT/deploy/nginx/gojetbtrewrite.conf" "$TARGET/deploy/nginx/gojetbtrewrite.conf"
cp "$ROOT/deploy/native/gojet.env.example" "$ROOT/deploy/native/gojet@.service" "$ROOT/deploy/native/gojetinstaller.service" "$ROOT/deploy/native/gojetinstaller.path" "$TARGET/deploy/native/"
cp "$ROOT/scripts/lib.sh" "$ROOT/scripts/verifyrelease.sh" "$ROOT/scripts/verifypublishedrelease.sh" "$ROOT/scripts/nativeinstallerrun.sh" "$ROOT/scripts/nativeinstallerapply.sh" "$ROOT/scripts/installdocker.sh" "$TARGET/scripts/"
cp "$ROOT/docs/deployment.zhCN.md" "$ROOT/docs/architecture.md" "$ROOT/docs/objectstorage.zhCN.md" "$ROOT/docs/operationsalerting.zhCN.md" "$TARGET/docs/"
cp "$ROOT/install.sh" "$ROOT/installhostnginx.sh" "$ROOT/installnativelemp.sh" "$ROOT/launchwebinstaller.sh" "$ROOT/LICENSE" "$TARGET/"
cp "$ROOT/deploy/INSTALL.zhCN.md" "$TARGET/INSTALL.md"
printf '%s\n' "$VERSION" > "$TARGET/VERSION"
printf '%s\n' 'FRESH_INSTALL_ONLY=1' > "$TARGET/FRESH_INSTALL_ONLY"
chmod 0755 "$TARGET/install.sh" "$TARGET/installhostnginx.sh" "$TARGET/installnativelemp.sh" "$TARGET/launchwebinstaller.sh" "$TARGET/scripts/verifyrelease.sh" "$TARGET/scripts/verifypublishedrelease.sh" "$TARGET/scripts/nativeinstallerrun.sh" "$TARGET/scripts/nativeinstallerapply.sh" "$TARGET/scripts/installdocker.sh" "$TARGET"/bin/*
find "$TARGET" -type f \( -name '.env' -o -name '.env.production' -o -name '*.log' -o -name '*.tmp' \) -delete
find "$TARGET" -type d \( -name '.git' -o -name 'node_modules' -o -name 'test-results' -o -name 'tests' -o -name '__pycache__' \) -prune -exec rm -rf {} +
test -s "$TARGET/resources/fonts/NotoSansSC-Regular.ttf" || { echo 'PDF Unicode Regular font missing from production package' >&2; exit 1; }
test -s "$TARGET/resources/fonts/OFL.txt" || { echo 'PDF font license missing from production package' >&2; exit 1; }
for forbidden in app frontend services go.mod go.sum Dockerfile tests .github; do [ ! -e "$TARGET/$forbidden" ] || { echo "development artifact must not ship: $forbidden" >&2; exit 1; }; done
if find "$TARGET" -iname '*hardening*' -o -iname '*rc12*' | grep -q .; then echo 'engineering-stage filename leaked into production package' >&2; exit 1; fi
# The verifier contains the literal retired markers by definition. Scan the
# runtime/deployment payload, not the rule file that documents those markers.
if grep -R -n -E '/system-images/|SYSTEM_IMAGE_PATH|data/system/images|V4_PRODUCT_HARDENING|product-hardening|hardening-release' "$TARGET" --exclude=MANIFEST.sha256 --exclude=verifyrelease.sh; then echo 'retired engineering or system-image contract leaked into production package' >&2; exit 1; fi
(cd "$TARGET" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/$NAME.zip" "$ROOT/dist/$NAME.zip.sha256"
(cd "$STAGE" && zip -q -r "$ROOT/dist/$NAME.zip" "$NAME")
(cd "$ROOT/dist" && sha256sum "$NAME.zip" > "$NAME.zip.sha256")
"$ROOT/scripts/verifyrelease.sh" "$ROOT/dist/$NAME.zip"
printf '%s\n' "$ROOT/dist/$NAME.zip"
