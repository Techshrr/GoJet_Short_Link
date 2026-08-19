import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const file = (...parts) => path.join(root, ...parts);
const read = (name) => fs.readFileSync(file(name), 'utf8');
const exists = (name) => { if (!fs.existsSync(file(name))) throw new Error(`v5.0.2 missing: ${name}`); };
const must = (name, tokens) => { const source = read(name); for (const token of tokens) if (!source.includes(token)) throw new Error(`v5.0.2 ${name} missing: ${token}`); };
const forbid = (name, tokens) => { const source = read(name); for (const token of tokens) if (source.includes(token)) throw new Error(`v5.0.2 ${name} still contains forbidden token: ${token}`); };

const staticRoutes = [
  '', 'products', 'products/links', 'products/qr-codes', 'products/files', 'products/text-sharing',
  'products/link-in-bio', 'products/analytics', 'products/smart-routing', 'products/custom-domains',
  'solutions', 'solutions/marketing', 'solutions/creators', 'solutions/teams', 'solutions/developers',
  'developers', 'pricing', 'security', 'about', 'contact', 'status', 'changelog',
  'legal/privacy', 'legal/terms', 'legal/acceptable-use', 'report-abuse'
];
for (const route of staticRoutes) {
  const en = route ? `apps/site/dist/${route}/index.html` : 'apps/site/dist/index.html';
  const zh = route ? `apps/site/dist/zh-CN/${route}/index.html` : 'apps/site/dist/zh-CN/index.html';
  exists(en); exists(zh);
  must(en, ['<html lang="en">', 'gojet_locale=en', 'footer-columns']);
  must(zh, ['<html lang="zh-CN">', 'gojet_locale=zh-CN', 'footer-columns']);
}
for (const route of ['legal/privacy', 'legal/terms', 'legal/acceptable-use']) {
  must(`apps/site/dist/${route}/index.html`, ['legal-section', 'Last updated:']);
  must(`apps/site/dist/zh-CN/${route}/index.html`, ['legal-section', '最后更新：']);
}

exists('apps/docs/dist/index.html');
exists('apps/docs/dist/zh-CN/index.html');
forbid('apps/docs/dist/index.html', ['Continue to GoJet Docs', 'http-equiv="refresh"']);
forbid('apps/docs/dist/zh-CN/index.html', ['Continue to GoJet Docs']);

for (const source of ['apps/site/src/main.tsx', 'apps/workspace/src/main.tsx', 'apps/admin/src/main.tsx']) must(source, ['LocaleProvider']);
must('packages/ui/src/shells.tsx', ['LocaleSwitch', 'LocalizedSurface']);
must('apps/admin/src/AdminShell.tsx', ['/api/admin/auth/me', 'AdminLoginPage']);
must('apps/admin/src/AdminLoginPage.tsx', ['/api/admin/auth/login']);
must('../services/platformapi/cmd/server/adminidentity.go', ['gojet_admin_session', 'gojet_admin_csrf']);
forbid('apps/admin/src/AdminShell.tsx', ['Ethan H']);
forbid('apps/workspace/src/WorkspaceShell.tsx', ['Ethan H']);

const banned = [
  'GOJET WORKSPACE', 'USE CASES', 'DEVELOPER PLATFORM', 'SERVER-OWNED PRICING',
  'control plane', 'server-authoritative', 'server authority', 'operational source',
  'redirect layer', 'exact-head', 'frozen shell', 'visit_type = qr'
];
for (const route of staticRoutes) {
  for (const prefix of ['', 'zh-CN/']) {
    const name = route ? `apps/site/dist/${prefix}${route}/index.html` : `apps/site/dist/${prefix}index.html`;
    forbid(name, banned);
  }
}

must('scripts/verify-visible-locales.mjs', ['VISIBLE_LOCALE_GATE', 'apps/workspace/src', 'apps/admin/src', 'apps/site/src']);
console.log(`v5.0.2 localization gate verified ${staticRoutes.length} public routes in en/zh-CN, both documentation locales, shared product locale controls, real Admin sessions and strict visible-copy source auditing.`);
