import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'dist');
const lower = path.join(root, 'zh-cn');
const upper = path.join(root, 'zh-CN');

function hasChineseHome(dir) {
  const index = path.join(dir, 'index.html');
  return fs.existsSync(index) && /GoJet 帮助|简体中文|工作区/.test(fs.readFileSync(index, 'utf8'));
}

if (!hasChineseHome(upper) && hasChineseHome(lower)) {
  if (fs.existsSync(upper)) fs.rmSync(upper, { recursive: true, force: true });
  fs.renameSync(lower, upper);
} else if (fs.existsSync(lower)) {
  fs.rmSync(lower, { recursive: true, force: true });
}

if (!hasChineseHome(upper)) throw new Error('Simplified Chinese documentation home was not generated at /docs/zh-CN/.');

function htmlFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...htmlFiles(absolute));
    else if (entry.name.endsWith('.html')) result.push(absolute);
  }
  return result;
}

for (const file of htmlFiles(root)) {
  const source = fs.readFileSync(file, 'utf8');
  const normalized = source
    .replaceAll('/docs/zh-cn', '/docs/zh-CN')
    .replaceAll('/docs/zh-CN/zh-cn/', '/docs/zh-CN/')
    .replaceAll('hreflang="zh-cn"', 'hreflang="zh-CN"');
  if (normalized !== source) fs.writeFileSync(file, normalized);
}

if (fs.existsSync(lower)) throw new Error('Lowercase duplicate /docs/zh-cn/ still exists after locale normalization.');
console.log('Documentation locale routes normalized: English at /docs/ and Simplified Chinese at /docs/zh-CN/ only.');
