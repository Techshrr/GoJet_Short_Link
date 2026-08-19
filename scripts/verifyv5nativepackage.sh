#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
ARCHIVE=${1:-$ROOT/dist/native/gojet-v5-native-linux-amd64.tar.gz}
CHECKSUM="$ARCHIVE.sha256"
EXPECTED_SHA=${GOJET_EXPECTED_SHA:-${GITHUB_SHA:-$(git -C "$ROOT" rev-parse HEAD)}}
NAME=gojet-v5-native-linux-amd64

[[ -f "$ARCHIVE" ]] || { echo "Native archive missing: $ARCHIVE" >&2; exit 1; }
[[ -f "$CHECKSUM" ]] || { echo "archive checksum missing: $CHECKSUM" >&2; exit 1; }
(cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$CHECKSUM")")

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
tar -xzf "$ARCHIVE" -C "$TMP"
PKG="$TMP/$NAME"
[[ -d "$PKG" ]] || { echo 'canonical Native package root missing' >&2; exit 1; }

bins=(redirectengine platformapi analyticsworker analyticsreconciler fileworker mailworker operationsmonitor logreceiver)
for b in "${bins[@]}"; do [[ -x "$PKG/bin/$b" ]] || { echo "missing executable bin/$b" >&2; exit 1; }; done
[[ "$(find "$PKG/bin" -maxdepth 1 -type f | wc -l)" -eq 8 ]] || { echo 'Native package must contain exactly eight runtime binaries' >&2; exit 1; }

for path in \
  database/migrations/migrationcatalog.txt \
  public/index.html public/docs/index.html public/app/index.html public/admin/index.html public/install/index.php \
  installer/index.php install.sh \
  scripts/runmigrations.sh scripts/nativeinstallerapply.sh scripts/nativeinstallerrun.sh scripts/installgeoip.sh \
  deploy/native/gojet@.service deploy/native/gojet.env.example deploy/native/gojetinstaller.service deploy/native/gojetinstaller.path \
  deploy/nginx/gojetnative.conf deploy/nginx/gojetbtrewrite.conf \
  resources/fonts/NotoSansSCRegular.ttf resources/fonts/OFL.txt \
  VERSION VERSION-MANIFEST.json SBOM.cdx.json MANIFEST.sha256; do
  [[ -s "$PKG/$path" ]] || { echo "required G11 payload missing: $path" >&2; exit 1; }
done

for helper in install.sh scripts/runmigrations.sh scripts/nativeinstallerapply.sh scripts/nativeinstallerrun.sh scripts/installgeoip.sh; do
  [[ -x "$PKG/$helper" ]] || { echo "required G11 executable helper missing execute bit: $helper" >&2; exit 1; }
done
grep -Fq 'ExecStart=__GOJET_ROOT__/scripts/nativeinstallerrun.sh' "$PKG/deploy/native/gojetinstaller.service" || {
  echo 'gojetinstaller.service ExecStart is not bound to packaged privileged installer runner' >&2
  exit 1
}

while IFS= read -r migration || [[ -n "$migration" ]]; do
  [[ -n "$migration" ]] || continue
  [[ -s "$PKG/database/migrations/$migration" ]] || { echo "catalogued migration missing: $migration" >&2; exit 1; }
done < "$PKG/database/migrations/migrationcatalog.txt"

# Fresh installs must work with a least-privilege MySQL 8 application user even
# when binary logging is enabled. Keep database migrations schema/data-only and
# keep business/audit authority in Go; privileged stored objects would require
# SUPER or server-global trust switches on common production installations.
privileged_sql=$(grep -RniE \
  '^[[:space:]]*CREATE([[:space:]]+DEFINER[[:space:]]*=[^[:space:]]+)?[[:space:]]+(TRIGGER|FUNCTION|PROCEDURE|EVENT)([[:space:]]|$)' \
  "$PKG/database/migrations" || true)
if [[ -n "$privileged_sql" ]]; then
  printf 'Privileged MySQL stored object present in Native migrations:\n%s\n' "$privileged_sql" >&2
  exit 1
fi

# V5 SPA/static evidence: Vite/Astro outputs must reference built assets; source trees are not shipped.
grep -Eq '/app/assets/[^" ]+\.js|/assets/[^" ]+\.js' "$PKG/public/app/index.html" || { echo 'Workspace built JS asset reference missing' >&2; exit 1; }
grep -Eq '/admin/assets/[^" ]+\.js' "$PKG/public/admin/index.html" || { echo 'Admin V5 hashed JS asset reference missing' >&2; exit 1; }
find "$PKG/public/admin/assets" -type f -name '*.js' -print -quit | grep -q . || { echo 'Admin hashed JS payload missing' >&2; exit 1; }
find "$PKG/public/app" -type f -name '*.js' -print -quit | grep -q . || { echo 'Workspace JS payload missing' >&2; exit 1; }
[[ -d "$PKG/public/docs/_astro" || -d "$PKG/public/docs/pagefind" ]] || { echo 'Docs static output missing Astro/Pagefind assets' >&2; exit 1; }

# Docs is Astro static output rooted at public/docs/index.html. The packaged
# aaPanel rewrite must serve that directory tree directly and must never point
# at the retired /docs.html path, otherwise a successful fresh install produces
# a deterministic public /docs/ 404.
DOCS_REWRITE="$PKG/deploy/nginx/gojetbtrewrite.conf"
! grep -Fq '/docs.html' "$DOCS_REWRITE" || { echo 'Native Nginx rewrite still points Docs at retired /docs.html' >&2; exit 1; }
grep -A3 -F 'location ^~ /docs/' "$DOCS_REWRITE" | grep -Fq 'try_files $uri $uri/ =404;' || {
  echo 'Native Nginx rewrite does not serve the packaged public/docs static tree' >&2
  exit 1
}

# The archive itself is the deployable product: no build-time or V4 production runtime is allowed inside it.
if find "$PKG" -type d \( -name node_modules -o -name userconsole -o -name adminconsole \) -print -quit | grep -q .; then
  echo 'forbidden Node/legacy console directory present in Native package' >&2; exit 1
fi
if find "$PKG" -type f \( -iname 'Dockerfile*' -o -iname 'docker-compose*.yml' -o -iname 'docker-compose*.yaml' -o -iname 'ecosystem.config.*' \) -print -quit | grep -q .; then
  echo 'Docker/Compose/PM2 production asset present in Native package' >&2; exit 1
fi
grep -Fq -- '--docker' "$PKG/install.sh" && { echo 'Native installer still exposes V4 Docker mode' >&2; exit 1; }

# Frozen V5 production requires authenticated Redis, Vite Admin validation and
# the renderer-compatible static TrueType font shipped inside the immutable G11 artifact.
grep -Fq 'REDIS_PORT REDIS_PASSWORD PUBLIC_BASE_URL' "$PKG/scripts/nativeinstallerapply.sh" || { echo 'Redis password is not a required Native install parameter' >&2; exit 1; }
grep -Fq 'redis_args=(-h 127.0.0.1 -p "${cfg[REDIS_PORT]}" -a "${cfg[REDIS_PASSWORD]}")' "$PKG/scripts/nativeinstallerapply.sh" || { echo 'Native Redis AUTH probe missing' >&2; exit 1; }
redis_example=$(sed -n 's/^REDIS_PASSWORD=//p' "$PKG/deploy/native/gojet.env.example" | head -n1)
[[ -n "$redis_example" ]] || { echo 'Native environment example permits unauthenticated Redis' >&2; exit 1; }
! grep -Eq '/admin/(styles\.css|app\.js)|loginForm' "$PKG/scripts/nativeinstallerapply.sh" || { echo 'V4 Admin static verification leaked into V5 Native installer' >&2; exit 1; }
grep -Fq '/admin/assets/' "$PKG/scripts/nativeinstallerapply.sh" || { echo 'V5 Admin hashed-asset verification missing' >&2; exit 1; }
PDF_FONT_REL='resources/fonts/NotoSansSCRegular.ttf'
PDF_FONT_NATIVE='__GOJET_ROOT__/resources/fonts/NotoSansSCRegular.ttf'
grep -Fq "Environment=PDF_FONT_PATH=$PDF_FONT_NATIVE" "$PKG/deploy/native/gojet@.service" || { echo 'Native service does not use the packaged static PDF font' >&2; exit 1; }
grep -Fq "PDF_FONT_PATH=$PDF_FONT_NATIVE" "$PKG/deploy/native/gojet.env.example" || { echo 'Native environment example does not use the packaged static PDF font' >&2; exit 1; }
grep -Fq "ExecStartPre=/usr/bin/test -s $PDF_FONT_NATIVE" "$PKG/deploy/native/gojet@.service" || { echo 'Native service does not fail closed when the packaged PDF font is missing' >&2; exit 1; }
[[ "$(od -An -tx1 -N4 "$PKG/$PDF_FONT_REL" | tr -d ' \n')" == '00010000' ]] || { echo 'packaged PDF font is not a static TrueType sfnt' >&2; exit 1; }
[[ "$(stat -c %s "$PKG/$PDF_FONT_REL")" -gt 1000000 ]] || { echo 'packaged PDF font is unexpectedly small' >&2; exit 1; }

(
  cd "$PKG"
  sha256sum -c MANIFEST.sha256
)

python3 - "$PKG" "$EXPECTED_SHA" <<'PY'
from pathlib import Path
import json,sys
p=Path(sys.argv[1]); expected=sys.argv[2]
v=json.loads((p/'VERSION-MANIFEST.json').read_text())
assert v['schema']=='gojet-v5-native-version-manifest-v1'
assert v['phase']=='P21' and v['gate']=='G11'
assert v['git_sha']==expected,(v['git_sha'],expected)
assert v['platform']['os']=='linux' and v['platform']['arch']=='amd64'
assert v['platform']['cache']=='redis-authenticated'
assert v['fresh_install_claimed'] is False
assert len(v['binaries'])==8 and len(set(v['binaries']))==8
s=json.loads((p/'SBOM.cdx.json').read_text())
assert s['bomFormat']=='CycloneDX' and s['specVersion']=='1.5'
props={x['name']:x['value'] for x in s['metadata']['properties']}
assert props['gojet.git.sha']==expected and props['gojet.phase']=='P21' and props['gojet.gate']=='G11'
assert len(s.get('components',[]))>8
PY

printf 'GoJet V5 P21 Native Package G11 verification: PASS (%s)\n' "$EXPECTED_SHA"
