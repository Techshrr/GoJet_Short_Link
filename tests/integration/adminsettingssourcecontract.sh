#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

canonical='frontend/adminconsole/settings.js'
core='frontend/adminconsole/app.js'
index='frontend/adminconsole/index.html'
mail='frontend/adminconsole/mailstatus.js'
mail_templates='frontend/adminconsole/mailtemplates.js'
bot='frontend/adminconsole/supportsecurity.js'

test -f "$canonical"
test -f "$core"
test -f "$index"
test -f "$mail"
test -f "$mail_templates"
test -f "$bot"

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
  'async function deleteBrand('
do
  if grep -Fq "$legacy" "$core"; then
    echo "administrator settings implementation leaked back into app.js: $legacy" >&2
    exit 1
  fi
done

app_line=$(grep -n '<script src="/admin/app.js"></script>' "$index" | cut -d: -f1)
mail_line=$(grep -n '<script src="/admin/mailstatus.js"></script>' "$index" | cut -d: -f1)
settings_line=$(grep -n '<script src="/admin/settings.js"></script>' "$index" | cut -d: -f1)
bot_line=$(grep -n '<script src="/admin/supportsecurity.js"></script>' "$index" | cut -d: -f1)
test -n "$app_line" -a -n "$mail_line" -a -n "$settings_line" -a -n "$bot_line"
test "$app_line" -lt "$mail_line"
test "$mail_line" -lt "$settings_line"
test "$settings_line" -lt "$bot_line"

printf 'administrator settings IA and single-owner source contract: PASS\n'
