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

for path in INSTALL.md VERSION FRESH_INSTALL_ONLY MANIFEST.sha256 install.sh install-host-nginx.sh install-native-lemp.sh launch-web-installer.sh \
  installer/index.php public/index.html public/install/index.php \
  public/login/index.html public/register/index.html public/forgot-password/index.html public/reset-password/index.html public/verify-email/index.html \
  public/assets/auth.js public/assets/auth.css public/assets/home.js public/assets/home.css \
  public/app/index.html public/app/app.js public/app/auth-guard.js public/app/pending-link.js public/app/product-router.js public/app/product.css \
  public/admin/index.html public/admin/app.js public/admin/product-actions.js public/admin/settings-full.js public/admin/styles.css \
  scripts/verify-published-release.sh scripts/native-installer-apply.sh scripts/install-docker.sh \
  deploy/compose.production.yaml deploy/compose.host-nginx.yaml deploy/.env.production.example \
  deploy/nginx/gojet.conf deploy/nginx/gojet-host.conf deploy/nginx/gojet-native.conf deploy/nginx/gojet-bt-rewrite.conf \
  deploy/native/gojet.env.example deploy/native/gojet@.service deploy/native/gojet-installer.service deploy/native/gojet-installer.path \
  database/migrations/003_identity_and_workspaces.sql database/migrations/015_admin_identity.sql database/migrations/025_mail_templates.sql \
  docs/v4-product-rebuild.zh-CN.md app frontend services go.mod go.sum; do
  [ -e "$ROOT/$path" ] || { echo "release is missing $path" >&2; exit 1; }
done

for binary in redirect-engine analytics-worker analytics-reconciler platform-api mail-worker file-worker operations-monitor log-receiver; do
  [ -x "$ROOT/bin/$binary" ] || { echo "native executable is missing: bin/$binary" >&2; exit 1; }
done

for forbidden in .git node_modules tests test-results package.json playwright.config.js compose.yaml Makefile upgrade.sh upgrade-native.sh rollback.sh; do
  [ ! -e "$ROOT/$forbidden" ] || { echo "forbidden artifact must not ship: $forbidden" >&2; exit 1; }
done
[ ! -e "$ROOT/public/admin/admin-settings-fix.js" ] || { echo "obsolete RC7 admin hotpatch must not ship" >&2; exit 1; }
[ ! -e "$ROOT/database/migrations/026_admin_step_up_session.sql" ] || { echo "obsolete step-up migration must not ship" >&2; exit 1; }
if find "$ROOT" -type f -name '*_test.go' | grep -q .; then echo "Go test sources must not ship" >&2; exit 1; fi
if grep -R -n -E 'installer\.token|MYSQL_ADMIN_PASSWORD' "$ROOT/install.sh" "$ROOT/install-native-lemp.sh" "$ROOT/installer" "$ROOT/public/install" "$ROOT/deploy/native"; then
  echo "deprecated installer behavior leaked into production package" >&2; exit 1
fi

grep -Fq 'FRESH_INSTALL_ONLY=1' "$ROOT/FRESH_INSTALL_ONLY" || { echo 'fresh install marker is invalid' >&2; exit 1; }
grep -Fq 'CREATE TABLE administrator_permissions' "$ROOT/database/migrations/015_admin_identity.sql" || { echo 'administrator permission schema is missing' >&2; exit 1; }
grep -Fq "status ENUM('active','suspended','deleted')" "$ROOT/database/migrations/003_identity_and_workspaces.sql" || { echo 'user lifecycle schema is missing' >&2; exit 1; }
grep -Fq '{{verification_url}}' "$ROOT/database/migrations/025_mail_templates.sql" || { echo 'verification mail link is missing' >&2; exit 1; }
grep -Fq 'data-auth-page="login"' "$ROOT/public/login/index.html" || { echo 'dedicated login page is invalid' >&2; exit 1; }
grep -Fq '/api/auth/forgot-password' "$ROOT/public/assets/auth.js" || { echo 'password recovery frontend is not connected' >&2; exit 1; }
grep -Fq '/api/me/password' "$ROOT/public/app/product-router.js" || { echo 'user account settings are not connected' >&2; exit 1; }
grep -Fq '添加用户' "$ROOT/public/admin/app.js" || { echo 'administrator user CRUD UI is missing' >&2; exit 1; }
grep -Fq 'Markdown 正文' "$ROOT/public/admin/app.js" || { echo 'Markdown announcement editor is missing' >&2; exit 1; }
grep -Fq 'data-link-toggle' "$ROOT/public/admin/product-actions.js" || { echo 'administrator link operations are missing' >&2; exit 1; }
grep -Fq 'data-plan-edit' "$ROOT/public/admin/product-actions.js" || { echo 'administrator plan editor is missing' >&2; exit 1; }
grep -Fq 'links.default_redirect_status' "$ROOT/public/admin/settings-full.js" || { echo 'complete settings editor is missing' >&2; exit 1; }
grep -Fq '/app/analytics' "$ROOT/public/app/product-router.js" || { echo 'workspace analytics route is missing' >&2; exit 1; }
if grep -R -n -E 'step_up_required|X-GoJet-TOTP|MutationObserver' "$ROOT/public/admin"; then
  echo 'operation-level admin step-up or RC hotpatch leaked into rebuilt admin UI' >&2; exit 1
fi
grep -Fq 'location = /login' "$ROOT/deploy/nginx/gojet-bt-rewrite.conf" || { echo 'clean login route is missing' >&2; exit 1; }
grep -Fq 'location ^~ /uploads/' "$ROOT/deploy/nginx/gojet-bt-rewrite.conf" || { echo 'upload alias route is missing' >&2; exit 1; }
if sed -n '/location \^~ \/uploads\//,/^}/p' "$ROOT/deploy/nginx/gojet-bt-rewrite.conf" | grep -Fq 'try_files'; then
  echo 'upload alias must not use try_files' >&2; exit 1
fi

(cd "$ROOT" && sha256sum -c MANIFEST.sha256 >/dev/null)
actual=$(sed -n '/^services:$/,/^volumes:$/p' "$ROOT/deploy/compose.production.yaml" | sed -n 's/^  \([a-z][a-z0-9-]*\):$/\1/p' | sort | tr '\n' ' ')
expected='analytics-reconciler analytics-worker clamav file-worker log-receiver mail-worker mysql nginx operations-monitor platform-api redirect-engine redis '
[ "$actual" = "$expected" ] || { echo "production Compose service set is invalid: $actual" >&2; exit 1; }
printf 'fresh-install release verification passed: %s\n' "$ARCHIVE"
