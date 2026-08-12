#!/usr/bin/env bash
set -euo pipefail
BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
req(){ local m=$1 p=$2 b=${3:-} t=${4:-}; local a=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$t" ]]&&a+=(-H "Authorization: Bearer $t"); [[ -n "$b" ]]&&a+=(--data "$b"); curl "${a[@]}" "$BASE$p"; }
expect(){ local want=$1 raw=$2 label=$3; local got body; got=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$got" == "$want" ]]||{ echo "FAIL $label expected $want got $got" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }
field(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }

admin=$(expect 200 "$(req POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" admin-login|field "['token']")

expect 200 "$(req PUT /api/admin/settings/basic '{"site.name":"GoJet","site.short_name":"GoJet","site.tagline":"让每一次分享更简单","site.description":"链接与内容分享平台","site.language":"zh-CN","site.timezone":"Asia/Shanghai","site.contact_email":"contact@example.test","site.support_email":"support@example.test","site.company_name":"GoJet Test","site.company_address":"Acceptance Environment","site.copyright":"GoJet"}' "$admin")" save-basic >/dev/null
expect 200 "$(req PUT /api/admin/settings/seo '{"seo.default_title":"GoJet","seo.title_template":"%s | GoJet","seo.meta_description":"链接与内容分享平台","seo.meta_keywords":"短链接,二维码,分享","seo.canonical_url":"https://gojet.example.test","seo.robots":"index,follow","seo.sitemap":true,"seo.verification":"acceptance-token"}' "$admin")" save-seo >/dev/null
expect 200 "$(req PUT /api/admin/settings/registration '{"registration.enabled":true,"registration.require_email_verification":false,"registration.forgot_password":true,"registration.password_min_length":12,"registration.login_rate_limit":10,"registration.blocked_domains":"blocked.example","turnstile.site_key":"1x00000000000000000000AA","turnstile.secret":"1x0000000000000000000000000000000AA"}' "$admin")" save-registration >/dev/null
expect 200 "$(req PUT /api/admin/settings/links '{"links.default_domain":"","links.default_redirect_status":302,"links.code_length":7,"links.allowed_characters":"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789","links.reserved_codes":"admin\napi","links.blocked_keywords":"malware","links.default_expiry_days":0,"links.default_click_limit":0,"links.force_https":false}' "$admin")" save-links >/dev/null
expect 200 "$(req PUT /api/admin/settings/privacy '{"analytics.enabled":true,"analytics.retention_days":90,"analytics.record_full_referer":false,"analytics.record_city":true,"analytics.exclude_bots":true,"analytics.visitor_window_hours":24,"privacy.cookie_policy":true,"privacy.periodic_cleanup":true}' "$admin")" save-privacy >/dev/null
expect 200 "$(req PUT /api/admin/settings/runtime '{"api.enabled":true,"cache.enabled":true,"cache.default_ttl_seconds":300}' "$admin")" save-runtime >/dev/null
expect 200 "$(req PUT /api/admin/settings/payments '{"payments.enabled":false,"payments.default_provider":"alipay","payments.alipay.enabled":false,"payments.alipay.app_id":"acceptance-app","payments.alipay.gateway":"https://openapi.alipay.com/gateway.do"}' "$admin")" save-payments >/dev/null

# Mail deliberately uses raw form field names (host/password/from_email) on its
# dedicated endpoint. These fields must never be routed through the generic
# settings section endpoint, which is how the historical “不允许的设置项” errors
# were produced.
mail_body='{"host":"smtp.example.test","port":587,"username":"acceptance-user","password":"AcceptanceMailPassword!2026","encryption":"starttls","ehlo":"gojet.example.test","from_email":"noreply@example.test","from_name":"GoJet","reply_to":"support@example.test"}'
expect 200 "$(req PUT /api/admin/settings/mail "$mail_body" "$admin")" save-mail-dedicated-contract >/dev/null

all=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback)
printf '%s' "$all" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['basic']['site.name']=='GoJet'; assert d['basic']['site.support_email']=='support@example.test'; assert d['seo']['seo.sitemap'] is True; assert d['seo']['seo.verification']=='acceptance-token'; assert d['registration']['registration.password_min_length']==12; assert d['registration']['registration.login_rate_limit']==10; assert d['registration']['turnstile.site_key']=='1x00000000000000000000AA'; assert d['registration']['turnstile.secret']=='********'; assert d['links']['links.code_length']==7; assert d['links']['links.default_redirect_status']==302; assert d['privacy']['analytics.retention_days']==90; assert d['privacy']['analytics.record_full_referer'] is False; assert d['runtime']['cache.default_ttl_seconds']==300; assert d['payments']['payments.default_provider']=='alipay'; assert d['payments']['payments.alipay.app_id']=='acceptance-app'"

# A valid canonical key submitted through an older/stale UI section must be
# canonicalized instead of falsely rejected. Actually unknown/raw keys remain
# rejected so UI mistakes cannot silently create shadow settings.
expect 200 "$(req PUT /api/admin/settings/basic '{"seo.sitemap":false}' "$admin")" stale-ui-valid-key >/dev/null
all2=$(expect 200 "$(req GET /api/admin/settings '' "$admin")" readback-canonical)
printf '%s' "$all2" | python3 -c 'import json,sys; assert json.load(sys.stdin)["seo"]["seo.sitemap"] is False'
for bad in code password email; do
  raw=$(req PUT /api/admin/settings/links "{\"$bad\":\"must-not-be-accepted\"}" "$admin")
  expect 422 "$raw" "reject-raw-$bad-setting" >/dev/null
done
raw=$(req PUT /api/admin/settings/seo '{"seo.this_key_does_not_exist":true}' "$admin")
expect 422 "$raw" reject-unknown-setting >/dev/null

printf 'GoJet settings/payment/mail/Turnstile contract round-trip acceptance: PASS\n'