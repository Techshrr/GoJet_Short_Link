#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

candidate=ROOT/'.github/workflows/product-rebuild-candidate-gate.yml'
text=candidate.read_text()
if 'bash tests/integration/admin-permission-boundary.sh' not in text:
    text=text.replace('bash tests/integration/admin-link-lifecycle.sh','bash tests/integration/admin-link-lifecycle.sh\n          bash tests/integration/admin-permission-boundary.sh')
candidate.write_text(text)

verify=ROOT/'scripts/verify-release.sh'; text=verify.read_text()
text=text.replace('public/login/index.html public/register/index.html public/forgot-password/index.html public/reset-password/index.html public/verify-email/index.html', 'public/login/index.html public/register/index.html public/forgot-password/index.html public/reset-password/index.html public/verify-email/index.html public/announcements/index.html')
text=text.replace('public/assets/auth.js public/assets/auth.css public/assets/home.js public/assets/home.css', 'public/assets/auth.js public/assets/auth.css public/assets/home.js public/assets/home.css public/assets/announcements.js public/assets/announcements.css public/assets/product.css')
checks='''\ngrep -Fq '只有超级管理员可以创建管理员账户' "$ROOT/services/platform-api/cmd/server/admin_identity.go" || { echo 'super-admin administrator mutation boundary is missing' >&2; exit 1; }\ngrep -Fq '/api/public/announcements' "$ROOT/public/assets/announcements.js" || { echo 'public announcement center is not connected' >&2; exit 1; }\ngrep -Fq 'Markdown 正文' "$ROOT/public/admin/app.js" || { echo 'Markdown announcement editor is missing' >&2; exit 1; }\n'''
if 'super-admin administrator mutation boundary is missing' not in text:
    anchor="grep -Fq 'data-link-toggle' \"$ROOT/public/admin/product-actions.js\" || { echo 'administrator link operations are missing' >&2; exit 1; }"
    text=text.replace(anchor,anchor+checks)
verify.write_text(text)

validation=ROOT/'.github/workflows/installer-release.yml'; text=validation.read_text()
if 'node --check frontend/marketing-site/assets/announcements.js' not in text:
    text=text.replace('node --check frontend/marketing-site/assets/home.js','node --check frontend/marketing-site/assets/home.js\n          node --check frontend/marketing-site/assets/announcements.js')
if "grep -Fq '只有超级管理员可以创建管理员账户' services/platform-api/cmd/server/admin_identity.go" not in text:
    text=text.replace("grep -Fq 'AllowedAdministrator' app/adminauth/service.go", "grep -Fq 'AllowedAdministrator' app/adminauth/service.go\n          grep -Fq '只有超级管理员可以创建管理员账户' services/platform-api/cmd/server/admin_identity.go")
validation.write_text(text)
print('final V4 release gates converged')
