#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Repository-level naming/schema and accidental legacy exposure.
python3 scripts/checknames.py
python3 scripts/checkschema.py
if grep -R -I -n -E 'playwright install --with-deps' .github/workflows; then
  echo 'Playwright must not invoke apt implicitly.' >&2
  exit 1
fi
if grep -R -I -n -E 'frontend/(publicsite|userconsole|adminconsole)' scripts/packagerelease.sh; then
  echo 'Legacy frontend is referenced by the production packager.' >&2
  exit 1
fi

# Canonical frontend build, localization and browser contracts.
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm check

for required in \
  apps/site/dist/index.html \
  apps/site/dist/zh-CN/index.html \
  apps/site/dist/legal/privacy/index.html \
  apps/site/dist/legal/terms/index.html \
  apps/site/dist/legal/acceptable-use/index.html \
  apps/site/dist/zh-CN/legal/privacy/index.html \
  apps/site/dist/zh-CN/legal/terms/index.html \
  apps/site/dist/zh-CN/legal/acceptable-use/index.html \
  apps/site/dist/report-abuse/index.html \
  apps/site/dist/reportabuse/index.html \
  apps/workspace/dist/index.html \
  apps/admin/dist/index.html \
  apps/docs/dist/index.html \
  apps/docs/dist/zh-CN/index.html; do
  test -s "$required" || { echo "Missing production surface: $required" >&2; exit 1; }
done

test ! -e apps/site/dist/dev || { echo 'Internal design verification route is publicly built.' >&2; exit 1; }
test ! -e apps/docs/dist/zh-cn || { echo 'Duplicate lowercase documentation locale is present.' >&2; exit 1; }

grep -Fq 'footer-columns' apps/site/dist/index.html
grep -Fq 'footer-columns' apps/site/dist/zh-CN/index.html
for page in privacy terms acceptable-use; do
  test "$(grep -o 'class="legal-section"' "apps/site/dist/legal/$page/index.html" | wc -l | tr -d ' ')" -ge 7
  test "$(grep -o 'class="legal-section"' "apps/site/dist/zh-CN/legal/$page/index.html" | wc -l | tr -d ' ')" -ge 7
done

grep -Fq 'data-abuse-report-form' apps/site/dist/reportabuse/index.html || {
  # SPA entry contains the application bundle rather than prerendered form text;
  # make sure the source route is bundled and the entry exists.
  grep -Fq 'ReportAbusePage' apps/site/src/router.tsx
}
grep -Fq '/api/public/abuse-reports' apps/site/src/routes/ReportAbusePage.tsx
grep -Fq 'surface="abuse"' apps/site/src/routes/ReportAbusePage.tsx

# Generated public pages must not expose the internal implementation vocabulary
# that previously appeared as headings, descriptions or labels.
BANNED='GOJET WORKSPACE|USE CASES|DEVELOPER PLATFORM|SERVER-OWNED PRICING|control plane|server-authoritative|server authority|redirect layer|backend capability|operational source|exact-head|frozen shell|visit_type[[:space:]]*=[[:space:]]*qr'
if grep -R -I -n -E "$BANNED" apps/site/dist --include='*.html'; then
  echo 'Engineering/internal wording is visible in the public website build.' >&2
  exit 1
fi

# Authentication, account and product surfaces must all use the shared locale
# provider; server errors must have a locale-safe presentation path.
grep -Fq 'LocaleProvider' apps/site/src/main.tsx
grep -Fq 'LocaleProvider' apps/workspace/src/main.tsx
grep -Fq 'LocaleProvider' apps/admin/src/main.tsx
grep -Fq 'localizedError' packages/ui/src/locale.tsx
grep -Fq 'const reverse = new Map' packages/ui/src/locale.tsx
grep -Fq '/api/admin/auth/me' apps/admin/src/AdminShell.tsx
grep -Fq '/api/admin/auth/login' apps/admin/src/AdminLoginPage.tsx
grep -Fq 'gojet_admin_session' ../services/platformapi/cmd/server/adminidentity.go

# Documentation root must be real English content, not a redirect/flash page.
if grep -R -I -n -E 'Continue to GoJet Docs|http-equiv="refresh"' apps/docs/dist --include='*.html'; then
  echo 'Documentation contains a redirect flash page.' >&2
  exit 1
fi

grep -q -E 'GoJet (Help|Documentation)' apps/docs/dist/index.html
grep -q -E 'GoJet (帮助|文档)' apps/docs/dist/zh-CN/index.html

# Run fixed browser suites that exercise the surfaces the user sees.
corepack pnpm test:site-final
corepack pnpm test:shells
corepack pnpm test:auth
corepack pnpm test:account
corepack pnpm test:admin
corepack pnpm test:workspace
corepack pnpm test:docs
cd "$ROOT"

# Back-end and production routing contracts.
go test ./...
go vet ./...
for config in deploy/nginx/gojet.conf deploy/nginx/gojethost.conf deploy/nginx/gojetnative.conf deploy/nginx/gojetbtrewrite.conf; do
  grep -Fq 'try_files $uri $uri.html $uri/index.html' "$config"
done

# Build and validate the actual production archive. This catches the historic
# gap where V5 source was correct but the release ZIP still shipped legacy UI.
VERSION="v5.0.2audit$(git rev-parse --short HEAD)"
ARCHIVE="$(scripts/packagerelease.sh "$VERSION" | tail -1)"
test -s "$ARCHIVE"
scripts/verifyrelease.sh "$ARCHIVE"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ARCHIVE" -d "$TMP"
PKG="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"
for required in \
  public/index.html public/zh-CN/index.html \
  public/legal/privacy/index.html public/legal/terms/index.html public/legal/acceptable-use/index.html \
  public/zh-CN/legal/privacy/index.html public/zh-CN/legal/terms/index.html public/zh-CN/legal/acceptable-use/index.html \
  public/report-abuse/index.html public/reportabuse/index.html \
  public/app/index.html public/admin/index.html public/docs/index.html public/docs/zh-CN/index.html; do
  test -s "$PKG/$required" || { echo "Release archive missing: $required" >&2; exit 1; }
done
test ! -e "$PKG/public/dev"

printf 'FINAL_SYSTEM_AUDIT=PASS\n'
