#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

canonical='frontend/adminconsole/settings.js'
core='frontend/adminconsole/app.js'
index='frontend/adminconsole/index.html'
mail='frontend/adminconsole/mailstatus.js'
mail_templates='frontend/adminconsole/mailtemplates.js'
bot='frontend/adminconsole/supportsecurity.js'
social='frontend/adminconsole/socialauthsettings.js'
browser_config='playwright.config.js'
console_spec='tests/e2e/console.spec.js'
product_spec='tests/e2e/productcore.spec.js'
surface_spec='tests/e2e/fullsurfaceconsistency.spec.js'
social_spec='tests/e2e/socialauthsettings.spec.js'

for file in "$canonical" "$core" "$index" "$mail" "$mail_templates" "$bot" "$social" "$browser_config" "$console_spec" "$product_spec" "$surface_spec" "$social_spec"; do
  test -f "$file"
done

grep -Fq 'renderSettings=async function(){' "$canonical"
grep -Fq 'async function saveUnifiedSection(' "$canonical"
grep -Fq "const mailPane=embeddedPane('mail');" "$canonical"
grep -Fq "const botProtectionPane=embeddedPane('botprotection');" "$canonical"
grep -Fq "window.renderMailSettings(mount,{embedded:true})" "$canonical"
grep -Fq "window.renderBotProtectionSettings(mount,{embedded:true})" "$canonical"

if grep -Fq 'attachSettingsBack' "$canonical"; then
  echo 'mail/bot protection must stay inside the system settings shell; back-button detour found' >&2
  exit 1
fi

if grep -Fq 'data-view="mail"' "$index" || grep -Fq 'data-view="botprotection"' "$index"; then
  echo 'mail/bot protection leaked back into top-level administrator navigation' >&2
  exit 1
fi

grep -Fq 'async function renderMailInto(target=null,options={})' "$mail"
grep -Fq 'activeMailMount=embedded?root:null' "$mail"
grep -Fq 'window.refreshMailSettings=' "$mail"
grep -Fq 'async function renderBotProtectionSettings(target=null,options={})' "$bot"

# Social login is a managed nested System Settings surface. The canonical
# settings renderer remains the owner of the shell; the social module extends
# it without duplicating the base settings implementation.
grep -Fq "const original=window.renderSettings;" "$social"
grep -Fq "button.dataset.ahTab='socialauth'" "$social"
grep -Fq "api('/api/admin/auth/providers')" "$social"
grep -Fq "api('/api/admin/settings/socialauth',{method:'PUT'" "$social"
grep -Fq "data-sensitive=\"1\"" "$social"
grep -Fq "data-social-provider=\"" "$social"
grep -Fq "socialauthsettings.spec.js" .github/workflows/productsurface.yml

for broken in "$mail" "$mail_templates"; do
  if grep -Fq 'renderMail()' "$broken"; then
    echo "stale renderMail() refresh call remains in $broken" >&2
    exit 1
  fi
done

for legacy in \
  'function settingInput(' \
  'async function renderSettings(' \
  'async function saveSettingForm(' \
  'async function saveBrand(' \
  'async function deleteBrand(' \
  'async function renderMailSettings(' \
  'function mailTest(' \
  'function templateModal(' \
  'renderMail()'
do
  if grep -Fq "$legacy" "$core"; then
    echo "retired administrator implementation leaked back into app.js: $legacy" >&2
    exit 1
  fi
done

# The lightweight browser fixture owns 127.0.0.1:4173 only. Analytics Dashboard
# has a dedicated real-runtime/Nginx gate on 127.0.0.1:4180 and must not leak
# into this suite.
grep -Fq "'**/analyticsdashboard.spec.js'" "$browser_config"

# Lightweight browser acceptance must exercise the final IA: top-level System
# Settings first, then embedded mail/Turnstile panes.
grep -Fq "getByRole('button',{name:'系统设置',exact:true}).click()" "$console_spec"
grep -Fq "getByRole('button',{name:/邮件服务/})" "$console_spec"
grep -Fq "getByRole('button',{name:/人机验证/})" "$console_spec"
grep -Fq "getByRole('button',{name:'系统设置',exact:true}).click()" "$product_spec"
grep -Fq "getByRole('button',{name:/^邮件服务/}).click()" "$product_spec"
grep -Fq "getByRole('button',{name:/^人机验证/}).click()" "$product_spec"

# The real Nginx browser surface gate must follow the same information
# architecture. Mail and Turnstile are deliberately absent from adminViews and
# are instead validated as nested System Settings panes.
if grep -E '^const adminViews=.*(mail|botprotection)' "$surface_spec"; then
  echo 'real browser surface contract still treats mail/bot protection as top-level views' >&2
  exit 1
fi
grep -Fq "page.locator('#nav [data-view=\"mail\"]')).toHaveCount(0)" "$surface_spec"
grep -Fq "page.locator('#nav [data-view=\"botprotection\"]')).toHaveCount(0)" "$surface_spec"
grep -Fq "[['邮件服务','邮件服务'],['人机验证','人机验证']]" "$surface_spec"
grep -Fq "data-socialauth-tab" "$social_spec"
grep -Fq "data-social-provider=\"github\"" "$social_spec"
grep -Fq "data-social-provider=\"google\"" "$social_spec"

# Script order is a semantic HTML contract, not a line-format contract. Keep
# this valid when the administrator shell is minified onto one or a few lines.
python3 - "$index" <<'PY'
from pathlib import Path
import sys
html = Path(sys.argv[1]).read_text(encoding='utf-8')
ordered = [
    '<script src="/admin/app.js"></script>',
    '<script src="/admin/mailstatus.js"></script>',
    '<script src="/admin/settings.js"></script>',
    '<script src="/admin/socialauthsettings.js"></script>',
    '<script src="/admin/supportsecurity.js"></script>',
]
positions = [html.find(item) for item in ordered]
if any(pos < 0 for pos in positions):
    raise SystemExit(f'administrator settings script missing: {positions}')
if positions != sorted(positions) or len(set(positions)) != len(positions):
    raise SystemExit(f'administrator settings script order invalid: {positions}')
PY

printf 'administrator settings IA, unique ownership and browser source contract: PASS\n'
