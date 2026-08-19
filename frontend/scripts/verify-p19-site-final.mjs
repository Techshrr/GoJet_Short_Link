import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`Website gate missing required file: ${file}`); };
const must = (file, tokens) => { const source = read(file); for (const token of tokens) if (!source.includes(token)) throw new Error(`Website gate ${file} missing: ${token}`); };
const forbid = (file, tokens) => { const source = read(file); for (const token of tokens) if (source.includes(token)) throw new Error(`Website gate ${file} still contains forbidden copy or contract: ${token}`); };

for (const file of [
  'apps/site/scripts/prerender-static.mjs',
  'apps/site/scripts/localize-static.mjs',
  'apps/site/public/marketing.css',
  'apps/site/public/marketing.js',
  'playwright.site-final.config.ts',
  'tests/site-final/p19-site-final.spec.ts'
]) exists(file);

must('apps/site/package.json', ['prerender-static.mjs', 'localize-static.mjs']);
must('apps/site/scripts/prerender-static.mjs', [
  "pair('Privacy Policy', '隐私政策')",
  "pair('Terms of Service', '服务条款')",
  "pair('Acceptable Use Policy', '可接受使用政策')",
  "pair('Report Abuse', '举报滥用')",
  "'/legal/privacy/'",
  "'/legal/terms/'",
  "'/legal/acceptable-use/'",
  "'/report-abuse/'",
  'footer-columns',
  'legal-section',
  'rel=\"alternate\"',
  "gojet_locale=${locale === 'zh' ? 'zh-CN' : 'en'}"
]);
must('apps/site/scripts/localize-static.mjs', [
  'Native static localization verified',
  "'/legal/privacy/'",
  "'/legal/terms/'",
  "'/legal/acceptable-use/'",
  'English page contains Chinese visible copy',
  'Chinese page contains untranslated English sentence'
]);
forbid('apps/site/scripts/localize-static.mjs', ['replaceMap(', 'englishRewrite', 'pathTranslations']);

must('apps/site/public/marketing.css', [
  '--max:1280px', 'height:64px', 'height:60px', 'min-height:680px', 'grid-template-columns:46% 54%',
  'height:660px', 'ambient-breathe 8s', 'product-float 6s', 'prefers-reduced-motion:reduce',
  '.footer-columns', '.footer-column', '.legal-layout', '.legal-section', '.report-grid'
]);
must('apps/site/public/marketing.js', ['window.scrollY>=80', 'IntersectionObserver', 'prefers-reduced-motion: reduce']);
must('tests/site-final/p19-site-final.spec.ts', [
  '/legal/privacy/', '/legal/terms/', '/legal/acceptable-use/', '/report-abuse/', '/zh-CN/',
  'footer-columns', 'legal-section'
]);
must('playwright.site-final.config.ts', ['1440', '900', '1280', '800', '390', '844']);

forbid('apps/site/scripts/prerender-static.mjs', [
  'GOJET WORKSPACE', '>WORKFLOW<', '>USE CASES<', 'DEVELOPER PLATFORM', 'SERVER-OWNED PRICING',
  'control plane', 'server-authoritative', 'server authority', 'redirect layer', 'visit_type = qr',
  'exact-head', 'frozen shell'
]);

console.log('Website source contract verified: native en/zh-CN pages, detailed legal routes, complete multi-column footer, task-oriented product copy, responsive motion behavior and localization audits are required before build acceptance.');
