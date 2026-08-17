import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const requiredFile = (relative) => {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) throw new Error(`Missing required P02 file: ${relative}`);
  return fs.readFileSync(full, 'utf8');
};
const requireAll = (label, content, needles) => {
  for (const needle of needles) {
    if (!content.includes(needle)) throw new Error(`${label} missing required contract: ${needle}`);
  }
};

const tokens = requiredFile('packages/tokens/src/tokens.css');
requireAll('tokens', tokens, [
  '--brand-ink:', '--brand-blue:', '--brand-blue-strong:', '--brand-cyan:', '--brand-sky:',
  '--canvas-light:', '--surface-elevated-light:', '--foreground-muted-light:', '--border-strong-light:',
  '--canvas-dark:', '--surface-elevated-dark:', '--foreground-muted-dark:', '--border-strong-dark:',
  '--success:', '--success-subtle:', '--warning:', '--warning-subtle:', '--danger:', '--danger-subtle:', '--info:', '--info-subtle:',
  '--font-latin:', '--font-cjk:', '--font-product:', '--space-24:', '--radius-2xl:', '--shadow-e3:', '--focus-ring:',
  '--website-header-height:', '--docs-sidebar-width:', '--workspace-sidebar-width:', '--admin-sidebar-width:',
  '[data-theme="light"]', '[data-theme="dark"]', 'prefers-color-scheme: dark', ':root:not([data-theme])'
]);

const theme = requiredFile('packages/tokens/src/theme.ts');
requireAll('theme helper', theme, ['"light", "dark", "system"', 'removeAttribute("data-theme")', 'setAttribute("data-theme", preference)']);

const motion = requiredFile('packages/motion/src/motion.css');
requireAll('motion', motion, [
  '--motion-feedback-fast:', '--motion-transition:', '--motion-product:', '--motion-ambient-a:', '--motion-ambient-b:',
  'gojet-brand-breathe-a', 'gojet-product-float', 'gojet-jet-path-progress', 'prefers-reduced-motion: reduce', 'animation: none !important'
]);

const icons = requiredFile('packages/icons/src/index.ts');
requireAll('icon policy', icons, ['library: "lucide"', 'strokeWidth: 1.75', 'sidebar: 18', 'emptyState: 32']);
requireAll('brand license register', requiredFile('packages/icons/BRAND-ASSET-LICENSES.md'), ['Official brand kit', 'Simple Icons']);
requireAll('visual attribution register', requiredFile('assets/ATTRIBUTION.md'), ['self-hosted', 'Product screenshots']);
requireAll('logo contract', requiredFile('assets/brand/README.md'), [
  'logo-full-light.svg', 'logo-full-dark.svg', 'logo-mark.svg', 'favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'og-brand.png'
]);

const sourceExtensions = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.html', '.astro', '.mdx']);
const ignoredDirs = new Set(['node_modules', 'dist', '.astro']);
const hex = /#[0-9a-fA-F]{3,8}\b/g;
const offenders = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    const text = fs.readFileSync(full, 'utf8');
    const matches = text.match(hex);
    if (matches) offenders.push(`${path.relative(root, full)}: ${[...new Set(matches)].join(', ')}`);
  }
}
scan(path.join(root, 'apps'));
if (offenders.length) {
  throw new Error(`V5 application source must consume semantic tokens instead of raw hex colors:\n${offenders.join('\n')}`);
}

console.log('P02 brand foundation contract verified.');
