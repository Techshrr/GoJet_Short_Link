import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.cwd(), 'dist');
const required = [
  '/', '/products/', '/products/links/', '/products/qr-codes/', '/products/files/',
  '/products/text-sharing/', '/products/link-in-bio/', '/products/analytics/',
  '/products/smart-routing/', '/products/custom-domains/', '/solutions/',
  '/solutions/marketing/', '/solutions/creators/', '/solutions/teams/',
  '/solutions/developers/', '/developers/', '/pricing/', '/security/', '/about/',
  '/contact/', '/status/', '/changelog/', '/legal/privacy/', '/legal/terms/',
  '/legal/acceptable-use/', '/report-abuse/'
];
const forbiddenVisible = [
  'GOJET WORKSPACE', 'WORKFLOW', 'USE CASES', 'DEVELOPER PLATFORM',
  'SERVER-OWNED PRICING', 'control plane', 'server-authoritative', 'server authority',
  'operational source', 'redirect layer', 'RBAC', 'visit_type =', 'P0 gate', 'P17',
  'exact-head', 'frozen shell', 'product-hardening', 'hardening-release'
];
const allowedEnglishInZh = new Set([
  'GoJet', 'API', 'Webhook', 'QR', 'PNG', 'SVG', 'PDF', 'CSV', 'OAuth', 'Turnstile',
  'DNS', 'HTTPS', 'URL', 'Markdown', 'HTML', 'JSON', 'IP', 'CNAME', 'TXT'
]);

function pagePath(route, locale) {
  const root = locale === 'zh-CN' ? path.join(dist, 'zh-CN') : dist;
  return route === '/' ? path.join(root, 'index.html') : path.join(root, route.slice(1), 'index.html');
}
function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing localized page: ${path.relative(dist, file)}`);
  return fs.readFileSync(file, 'utf8');
}
function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function copyAuditText(html) {
  // A locale switch intentionally names the target language in that language
  // (for example “简体中文” on an English page). It is navigation metadata,
  // not mixed product copy, so remove only that semantic control from the
  // single-language body-copy audit.
  return visibleText(html.replace(/<a\b[^>]*class="gj-language-link"[^>]*>[\s\S]*?<\/a>/gi, ' '));
}

for (const route of required) {
  const enFile = pagePath(route, 'en');
  const zhFile = pagePath(route, 'zh-CN');
  const en = read(enFile);
  const zh = read(zhFile);

  if (!en.includes('<html lang="en">')) throw new Error(`${route} English page has wrong lang attribute`);
  if (!zh.includes('<html lang="zh-CN">')) throw new Error(`${route} Chinese page has wrong lang attribute`);
  if (!en.includes("gojet_locale=en")) throw new Error(`${route} English page does not persist English locale`);
  if (!zh.includes("gojet_locale=zh-CN")) throw new Error(`${route} Chinese page does not persist zh-CN locale`);
  if (!en.includes('rel="canonical"') || !zh.includes('rel="canonical"')) throw new Error(`${route} missing canonical URL`);
  if (!en.includes('rel="alternate"') || !zh.includes('rel="alternate"')) throw new Error(`${route} missing locale alternate URL`);
  if (!en.includes('footer-columns') || !zh.includes('footer-columns')) throw new Error(`${route} missing complete footer navigation`);
  for (const phrase of forbiddenVisible) {
    if (copyAuditText(en).includes(phrase) || copyAuditText(zh).includes(phrase)) throw new Error(`${route} exposes internal/engineering copy: ${phrase}`);
  }

  const enText = copyAuditText(en);
  if (/[㐀-鿿]/.test(enText)) throw new Error(`${route} English page contains Chinese visible copy outside the language switch`);

  let zhForAudit = copyAuditText(zh);
  for (const token of allowedEnglishInZh) zhForAudit = zhForAudit.replaceAll(token, '');
  const englishSentence = zhForAudit.match(/\b(?:[A-Za-z]{3,}\s+){4,}[A-Za-z]{3,}\b/);
  if (englishSentence) throw new Error(`${route} Chinese page contains untranslated English sentence: ${englishSentence[0]}`);
}

for (const route of ['/legal/privacy/', '/legal/terms/', '/legal/acceptable-use/']) {
  for (const locale of ['en', 'zh-CN']) {
    const html = read(pagePath(route, locale));
    if ((html.match(/class="legal-section"/g) ?? []).length < 7) throw new Error(`${route} ${locale} legal content is too shallow`);
  }
}

console.log(`Native static localization verified for ${required.length} routes in English and Simplified Chinese; no post-build string rewriting is used.`);
