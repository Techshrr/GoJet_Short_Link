#!/usr/bin/env sh
set -eu

[ "$#" -eq 1 ] || { echo "usage: $0 <gojet-production.zip>" >&2; exit 2; }
ARCHIVE=$1
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

"$SCRIPT_DIR/verify-release.sh" "$ARCHIVE"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM
unzip -q "$ARCHIVE" -d "$TMP"
ROOT=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)
[ -n "$ROOT" ] || { echo "release root is missing" >&2; exit 1; }

for path in \
  scripts/verify-hardening-release.sh \
  public/report-abuse/index.html \
  public/privacy/index.html \
  public/terms/index.html \
  public/assets/report-abuse.js \
  public/assets/styles.css \
  public/assets/app.js \
  public/assets/product-brand.css \
  public/app/support-hardening.js \
  public/admin/support-security.js \
  public/admin/admin-smtp-status.js \
  public/admin/admin-mail-template-ui.js \
  deploy/compose.production.yaml \
  scripts/lib.sh \
  database/migrations/032_support_tickets_and_turnstile.sql \
  database/migrations/033_abuse_report_public_url.sql \
  database/migrations/034_mail_brand_fragments.sql \
  services/platform-api/cmd/server/turnstile.go \
  services/platform-api/cmd/server/turnstile_middleware.go \
  services/platform-api/cmd/server/turnstile_public.go \
  services/platform-api/cmd/server/bot_protection_settings.go \
  services/platform-api/cmd/server/support_tickets.go \
  services/platform-api/cmd/server/support_routes.go \
  services/platform-api/cmd/server/abuse_public.go \
  services/platform-api/cmd/server/mail_templates.go \
  app/adminauth/support_permissions.go; do
  [ -e "$ROOT/$path" ] || { echo "hardening release is missing $path" >&2; exit 1; }
done
[ -x "$ROOT/scripts/verify-hardening-release.sh" ] || { echo 'packaged hardening verifier is not executable' >&2; exit 1; }

grep -Fq 'CREATE TABLE support_tickets' "$ROOT/database/migrations/032_support_tickets_and_turnstile.sql" || { echo 'support ticket schema is missing' >&2; exit 1; }
grep -Fq 'CREATE TABLE support_ticket_messages' "$ROOT/database/migrations/032_support_tickets_and_turnstile.sql" || { echo 'support ticket conversation schema is missing' >&2; exit 1; }
grep -Fq "'turnstile.ticket_create'" "$ROOT/database/migrations/032_support_tickets_and_turnstile.sql" || { echo 'ticket Turnstile default is missing' >&2; exit 1; }
grep -Fq 'ADD COLUMN reported_url' "$ROOT/database/migrations/033_abuse_report_public_url.sql" || { echo 'public abuse URL migration is missing' >&2; exit 1; }
grep -Fq "'support_ticket_reply'" "$ROOT/database/migrations/034_mail_brand_fragments.sql" || { echo 'unified support mail fragment is missing' >&2; exit 1; }
! grep -Eiq '<!?doctype|<html|<head|<body' "$ROOT/database/migrations/034_mail_brand_fragments.sql" || { echo 'mail fragment migration contains a full HTML document shell' >&2; exit 1; }

grep -Fq '/api/public/turnstile' "$ROOT/public/assets/auth.js" || { echo 'public authentication Turnstile policy is not connected' >&2; exit 1; }
grep -Fq '/api/public/abuse-reports' "$ROOT/public/assets/report-abuse.js" || { echo 'public abuse report API is not connected' >&2; exit 1; }
grep -Fq '/api/support/tickets' "$ROOT/public/app/support-hardening.js" || { echo 'customer support ticket UI is not connected' >&2; exit 1; }
grep -Fq '/api/admin/support/tickets' "$ROOT/public/admin/support-security.js" || { echo 'administrator support queue is not connected' >&2; exit 1; }
grep -Fq '/api/admin/bot-protection' "$ROOT/public/admin/support-security.js" || { echo 'central Turnstile admin UI is not connected' >&2; exit 1; }
grep -Fq '发送中' "$ROOT/public/admin/admin-smtp-status.js" || { echo 'SMTP pending feedback is missing' >&2; exit 1; }
grep -Fq '这里只编辑邮件内容区' "$ROOT/public/admin/admin-mail-template-ui.js" || { echo 'fragment-aware mail template editor is missing' >&2; exit 1; }
grep -Fq 'mailTemplateIsFragment' "$ROOT/services/platform-api/cmd/server/mail_templates.go" || { echo 'server-side mail fragment guard is missing' >&2; exit 1; }

grep -Fq 'defaultTurnstileVerifyURL' "$ROOT/services/platform-api/cmd/server/turnstile.go" || { echo 'Turnstile Siteverify implementation is missing' >&2; exit 1; }
grep -Fq 'hostnameAllowed' "$ROOT/services/platform-api/cmd/server/turnstile.go" || { echo 'Turnstile hostname validation is missing' >&2; exit 1; }
grep -Fq 'result.Action' "$ROOT/services/platform-api/cmd/server/turnstile.go" || { echo 'Turnstile action validation is missing' >&2; exit 1; }
grep -Fq 'tickets.manage' "$ROOT/app/adminauth/support_permissions.go" || { echo 'explicit support ticket permission is missing' >&2; exit 1; }
grep -Fq 'createPublicAbuseReport' "$ROOT/services/platform-api/cmd/server/abuse_public.go" || { echo 'public abuse intake implementation is missing' >&2; exit 1; }

# Public product/legal pages are part of the product contract. Production must
# use the canonical customer-facing shell and never fall back to engineering copy.
grep -Fq '隐私政策' "$ROOT/public/privacy/index.html" || { echo 'privacy page content is missing' >&2; exit 1; }
grep -Fq '服务条款' "$ROOT/public/terms/index.html" || { echo 'terms page content is missing' >&2; exit 1; }
grep -Fq '/assets/styles.css' "$ROOT/public/products/url-shortener/index.html" || { echo 'canonical product design system is not connected' >&2; exit 1; }
grep -Fq '/assets/app.js' "$ROOT/public/products/url-shortener/index.html" || { echo 'canonical public shell controller is not connected' >&2; exit 1; }
if grep -R -n -E 'Fresh Install|GoJet V4|不是静态演示数据|真实业务接口|Redis Worker|file-worker|analytics_events|RBAC 权限模型|V4 平台 API' \
  "$ROOT/public/products" "$ROOT/public/pricing" "$ROOT/public/about" "$ROOT/public/contact" "$ROOT/public/resources" "$ROOT/public/solutions"; then
  echo 'engineering acceptance copy leaked into public marketing pages' >&2
  exit 1
fi

# Docker production must preserve the same resource ownership boundaries as the
# native/aaPanel deployment: brand images, generated QR images, user uploads and
# protected file storage are independent lifecycles and mounts.
grep -Fq 'SYSTEM_IMAGE_PATH: /data/system/images' "$ROOT/deploy/compose.production.yaml" || { echo 'Docker system image path is missing' >&2; exit 1; }
grep -Fq './data/system/images:/data/system/images' "$ROOT/deploy/compose.production.yaml" || { echo 'Docker platform system-image persistence is missing' >&2; exit 1; }
grep -Fq './data/generated/qr:/data/generated/qr' "$ROOT/deploy/compose.production.yaml" || { echo 'Docker generated-QR persistence is missing' >&2; exit 1; }
grep -Fq './data/system/images:/usr/share/nginx/html/system-images:ro' "$ROOT/deploy/compose.production.yaml" || { echo 'Docker Nginx system-image mount is missing' >&2; exit 1; }
grep -Fq './data/generated/qr:/usr/share/nginx/html/generated/qr:ro' "$ROOT/deploy/compose.production.yaml" || { echo 'Docker Nginx generated-QR mount is missing' >&2; exit 1; }
grep -Fq 'deploy/data/system/images' "$ROOT/scripts/lib.sh" || { echo 'Docker storage bootstrap does not create system images' >&2; exit 1; }
grep -Fq 'deploy/data/generated/qr' "$ROOT/scripts/lib.sh" || { echo 'Docker storage bootstrap does not create generated QR storage' >&2; exit 1; }

# Production archives must contain runtime code but not the CI-only test fixtures.
[ ! -e "$ROOT/services/platform-api/cmd/server/turnstile_test.go" ] || { echo 'Turnstile test source leaked into production package' >&2; exit 1; }
[ ! -e "$ROOT/services/platform-api/cmd/server/abuse_public_test.go" ] || { echo 'abuse-report test source leaked into production package' >&2; exit 1; }
[ ! -e "$ROOT/services/platform-api/cmd/server/mail_templates_test.go" ] || { echo 'mail-template test source leaked into production package' >&2; exit 1; }

printf 'product-hardening release verification passed: %s\n' "$ARCHIVE"