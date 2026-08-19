#!/usr/bin/env sh
set -eu
[ "$#" -eq 1 ] || { echo "usage: $0 <GoJetProduction.zip>" >&2; exit 2; }
ARCHIVE=$1
[ -f "$ARCHIVE" ] || { echo "archive not found: $ARCHIVE" >&2; exit 1; }
for tool in unzip sha256sum python3 bash; do command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }; done
unzip -tq "$ARCHIVE" >/dev/null
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM
unzip -q "$ARCHIVE" -d "$TMP"
ROOT=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)
[ -n "$ROOT" ] || { echo 'release root is missing' >&2; exit 1; }
CATALOG="$ROOT/database/migrations/migrationcatalog.txt"
[ -s "$CATALOG" ] || { echo 'migration catalog is missing' >&2; exit 1; }
catalog_count=$(grep -cve '^[[:space:]]*$' "$CATALOG" | tr -d '[:space:]')
sql_count=$(find "$ROOT/database/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d '[:space:]')
[ "$catalog_count" -gt 0 ] || { echo 'migration catalog is empty' >&2; exit 1; }
[ "$catalog_count" -eq "$sql_count" ] || { echo "migration catalog/SQL count mismatch: catalog=$catalog_count sql=$sql_count" >&2; exit 1; }
unique_count=$(grep -ve '^[[:space:]]*$' "$CATALOG" | sort -u | wc -l | tr -d '[:space:]')
[ "$unique_count" -eq "$catalog_count" ] || { echo 'migration catalog contains duplicate entries' >&2; exit 1; }
for migration in linkdestinationrisk.sql socialauth.sql socialsubjectwidth.sql billingcycles.sql; do
  grep -Fxq "$migration" "$CATALOG" || { echo "migration catalog is missing $migration" >&2; exit 1; }
done

for path in \
  public/install/index.php public/install/install.css public/install/wizard.css public/install/install.js \
  public/index.html public/zh-CN/index.html \
  public/legal/privacy/index.html public/legal/terms/index.html public/legal/acceptable-use/index.html \
  public/zh-CN/legal/privacy/index.html public/zh-CN/legal/terms/index.html public/zh-CN/legal/acceptable-use/index.html \
  public/report-abuse/index.html public/app/index.html public/admin/index.html public/docs/index.html public/docs/zh-CN/index.html \
  database/migrations/supportticketmessageip.sql database/migrations/officialshortdomains.sql \
  database/migrations/emailauthcodes.sql database/migrations/mailinvoicepresentation.sql \
  database/migrations/linkdestinationrisk.sql database/migrations/socialauth.sql \
  database/migrations/socialsubjectwidth.sql database/migrations/billingcycles.sql \
  scripts/installgeoip.sh deploy/native/gojet@.service; do
  [ -s "$ROOT/$path" ] || { echo "release is missing $path" >&2; exit 1; }
done

[ ! -e "$ROOT/public/dev" ] || { echo 'release contains an internal design verification route' >&2; exit 1; }
grep -Fq 'footer-columns' "$ROOT/public/index.html" || { echo 'release website footer is incomplete' >&2; exit 1; }
grep -Fq 'Privacy Policy' "$ROOT/public/legal/privacy/index.html" || { echo 'release privacy policy is not rendered' >&2; exit 1; }
grep -Fq '隐私政策' "$ROOT/public/zh-CN/legal/privacy/index.html" || { echo 'release zh-CN privacy policy is not rendered' >&2; exit 1; }
grep -Fq '<html lang="en">' "$ROOT/public/index.html" || { echo 'release English website locale is invalid' >&2; exit 1; }
grep -Fq '<html lang="zh-CN">' "$ROOT/public/zh-CN/index.html" || { echo 'release Simplified Chinese website locale is invalid' >&2; exit 1; }
grep -Fq 'try_files $uri $uri.html $uri/index.html' "$ROOT/deploy/nginx/gojetnative.conf" || { echo 'native Nginx cannot serve nested static pages' >&2; exit 1; }
grep -Fq 'try_files $uri $uri.html $uri/index.html' "$ROOT/deploy/nginx/gojethost.conf" || { echo 'host Nginx cannot serve nested static pages' >&2; exit 1; }
grep -Fq 'try_files $uri $uri.html $uri/index.html' "$ROOT/deploy/nginx/gojet.conf" || { echo 'container Nginx cannot serve nested static pages' >&2; exit 1; }
grep -Fq 'try_files $uri $uri.html $uri/index.html' "$ROOT/deploy/nginx/gojetbtrewrite.conf" || { echo 'aaPanel Nginx cannot serve nested static pages' >&2; exit 1; }

grep -Fq 'scripts/installgeoip.sh' "$ROOT/install.sh" || { echo 'release bootstrap does not require GeoIP installer' >&2; exit 1; }
grep -Fq 'GEOIP_MMDB=__GOJET_ROOT__/deploy/data/geoip/city.mmdb' "$ROOT/deploy/native/gojet@.service" || { echo 'release service is missing City MMDB runtime contract' >&2; exit 1; }
grep -Fq 'test -s __GOJET_ROOT__/deploy/data/geoip/city.mmdb' "$ROOT/deploy/native/gojet@.service" || { echo 'release service does not fail closed without City MMDB' >&2; exit 1; }
bash -n "$ROOT/scripts/installgeoip.sh"
(cd "$ROOT" && sha256sum -c MANIFEST.sha256 >/dev/null)
printf 'fresh-install V5 release verification passed: %s (%s migrations)\n' "$ARCHIVE" "$catalog_count"
