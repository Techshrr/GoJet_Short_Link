import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const surfaceRoots = ['apps/site/src', 'apps/workspace/src', 'apps/admin/src', 'packages/ui/src'];
const visibleAttributes = new Set([
  'title', 'description', 'label', 'help', 'placeholder', 'aria-label', 'alt',
  'triggerLabel', 'confirmLabel', 'cancelLabel', 'emptyLabel', 'loadingLabel'
]);
const engineering = [
  /\bcontrol plane\b/i, /server[- ]authoritative/i, /\bserver authority\b/i,
  /\bredirect layer\b/i, /\bbackend capability\b/i, /\boperational source\b/i,
  /\bexact[- ]head\b/i, /\bfrozen shell\b/i, /\bP(?:0?[1-9]|1[0-9])\b/,
  /\bRBAC\b/, /visit_type\s*=/i, /\bmock(?:ed|ing)?\b/i,
  /\bfake data\b/i, /\bV5 does not\b/i
];
const technicalOnly = /^(?:GoJet(?:\s+Admin)?|API|APIs|Webhook|Webhooks|QR|QR Codes|PNG|SVG|PDF|CSV|OAuth|Turnstile|DNS|HTTPS|HTTP|URL|URLs|IP|CNAME|TXT|JSON|HTML|Markdown|ClamAV|MySQL|Redis|SMTP|TOTP|2FA|UTC|GB|MB|KB|px|[A-Z]{2,8}|[0-9 .:/+%#()_-]+)$/;

const copySources = [
  fs.readFileSync(path.join(root, 'packages/ui/src/locale.tsx'), 'utf8'),
  fs.readFileSync(path.join(root, 'packages/ui/src/locale-copy.ts'), 'utf8')
].join('\n');
const copyKeys = new Set();
for (const match of copySources.matchAll(/(?:^|\n)\s*["']([^"'\n]+)["']\s*:\s*\{\s*en\s*:/g)) copyKeys.add(match[1]);
for (const match of copySources.matchAll(/(?:^|\n)\s*["']([^"'\n]+)["']\s*:\s*\{\s*["']?en["']?\s*:/g)) copyKeys.add(match[1]);

function filesUnder(relative) {
  const base = path.join(root, relative);
  const result = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const absolute = path.join(base, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(path.relative(root, absolute)));
    else if (entry.name.endsWith('.tsx')) result.push(path.relative(root, absolute));
  }
  return result;
}
function human(value) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < 2) return '';
  if (/^(?:https?:\/\/|\/|#|[.#][A-Za-z0-9_-])/.test(text)) return '';
  if (technicalOnly.test(text)) return '';
  if (!/[A-Za-z\u3400-\u9fff]/.test(text)) return '';
  return text;
}
function pairedInSource(source, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`text\\(\\s*["']${escaped}["']\\s*,`).test(source) ||
    new RegExp(`localized\\(\\s*["']${escaped}["']`).test(source);
}
function accepted(source, value) {
  return copyKeys.has(value) || pairedInSource(source, value);
}

const failures = [];
for (const file of surfaceRoots.flatMap(filesUnder)) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function check(value, node, kind) {
    const text = human(value);
    if (!text) return;
    for (const rule of engineering) if (rule.test(text)) failures.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind, text, reason: 'engineering/internal wording' });
    const hasChinese = /[\u3400-\u9fff]/.test(text);
    const hasEnglish = /[A-Za-z]{2}/.test(text);
    if ((hasChinese || hasEnglish) && !accepted(source, text)) failures.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind, text, reason: 'visible literal has no zh-CN/en pair' });
  }
  function visit(node) {
    if (ts.isJsxText(node)) check(node.getText(), node, 'text');
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText())) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) check(init.text, init, `attribute:${node.name.getText()}`);
      if (init && ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) check(init.expression.text, init.expression, `attribute:${node.name.getText()}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

// React error messages returned by the Go API must never force a different script
// into the selected UI. Unknown server messages are handled by localizedError().
const localeSource = fs.readFileSync(path.join(root, 'packages/ui/src/locale.tsx'), 'utf8');
if (!localeSource.includes('export function localizedError')) failures.push({ file: 'packages/ui/src/locale.tsx', line: 1, kind: 'contract', text: 'localizedError', reason: 'missing locale-safe server error fallback' });

if (failures.length) {
  console.error(`VISIBLE_LOCALE_GATE failed with ${failures.length} issue(s). Every visible literal must have an explicit en/zh-CN pair or a registered translation key.`);
  for (const issue of failures.slice(0, 250)) console.error(`${issue.file}:${issue.line} [${issue.kind}] ${issue.reason}: ${JSON.stringify(issue.text)}`);
  if (failures.length > 250) console.error(`... ${failures.length - 250} more issue(s)`);
  process.exit(1);
}
console.log(`VISIBLE_LOCALE_GATE passed: ${surfaceRoots.join(', ')} contain no unpaired visible literals or forbidden engineering wording.`);
