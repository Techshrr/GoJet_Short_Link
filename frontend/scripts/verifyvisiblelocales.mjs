import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const roots = ['apps/site/src', 'apps/workspace/src', 'apps/admin/src', 'packages/ui/src'];
const visibleAttrs = new Set(['title','description','label','help','placeholder','aria-label','alt','triggerLabel','confirmLabel','cancelLabel','emptyLabel','loadingLabel']);
const visibleProps = new Set(['title','description','label','help','placeholder','body','message','emptyLabel','loadingLabel','successMessage','errorMessage','confirmLabel','cancelLabel']);
const badWording = [
  /\bcontrol plane\b/i,/server[- ]authoritative/i,/\bserver authority\b/i,/\bredirect layer\b/i,
  /\bbackend capability\b/i,/\boperational source\b/i,/\bexact[- ]head\b/i,/\bfrozen shell\b/i,
  /\bP(?:0?[1-9]|1[0-9])\b/,/\bRBAC\b/,/visit_type\s*=/i,/\bV5 does not\b/i,/\bserver[- ]enforced\b/i
];
const neutral = /^(?:GoJet(?:\s+Admin)?|API|APIs|Webhook|Webhooks|QR|QR Codes|PNG|SVG|PDF|CSV|OAuth|Turnstile|DNS|HTTPS|HTTP|URL|URLs|IP|CNAME|TXT|JSON|HTML|Markdown|ClamAV|MySQL|Redis|SMTP|TOTP|2FA|UTC|GB|MB|KB|px|ECB|bps|STARTTLS|TLS|EHLO|noindex,nofollow|(?:PNG|SVG|PDF)(?:\s*·\s*(?:PNG|SVG|PDF))+|(?:Asia|Europe|America|Africa|Australia|Pacific)\/[A-Za-z_+-]+|KB\s*·?|[^\s@]+@[^\s@]+\.[^\s@]+|(?:[a-z0-9-]+\.)+[a-z]{2,}|#[0-9a-f]{3,8}|\d+\s*(?:px|KB|MB|GB|%)|[a-z0-9]*\d[a-z0-9-]*|[a-z0-9]+-[a-z0-9-]+|[0-9 .:/+%#()_-]+)$/i;

function name(node){return ts.isIdentifier(node)||ts.isStringLiteralLike(node)?node.text:node.getText().replace(/^['"]|['"]$/g,'');}
function literal(node){return ts.isStringLiteralLike(node)||ts.isNoSubstitutionTemplateLiteral(node)?node.text:undefined;}
function human(value){const text=value.replace(/\s+/g,' ').trim();if(text.length<2||neutral.test(text)||/^(?:https?:\/\/|\/|#)/.test(text))return '';return /[A-Za-z\u3400-\u9fff]/.test(text)?text:'';}
function bad(text){return badWording.some((rule)=>rule.test(text));}
function walkFiles(dir){const out=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const absolute=path.join(dir,entry.name);if(entry.isDirectory())out.push(...walkFiles(absolute));else if(entry.name.endsWith('.tsx'))out.push(absolute);}return out;}

const registry=new Map();
for(const relative of ['packages/ui/src/locale.tsx','packages/ui/src/locale-copy.ts']){
  const source=fs.readFileSync(path.join(root,relative),'utf8');
  const ast=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true,relative.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function visit(node){
    if(ts.isPropertyAssignment(node)&&ts.isObjectLiteralExpression(node.initializer)){
      let en,zh;
      for(const child of node.initializer.properties){if(!ts.isPropertyAssignment(child))continue;const key=name(child.name);const value=literal(child.initializer);if(key==='en')en=value;if(key==='zh-CN')zh=value;}
      if(en!==undefined&&zh!==undefined){const pair={en,zh};registry.set(name(node.name),pair);registry.set(en,pair);registry.set(zh,pair);}
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);
}

function explicitLocaleHelpers(source){
  const helpers=new Set();
  if(!source.includes('useLocale'))return helpers;
  if(/const\s*\{[^}]*\btext\b(?!\s*:)[^}]*\}\s*=\s*useLocale\s*\(/s.test(source))helpers.add('text');
  for(const match of source.matchAll(/\btext\s*:\s*([A-Za-z_$][\w$]*)/g))helpers.add(match[1]);
  const directC=/const\s+c(?:\s*:\s*Copy)?\s*=\s*\(\s*en\s*,\s*(?:cn|zh)\s*\)\s*=>[\s\S]{0,120}(?:locale\s*===\s*["']zh-CN["']|\bzh\s*\?)/.test(source);
  const copyHook=/function\s+useCopy\s*\([^)]*\)[\s\S]{0,240}locale\s*===\s*["']zh-CN["'][\s\S]{0,120}return[\s\S]{0,120}\(\s*en\s*,\s*zh\s*\)/.test(source)&&/const\s+c\s*=\s*useCopy\s*\(\s*\)/.test(source);
  if(directC||copyHook)helpers.add('c');
  return helpers;
}
function explicitLocaleConditional(node){
  if(!ts.isConditionalExpression(node))return false;
  const condition=node.condition.getText();
  const branches=literal(node.whenTrue)!==undefined&&literal(node.whenFalse)!==undefined;
  return branches&&/(?:locale|value\.locale)\s*={2,3}\s*["']zh-CN["']|["']zh-CN["']\s*={2,3}\s*(?:locale|value\.locale)/.test(condition);
}

const failures=[];
const publicFiles=roots.flatMap((relative)=>walkFiles(path.join(root,relative))).filter((absolute)=>!absolute.endsWith(path.join('apps','site','src','routes','DevUi.tsx')));
for(const absolute of publicFiles){
  const relative=path.relative(root,absolute);
  const source=fs.readFileSync(absolute,'utf8');
  const ast=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const helpers=explicitLocaleHelpers(source);
  const local=new Map();
  function localeCall(node){return ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&helpers.has(node.expression.text)&&node.arguments.length>=2;}
  function collect(node){
    if(localeCall(node)){const en=literal(node.arguments[0]);const zh=literal(node.arguments[1]);if(en!==undefined&&zh!==undefined){const pair={en,zh};local.set(en,pair);local.set(zh,pair);}}
    if(explicitLocaleConditional(node)){const a=literal(node.whenTrue);const b=literal(node.whenFalse);if(a!==undefined&&b!==undefined){const pair={en:a,zh:b};local.set(a,pair);local.set(b,pair);}}
    ts.forEachChild(node,collect);
  }
  collect(ast);
  function report(node,kind,text,reason){failures.push(`${relative}:${ast.getLineAndCharacterOfPosition(node.getStart()).line+1} [${kind}] ${reason}: ${JSON.stringify(text)}`);}
  function check(node,kind,value){
    const text=human(value);if(!text)return;
    const pair=local.get(text)||registry.get(text);
    if(!pair){report(node,kind,text,'visible text has no explicit en/zh-CN pair');return;}
    if(bad(pair.en)||bad(pair.zh))report(node,kind,text,'visible translation still contains internal engineering wording');
  }
  function renderedExpression(node){
    if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)||ts.isJsxFragment(node))return;
    if(localeCall(node)||explicitLocaleConditional(node))return;
    const value=literal(node);if(value!==undefined){check(node,'jsx-expression',value);return;}
    if(ts.isParenthesizedExpression(node))return renderedExpression(node.expression);
    if(ts.isConditionalExpression(node)){renderedExpression(node.whenTrue);renderedExpression(node.whenFalse);return;}
    if(ts.isTemplateExpression(node))return;
  }
  function visit(node){
    if(ts.isJsxText(node))check(node,'jsx-text',node.getText());
    if(ts.isJsxAttribute(node)&&visibleAttrs.has(node.name.getText())){const init=node.initializer;if(init&&ts.isStringLiteral(init))check(init,`attribute:${node.name.getText()}`,init.text);else if(init&&ts.isJsxExpression(init)&&init.expression)renderedExpression(init.expression);}
    if(ts.isPropertyAssignment(node)&&visibleProps.has(name(node.name))){const value=literal(node.initializer);if(value!==undefined)check(node.initializer,`property:${name(node.name)}`,value);}
    if(localeCall(node)){const en=literal(node.arguments[0]);const zh=literal(node.arguments[1]);if(en!==undefined&&zh!==undefined&&(bad(en)||bad(zh)))report(node,`${node.expression.text}()`,`${en} / ${zh}`,'localized visible copy contains internal engineering wording');}
    ts.forEachChild(node,visit);
  }
  visit(ast);
}

const localeSource=fs.readFileSync(path.join(root,'packages/ui/src/locale.tsx'),'utf8');
if(!localeSource.includes('export function localizedError'))failures.push('packages/ui/src/locale.tsx missing localizedError() server-message localization contract');
if(!localeSource.includes('const reverse = new Map'))failures.push('packages/ui/src/locale.tsx missing bidirectional locale lookup');
if(failures.length){console.error(`VISIBLE_LOCALE_GATE failed with ${failures.length} issue(s).`);for(const item of failures.slice(0,500))console.error(item);if(failures.length>500)console.error(`... ${failures.length-500} more`);process.exit(1);}
console.log(`VISIBLE_LOCALE_GATE passed for ${publicFiles.length} production TSX files.`);
