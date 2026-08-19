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
const visibleProperties = new Set([
  'title', 'description', 'label', 'help', 'placeholder', 'body', 'message', 'emptyLabel',
  'loadingLabel', 'successMessage', 'errorMessage', 'confirmLabel', 'cancelLabel'
]);
const engineering = [
  /\bcontrol plane\b/i,
  /server[- ]authoritative/i,
  /\bserver authority\b/i,
  /\bredirect layer\b/i,
  /\bbackend capability\b/i,
  /\boperational source\b/i,
  /\bexact[- ]head\b/i,
  /\bfrozen shell\b/i,
  /\bP(?:0?[1-9]|1[0-9])\b/,
  /\bRBAC\b/,
  /visit_type\s*=/i,
  /\bmock(?:ed|ing)?\b/i,
  /\bfake data\b/i,
  /\bV5 does not\b/i,
  /\bserver[- ]enforced\b/i,
  /\bbackend service\b/i
];
const technicalOnly = /^(?:GoJet(?:\s+Admin)?|API|APIs|Webhook|Webhooks|QR|QR Codes|PNG|SVG|PDF|CSV|OAuth|Turnstile|DNS|HTTPS|HTTP|URL|URLs|IP|CNAME|TXT|JSON|HTML|Markdown|ClamAV|MySQL|Redis|SMTP|TOTP|2FA|UTC|GB|MB|KB|px|[A-Z]{2,8}|[0-9 .:/+%#()_-]+)$/;

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

function propertyName(node) {
  if (!node) return '';
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return node.getText().replace(/^['"]|['"]$/g, '');
}

function staticText(node) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

const registryValues = new Set();
for (const localeFile of ['packages/ui/src/locale.tsx', 'packages/ui/src/locale-copy.ts']) {
  const source = fs.readFileSync(path.join(root, localeFile), 'utf8');
  const ast = ts.createSourceFile(localeFile, source, ts.ScriptTarget.Latest, true, localeFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function collect(node) {
    if (ts.isPropertyAssignment(node)) {
      const key = propertyName(node.name);
      if (key && node.parent && ts.isObjectLiteralExpression(node.parent)) {
        const localeChildren = new Map();
        for (const child of node.parent.properties) {
          if (!ts.isPropertyAssignment(child)) continue;
          const childKey = propertyName(child.name);
          const value = staticText(child.initializer);
          if ((childKey === 'en' || childKey === 'zh-CN') && value !== undefined) localeChildren.set(childKey, value);
        }
        if (localeChildren.has('en') && localeChildren.has('zh-CN')) {
          registryValues.add(key);
          registryValues.add(localeChildren.get('en'));
          registryValues.add(localeChildren.get('zh-CN'));
        }
      }
    }
    ts.forEachChild(node, collect);
  }
  collect(ast);
}

function human(value) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length < 2) return '';
  if (/^(?:https?:\/\/|\/|#|[.#][A-Za-z0-9_-])/.test(text)) return '';
  if (technicalOnly.test(text)) return '';
  if (!/[A-Za-z\u3400-\u9fff]/.test(text)) return '';
  return text;
}

const failures = [];
function issue(file, ast, node, kind, text, reason) {
  failures.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind, text, reason });
}

const auditedFiles = surfaceRoots
  .flatMap(filesUnder)
  .filter((file) => file !== 'apps/site/src/routes/DevUi.tsx');

for (const file of auditedFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const locallyPaired = new Set();

  function scanPairs(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'text' && node.arguments.length >= 2) {
      for (const argument of node.arguments.slice(0, 2)) {
        const value = staticText(argument);
        if (value !== undefined) locallyPaired.add(value);
      }
    }
    ts.forEachChild(node, scanPairs);
  }
  scanPairs(ast);

  function checkEngineering(value, node, kind) {
    const text = human(value);
    if (!text) return;
    for (const rule of engineering) if (rule.test(text)) issue(file, ast, node, kind, text, 'engineering/internal wording');
  }

  function checkPair(value, node, kind) {
    const text = human(value);
    if (!text) return;
    checkEngineering(text, node, kind);
    if (!registryValues.has(text) && !locallyPaired.has(text)) issue(file, ast, node, kind, text, 'visible literal has no zh-CN/en pair');
  }

  function insidePairCall(node) {
    let current = node.parent;
    while (current && !ts.isJsxExpression(current) && !ts.isJsxAttribute(current) && !ts.isSourceFile(current)) {
      if (ts.isCallExpression(current) && ts.isIdentifier(current.expression) && (current.expression.text === 'text' || current.expression.text === 'localized')) return true;
      current = current.parent;
    }
    return false;
  }

  // A JSX child expression can contain conditions, class names, input types and
  // other implementation strings. Only expression branches that can themselves
  // render text are audited here; nested JSX is handled by the normal AST walk.
  function scanVisibleExpression(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return;
    if ((ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !insidePairCall(node)) {
      checkPair(node.text, node, 'jsx-expression');
      return;
    }
    if (ts.isParenthesizedExpression(node)) {
      scanVisibleExpression(node.expression);
      return;
    }
    if (ts.isConditionalExpression(node)) {
      scanVisibleExpression(node.whenTrue);
      scanVisibleExpression(node.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      scanVisibleExpression(node.left);
      scanVisibleExpression(node.right);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      if (node.head.text) checkPair(node.head.text, node.head, 'jsx-expression');
      for (const span of node.templateSpans) if (span.literal.text) checkPair(span.literal.text, span.literal, 'jsx-expression');
    }
  }

  function visit(node) {
    if (ts.isJsxText(node)) checkPair(node.getText(), node, 'text');

    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.getText())) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) checkPair(init.text, init, `attribute:${node.name.getText()}`);
      if (init && ts.isJsxExpression(init) && init.expression) scanVisibleExpression(init.expression);
    } else if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      scanVisibleExpression(node.expression);
    }

    if (ts.isPropertyAssignment(node) && visibleProperties.has(propertyName(node.name))) {
      const value = staticText(node.initializer);
      if (value !== undefined) checkPair(value, node.initializer, `property:${propertyName(node.name)}`);
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'text') {
      for (const argument of node.arguments.slice(0, 2)) {
        const value = staticText(argument);
        if (value !== undefined) checkEngineering(value, argument, 'localized-copy');
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(ast);
}

const localeSource = fs.readFileSync(path.join(root, 'packages/ui/src/locale.tsx'), 'utf8');
if (!localeSource.includes('export function localizedError')) failures.push({ file: 'packages/ui/src/locale.tsx', line: 1, kind: 'contract', text: 'localizedError', reason: 'missing locale-safe server error fallback' });
if (!localeSource.includes('const reverse = new Map')) failures.push({ file: 'packages/ui/src/locale.tsx', line: 1, kind: 'contract', text: 'bidirectional locale registry', reason: 'locale lookup must recognize both language values' });

if (failures.length) {
  const unique = new Map();
  for (const item of failures) unique.set(`${item.file}:${item.line}:${item.kind}:${item.reason}:${item.text}`, item);
  const list = [...unique.values()];
  console.error(`VISIBLE_LOCALE_GATE failed with ${list.length} issue(s). Every visible literal must have an explicit en/zh-CN pair or a registered translation key.`);
  for (const item of list.slice(0, 400)) console.error(`${item.file}:${item.line} [${item.kind}] ${item.reason}: ${JSON.stringify(item.text)}`);
  if (list.length > 400) console.error(`... ${list.length - 400} more issue(s)`);
  process.exit(1);
}
console.log(`VISIBLE_LOCALE_GATE passed: ${auditedFiles.length} public product source files contain no unpaired visible literals or forbidden engineering wording.`);
