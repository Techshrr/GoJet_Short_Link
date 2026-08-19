#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
VERSION=${1:-$(git -C "$ROOT" describe --always)}
SAFE_VERSION=$(printf '%s' "$VERSION" | tr -c 'A-Za-z0-9.' '.')
NAME="GoJet${SAFE_VERSION}LinuxProduction"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT INT TERM
TARGET="$STAGE/$NAME"

for tool in go zip sha256sum sed python3 curl git node corepack; do
  command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }
done

python3 "$ROOT/scripts/checknames.py"
python3 "$ROOT/scripts/checkschema.py"
"$ROOT/scripts/preparepdffonts.sh"

# The release payload must be built from the canonical V5 applications. Legacy
# publicsite/userconsole/adminconsole files are not an accepted production UI.
(
  cd "$ROOT/frontend"
  corepack pnpm install --frozen-lockfile
  corepack pnpm check
)

for app in site workspace admin docs; do
  test -s "$ROOT/frontend/apps/$app/dist/index.html" || { echo "canonical V5 $app build is missing" >&2; exit 1; }
done
test -s "$ROOT/frontend/apps/site/dist/zh-CN/index.html" || { echo 'Simplified Chinese website build is missing' >&2; exit 1; }
test -s "$ROOT/frontend/apps/docs/dist/zh-CN/index.html" || { echo 'Simplified Chinese documentation build is missing' >&2; exit 1; }

mkdir -p \
  "$TARGET/bin" "$TARGET/installer" "$TARGET/database/migrations" \
  "$TARGET/deploy/nginx" "$TARGET/deploy/native" "$TARGET/deploy/docker" "$TARGET/deploy/data/geoip" \
  "$TARGET/scripts" "$TARGET/docs" "$TARGET/public/app" "$TARGET/public/admin" "$TARGET/public/docs" \
  "$TARGET/public/install" "$TARGET/public/assets/images" "$TARGET/public/generated/qr" \
  "$TARGET/storage/installer" "$TARGET/resources/fonts"

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
cp "$ROOT/resources/fonts/NotoSansSCRegular.ttf" "$TARGET/resources/fonts/NotoSansSCRegular.ttf"
cp "$ROOT/resources/fonts/OFL.txt" "$TARGET/resources/fonts/OFL.txt"

cp -R "$ROOT/frontend/apps/site/dist/." "$TARGET/public/"
cp -R "$ROOT/frontend/apps/workspace/dist/." "$TARGET/public/app/"
cp -R "$ROOT/frontend/apps/admin/dist/." "$TARGET/public/admin/"
cp -R "$ROOT/frontend/apps/docs/dist/." "$TARGET/public/docs/"
cp -R "$ROOT/public/install/." "$TARGET/public/install/"

# Development-only visual verification pages must never be reachable from a
# production release, even if a local build left their static fixture behind.
rm -rf "$TARGET/public/dev"

# Production must contain real V5 product surfaces and both languages, including
# legal routes that previously disappeared behind redirect-engine fallback.
for required in \
  public/index.html \
  public/zh-CN/index.html \
  public/legal/privacy/index.html \
  public/legal/terms/index.html \
  public/legal/acceptable-use/index.html \
  public/report-abuse/index.html \
  public/app/index.html \
  public/admin/index.html \
  public/docs/index.html \
  public/docs/zh-CN/index.html; do
  test -s "$TARGET/$required" || { echo "production UI is missing $required" >&2; exit 1; }
done
[ ! -e "$TARGET/public/dev" ] || { echo 'internal design verification route leaked into production' >&2; exit 1; }

grep -Fq 'footer-columns' "$TARGET/public/index.html" || { echo 'complete website footer is missing from production build' >&2; exit 1; }
grep -Fq 'Privacy Policy' "$TARGET/public/legal/privacy/index.html" || { echo 'English privacy policy is missing' >&2; exit 1; }
grep -Fq '隐私政策' "$TARGET/public/zh-CN/legal/privacy/index.html" || { echo 'Simplified Chinese privacy policy is missing' >&2; exit 1; }
grep -Fq 'gojet_admin_session' "$ROOT/services/platformapi/cmd/server/adminidentity.go" || { echo 'administrator browser-session contract is missing' >&2; exit 1; }

VERSION_QUERY=$(printf '?%s' 'v=')
if grep -R -I -n -F "$VERSION_QUERY" "$TARGET/public"; then
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
cp "$ROOT/deploy/data/geoip/README.md" "$TARGET/deploy/data/geoip/README.md"
cp "$ROOT/scripts/lib.sh" "$ROOT/scripts/checkschema.py" "$ROOT/scripts/runmigrations.sh" "$ROOT/scripts/verifyrelease.sh" "$ROOT/scripts/verifypublishedrelease.sh" "$ROOT/scripts/nativeinstallerrun.sh" "$ROOT/scripts/nativeinstallerapply.sh" "$ROOT/scripts/installdocker.sh" "$ROOT/scripts/installgeoip.sh" "$TARGET/scripts/"
cp "$ROOT/docs/deployment.zhCN.md" "$ROOT/docs/architecture.md" "$ROOT/docs/objectstorage.zhCN.md" "$ROOT/docs/operationsalerting.zhCN.md" "$TARGET/docs/"
cp "$ROOT/install.sh" "$ROOT/installhostnginx.sh" "$ROOT/installnativelemp.sh" "$ROOT/launchwebinstaller.sh" "$ROOT/LICENSE" "$TARGET/"
cp "$ROOT/deploy/INSTALL.zhCN.md" "$TARGET/INSTALL.md"
printf '%s\n' "$VERSION" > "$TARGET/VERSION"
printf '%s\n' 'FRESHINSTALLONLY=1' > "$TARGET/FRESHINSTALLONLY"

chmod 0755 "$TARGET/install.sh" "$TARGET/installhostnginx.sh" "$TARGET/installnativelemp.sh" "$TARGET/launchwebinstaller.sh" \
  "$TARGET/scripts/runmigrations.sh" "$TARGET/scripts/verifyrelease.sh" "$TARGET/scripts/verifypublishedrelease.sh" \
  "$TARGET/scripts/nativeinstallerrun.sh" "$TARGET/scripts/nativeinstallerapply.sh" "$TARGET/scripts/installdocker.sh" \
  "$TARGET/scripts/installgeoip.sh" "$TARGET"/bin/*

find "$TARGET" -type f \( -name '.env' -o -name '.env.production' -o -name '*.log' -o -name '*.tmp' \) -delete
find "$TARGET" -type d \( -name '.git' -o -name 'node_modules' -o -name 'testresults' -o -name 'tests' -o -name '__pycache__' \) -prune -exec rm -rf {} +

test -s "$TARGET/resources/fonts/NotoSansSCRegular.ttf" || { echo 'PDF Unicode Regular font missing from production package' >&2; exit 1; }
test -s "$TARGET/resources/fonts/OFL.txt" || { echo 'PDF font license missing from production package' >&2; exit 1; }
test -s "$TARGET/scripts/installgeoip.sh" || { echo 'mandatory GeoIP installer missing from production package' >&2; exit 1; }
test -s "$TARGET/deploy/data/geoip/README.md" || { echo 'GeoIP source/license documentation missing from production package' >&2; exit 1; }
for forbidden in app frontend services go.mod go.sum Dockerfile tests .github; do
  [ ! -e "$TARGET/$forbidden" ] || { echo "development artifact must not ship: $forbidden" >&2; exit 1; }
done
if find "$TARGET" -iname '*hardening*' -o -iname '*rc12*' | grep -q .; then
  echo 'engineering-stage filename leaked into production package' >&2
  exit 1
fi
if grep -R -n -E '/system-images/|SYSTEM_IMAGE_PATH|data/system/images|V4_PRODUCT_HARDENING|product-hardening|hardening-release' "$TARGET" --exclude=MANIFEST.sha256 --exclude=verifyrelease.sh; then
  echo 'retired engineering or system-image contract leaked into production package' >&2
  exit 1
fi

(cd "$TARGET" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
mkdir -p "$ROOT/dist"
rm -f "$ROOT/dist/$NAME.zip" "$ROOT/dist/$NAME.zip.sha256"
(cd "$STAGE" && zip -q -r "$ROOT/dist/$NAME.zip" "$NAME")
(cd "$ROOT/dist" && sha256sum "$NAME.zip" > "$NAME.zip.sha256")
"$ROOT/scripts/verifyrelease.sh" "$ROOT/dist/$NAME.zip"
printf '%s\n' "$ROOT/dist/$NAME.zip"
