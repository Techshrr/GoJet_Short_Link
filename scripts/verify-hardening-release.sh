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
  public/report-abuse/index.html \
  public/assets/report-abuse.js \
  public/app/support-hardening.js \
  public/admin/support-security.js \
  database/migrations/032_support_tickets_and_turnstile.sql \
  database/migrations/033_abuse_report_public_url.sql \
  services/platform-api/cmd/server/turnstile.go \
  services/platform-api/cmd/server/turnstile_middleware.go \
  services/platform-api/cmd/server/turnstile_public.go \
  services/platform-api/cmd/server/bot_protection_settings.go \
  services/platform-api/cmd/server/support_tickets.go \
  services/platform-api/cmd/server/support_routes.go \
  services/platform-api/cmd/server/abuse_public.go \
  app/adminauth/support_permissions.go; do
  [ -e "$ROOT/$path" ] || { echo "hardening release is missing $path" >&2; exit 1; }
done

grep -Fq 'CREATE TABLE support_tickets' "$ROOT/database/migrations/032_support_tickets_and_turnstile.sql" || { echo 'support ticket schema is missing' >&2; exit 1; }
grep -Fq 'CREATE TABLE support_ticket_messages' "$ROOT/database/migrations/032_support_tickets_and_turnstile.sql" || { echo 'support ticket conversation schema is missing' >&2; exit 1; }
grep -Fq "'turnstile.ticket_create'" "$ROOT/database/migrations/032_support_tickets_and_turnstile.sql" || { echo 'ticket Turnstile default is missing' >&2; exit 1; }
grep -Fq 'ADD COLUMN reported_url' "$ROOT/database/migrations/033_abuse_report_public_url.sql" || { echo 'public abuse URL migration is missing' >&2; exit 1; }

grep -Fq '/api/public/turnstile' "$ROOT/public/assets/auth.js" || { echo 'public authentication Turnstile policy is not connected' >&2; exit 1; }
grep -Fq '/api/public/abuse-reports' "$ROOT/public/assets/report-abuse.js" || { echo 'public abuse report API is not connected' >&2; exit 1; }
grep -Fq '/api/support/tickets' "$ROOT/public/app/support-hardening.js" || { echo 'customer support ticket UI is not connected' >&2; exit 1; }
grep -Fq '/api/admin/support/tickets' "$ROOT/public/admin/support-security.js" || { echo 'administrator support queue is not connected' >&2; exit 1; }
grep -Fq '/api/admin/bot-protection' "$ROOT/public/admin/support-security.js" || { echo 'central Turnstile admin UI is not connected' >&2; exit 1; }

grep -Fq 'defaultTurnstileVerifyURL' "$ROOT/services/platform-api/cmd/server/turnstile.go" || { echo 'Turnstile Siteverify implementation is missing' >&2; exit 1; }
grep -Fq 'hostnameAllowed' "$ROOT/services/platform-api/cmd/server/turnstile.go" || { echo 'Turnstile hostname validation is missing' >&2; exit 1; }
grep -Fq 'result.Action' "$ROOT/services/platform-api/cmd/server/turnstile.go" || { echo 'Turnstile action validation is missing' >&2; exit 1; }
grep -Fq 'tickets.manage' "$ROOT/app/adminauth/support_permissions.go" || { echo 'explicit support ticket permission is missing' >&2; exit 1; }
grep -Fq 'createPublicAbuseReport' "$ROOT/services/platform-api/cmd/server/abuse_public.go" || { echo 'public abuse intake implementation is missing' >&2; exit 1; }

# Production archives must contain runtime code but not the CI-only test fixtures.
[ ! -e "$ROOT/services/platform-api/cmd/server/turnstile_test.go" ] || { echo 'Turnstile test source leaked into production package' >&2; exit 1; }
[ ! -e "$ROOT/services/platform-api/cmd/server/abuse_public_test.go" ] || { echo 'abuse-report test source leaked into production package' >&2; exit 1; }

printf 'product-hardening release verification passed: %s\n' "$ARCHIVE"
