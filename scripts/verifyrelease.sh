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

for path in INSTALL.md VERSION FRESH_INSTALL_ONLY MANIFEST.sha256 install.sh installhostnginx.sh installnativelemp.sh launchwebinstaller.sh \
  installer/index.php public/index.html public/install/index.php \
  public/login/index.html public/register/index.html public/forgotpassword/index.html public/resetpassword/index.html public/verifyemail/index.html \
  public/assets/auth.js public/assets/auth.css public/assets/home.js public/assets/home.css public/assets/gojetdesignsystem.css public/assets/brandruntime.js \
  public/app/index.html public/app/app.js public/app/authguard.js public/app/pendinglink.js public/app/router.js public/app/pages.js public/app/links.js public/app/product.css \
  public/admin/index.html public/admin/app.js public/admin/productactions.js public/admin/styles.css \
  scripts/verifypublishedrelease.sh scripts/nativeinstallerrun.sh scripts/nativeinstallerapply.sh scripts/installdocker.sh \
  deploy/compose.production.yaml deploy/compose.hostnginx.yaml deploy/.env.production.example \
  deploy/docker/service.Dockerfile deploy/docker/platform.Dockerfile \
  deploy/nginx/gojet.conf deploy/nginx/gojethost.conf deploy/nginx/gojetnative.conf deploy/nginx/gojetbtrewrite.conf \
  deploy/native/gojet.env.example deploy/native/gojet@.service deploy/native/gojetinstaller.service deploy/native/gojetinstaller.path \
  database/migrations/003_identity_and_workspaces.sql database/migrations/015_admin_identity.sql database/migrations/025_mail_templates.sql \
  database/migrations/028_file_share_password.sql database/migrations/029_payment_transactions.sql \
  database/migrations/030_fx_and_mail_lifecycle.sql database/migrations/031_account_workspace_mail_events.sql \
  database/migrations/032_support_tickets_and_turnstile.sql database/migrations/033_abuse_report_public_url.sql database/migrations/034_mail_brand_fragments.sql database/migrations/035_link_contracts.sql \
  public/reportabuse/index.html public/privacy/index.html public/terms/index.html public/admin/supportsecurity.js \
  resources/fonts/NotoSansSC-Regular.ttf resources/fonts/OFL.txt; do
  [ -e "$ROOT/$path" ] || { echo "release is missing $path" >&2; exit 1; }
done

for binary in redirectengine analyticsworker analyticsreconciler platformapi mailworker fileworker operationsmonitor logreceiver; do
  [ -x "$ROOT/bin/$binary" ] || { echo "production executable is missing: bin/$binary" >&2; exit 1; }
done

for forbidden in .git .github node_modules tests test-results package.json playwright.config.js compose.yaml Makefile upgrade.sh upgradenative.sh rollback.sh \
  app frontend services go.mod go.sum Dockerfile; do
  [ ! -e "$ROOT/$forbidden" ] || { echo "development artifact must not ship: $forbidden" >&2; exit 1; }
done
if find "$ROOT" -iname '*hardening*' -o -iname '*rc12*' | grep -q .; then
  echo 'engineering-stage filename leaked into production package' >&2
  exit 1
fi
if find "$ROOT" -type f -name '*_test.go' | grep -q .; then echo "Go test sources must not ship" >&2; exit 1; fi
# verifyrelease.sh intentionally names retired markers as rejection rules, so
# exclude only that rule file while scanning the actual runtime payload.
if grep -R -n -E '/system-images/|SYSTEM_IMAGE_PATH|data/system/images|V4_PRODUCT_HARDENING|product-hardening|hardening-release' "$ROOT" --exclude=MANIFEST.sha256 --exclude=verifyrelease.sh; then
  echo 'retired engineering or system-image contract leaked into production package' >&2
  exit 1
fi
if grep -R -I -n -F '?v=' "$ROOT/public"; then
  echo 'version query string is forbidden in production public assets' >&2
  exit 1
fi
if grep -R -n -E 'installer\.token|MYSQL_ADMIN_PASSWORD' "$ROOT/install.sh" "$ROOT/installnativelemp.sh" "$ROOT/installer" "$ROOT/public/install" "$ROOT/deploy/native"; then
  echo "deprecated installer behavior leaked into production package" >&2; exit 1
fi

grep -Fq 'FRESH_INSTALL_ONLY=1' "$ROOT/FRESH_INSTALL_ONLY" || { echo 'fresh install marker is invalid' >&2; exit 1; }
grep -Fq 'CREATE TABLE administrator_permissions' "$ROOT/database/migrations/015_admin_identity.sql" || { echo 'administrator permission schema is missing' >&2; exit 1; }
grep -Fq "status ENUM('active','suspended','deleted')" "$ROOT/database/migrations/003_identity_and_workspaces.sql" || { echo 'user lifecycle schema is missing' >&2; exit 1; }
grep -Fq '{{verification_url}}' "$ROOT/database/migrations/025_mail_templates.sql" || { echo 'verification mail link is missing' >&2; exit 1; }
grep -Fq 'password_hash' "$ROOT/database/migrations/028_file_share_password.sql" || { echo 'protected fileshare migration is missing' >&2; exit 1; }
grep -Fq 'CREATE TABLE payment_transactions' "$ROOT/database/migrations/029_payment_transactions.sql" || { echo 'payment transaction migration is missing' >&2; exit 1; }
grep -Fq 'fx_rate_cache' "$ROOT/database/migrations/030_fx_and_mail_lifecycle.sql" || { echo 'FX cache migration is missing' >&2; exit 1; }
grep -Fq 'invoice_paid' "$ROOT/database/migrations/030_fx_and_mail_lifecycle.sql" || { echo 'billing lifecycle mail templates are missing' >&2; exit 1; }
grep -Fq 'account_welcome' "$ROOT/database/migrations/030_fx_and_mail_lifecycle.sql" || { echo 'account lifecycle mail templates are missing' >&2; exit 1; }
grep -Fq 'user_email_change_audit' "$ROOT/database/migrations/031_account_workspace_mail_events.sql" || { echo 'account email-change audit trigger is missing' >&2; exit 1; }
grep -Fq 'workspace_role_changed' "$ROOT/database/migrations/031_account_workspace_mail_events.sql" || { echo 'workspace role-change mail update is missing' >&2; exit 1; }
grep -Fq 'CREATE TABLE support_tickets' "$ROOT/database/migrations/032_support_tickets_and_turnstile.sql" || { echo 'support ticket schema is missing' >&2; exit 1; }
grep -Fq "'turnstile.ticket_create'" "$ROOT/database/migrations/032_support_tickets_and_turnstile.sql" || { echo 'support Turnstile policy is missing' >&2; exit 1; }
grep -Fq 'ADD COLUMN reported_url' "$ROOT/database/migrations/033_abuse_report_public_url.sql" || { echo 'public abuse URL schema is missing' >&2; exit 1; }
grep -Fq "'support_ticket_reply'" "$ROOT/database/migrations/034_mail_brand_fragments.sql" || { echo 'support mail fragment is missing' >&2; exit 1; }
grep -Fq "'links.default_click_limit','0'" "$ROOT/database/migrations/035_link_contracts.sql" || { echo 'blank link visit limit contract is missing' >&2; exit 1; }

grep -Fq 'data-auth-page="login"' "$ROOT/public/login/index.html" || { echo 'dedicated login page is invalid' >&2; exit 1; }
grep -Fq '/api/auth/forgotpassword' "$ROOT/public/assets/auth.js" || { echo 'password recovery frontend is not connected' >&2; exit 1; }
grep -Fq '/api/me/password' "$ROOT/public/app/router.js" || { echo 'user account settings are not connected' >&2; exit 1; }
grep -Fq '/app/analytics' "$ROOT/public/app/router.js" || { echo 'workspace analytics route is missing' >&2; exit 1; }
grep -Fq 'gojetOpenAnalytics' "$ROOT/public/app/links.js" || { echo 'link analytics action is not connected to canonical analytics page' >&2; exit 1; }
grep -Fq '添加用户' "$ROOT/public/admin/app.js" || { echo 'administrator user CRUD UI is missing' >&2; exit 1; }
grep -Fq 'Markdown 正文' "$ROOT/public/admin/app.js" || { echo 'Markdown announcement editor is missing' >&2; exit 1; }
grep -Fq 'data-link-toggle' "$ROOT/public/admin/productactions.js" || { echo 'administrator link operations are missing' >&2; exit 1; }
grep -Fq 'data-plan-edit' "$ROOT/public/admin/productactions.js" || { echo 'administrator plan editor is missing' >&2; exit 1; }
grep -Fq '/api/admin/support/tickets' "$ROOT/public/admin/supportsecurity.js" || { echo 'administrator support queue is not connected' >&2; exit 1; }
grep -Fq '/api/admin/bot-protection' "$ROOT/public/admin/supportsecurity.js" || { echo 'central Turnstile settings UI is not connected' >&2; exit 1; }
grep -Fq '隐私政策' "$ROOT/public/privacy/index.html" || { echo 'privacy page content is missing' >&2; exit 1; }
grep -Fq '服务条款' "$ROOT/public/terms/index.html" || { echo 'terms page content is missing' >&2; exit 1; }
grep -Fq '<form id="loginForm" class="login-card" method="post" action="/api/admin/auth/login">' "$ROOT/public/admin/index.html" || { echo 'admin login form must fail closed with POST when JavaScript is unavailable' >&2; exit 1; }
if grep -R -n -E 'step_up_required|X-GoJet-TOTP|MutationObserver' "$ROOT/public/admin"; then
  echo 'operation-level admin step-up or obsolete hotpatch leaked into admin UI' >&2; exit 1
fi

# Runtime release must serve only the built public tree. Canonical frontend
# source paths are intentionally absent from the archive.
grep -Fq '../public:/usr/share/nginx/html/site:ro' "$ROOT/deploy/compose.production.yaml" || { echo 'release Nginx is not mounted from built public assets' >&2; exit 1; }
grep -Fq 'deploy/docker/service.Dockerfile' "$ROOT/deploy/compose.production.yaml" || { echo 'release binary service image is not configured' >&2; exit 1; }
grep -Fq 'deploy/docker/platform.Dockerfile' "$ROOT/deploy/compose.production.yaml" || { echo 'release platform image is not configured' >&2; exit 1; }
grep -Fq 'NotoSansSC-Regular.ttf' "$ROOT/deploy/docker/platform.Dockerfile" || { echo 'release platform image does not embed the static Unicode invoice font' >&2; exit 1; }
for config in "$ROOT/deploy/nginx/gojethost.conf" "$ROOT/deploy/nginx/gojetnative.conf"; do
  grep -Fq '__GOJET_ROOT__/public/app/' "$config" || { echo "release app path is not public/app in $config" >&2; exit 1; }
  grep -Fq '__GOJET_ROOT__/public/admin/' "$config" || { echo "release admin path is not public/admin in $config" >&2; exit 1; }
  if grep -Fq '__GOJET_ROOT__/frontend/' "$config"; then echo "source frontend path leaked into $config" >&2; exit 1; fi
done

grep -Fq 'location = /login' "$ROOT/deploy/nginx/gojetbtrewrite.conf" || { echo 'clean login route is missing' >&2; exit 1; }
grep -Fq 'location ^~ /app/' "$ROOT/deploy/nginx/gojetbtrewrite.conf" || { echo 'aaPanel-safe app console route is missing' >&2; exit 1; }
grep -Fq 'location ^~ /admin/' "$ROOT/deploy/nginx/gojetbtrewrite.conf" || { echo 'aaPanel-safe admin console route is missing' >&2; exit 1; }
grep -Fq 'location ^~ /uploads/' "$ROOT/deploy/nginx/gojetbtrewrite.conf" || { echo 'upload alias route is missing' >&2; exit 1; }
for config in "$ROOT/deploy/nginx/gojetbtrewrite.conf" "$ROOT/deploy/nginx/gojet.conf" "$ROOT/deploy/nginx/gojethost.conf" "$ROOT/deploy/nginx/gojetnative.conf"; do
  grep -Eq '\^/t/|location [^[:space:]]* /t/' "$config" || { echo "public text route missing in $config" >&2; exit 1; }
  grep -Eq '\^/p/|location [^[:space:]]* /p/' "$config" || { echo "public bio route missing in $config" >&2; exit 1; }
  grep -Eq '\^/f/|location [^[:space:]]* /f/' "$config" || { echo "public file route missing in $config" >&2; exit 1; }
done
if sed -n '/location \^~ \/uploads\//,/^}/p' "$ROOT/deploy/nginx/gojetbtrewrite.conf" | grep -Fq 'try_files'; then
  echo 'upload alias must not use try_files' >&2; exit 1
fi

grep -Fq 'ExecStart=__GOJET_ROOT__/scripts/nativeinstallerrun.sh' "$ROOT/deploy/native/gojetinstaller.service" || { echo 'privileged installer runtime guard is not wired' >&2; exit 1; }
grep -Fq 'stop_existing_services' "$ROOT/scripts/nativeinstallerrun.sh" || { echo 'installer does not stop stale GoJet services' >&2; exit 1; }
grep -Fq 'information_schema.tables' "$ROOT/scripts/nativeinstallerrun.sh" || { echo 'fresh installer does not reject a non-empty database' >&2; exit 1; }
grep -Fq '/proc/$pid/exe' "$ROOT/scripts/nativeinstallerrun.sh" || { echo 'fresh installer does not verify running executables' >&2; exit 1; }
grep -Fq 'totp_enabled' "$ROOT/scripts/nativeinstallerrun.sh" || { echo 'fresh installer does not verify initial administrator MFA state' >&2; exit 1; }

(cd "$ROOT" && sha256sum -c MANIFEST.sha256 >/dev/null)
actual=$(sed -n '/^services:$/,/^volumes:$/p' "$ROOT/deploy/compose.production.yaml" | sed -n 's/^  \([a-z][a-z0-9-]*\):$/\1/p' | sort | tr '\n' ' ')
expected='analyticsreconciler analyticsworker clamav fileworker logreceiver mailworker mysql nginx operationsmonitor platformapi redirectengine redis '
[ "$actual" = "$expected" ] || { echo "production Compose service set is invalid: $actual" >&2; exit 1; }
printf 'runtime-only fresh-install release verification passed: %s\n' "$ARCHIVE"
