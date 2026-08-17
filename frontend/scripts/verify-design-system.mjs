import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireAll = (label, text, values) => {
  for (const value of values) if (!text.includes(value)) throw new Error(`${label} missing: ${value}`);
};

const uiPackage = JSON.parse(read('packages/ui/package.json'));
if (!uiPackage.dependencies?.['@base-ui/react']) throw new Error('@gojet/ui must be built on @base-ui/react');
if (uiPackage.exports?.['.'] !== './src/index.tsx') throw new Error('@gojet/ui root export must point at the GoJet wrapper surface');

const iconPackage = JSON.parse(read('packages/icons/package.json'));
if (!iconPackage.dependencies?.['lucide-react']) throw new Error('@gojet/icons must bind the Lucide React package');

const ui = read('packages/ui/src/index.tsx');
requireAll('P03 primitives', ui, [
  'export function Button', 'export function IconButton', 'export function Field', 'export function Input',
  'export function Textarea', 'export function Select', 'export function Checkbox', 'export function Switch',
  'export function Badge', 'export const StatusBadge', 'export function Alert', 'export function Skeleton',
  'export function Spinner', 'export function EmptyState', 'export function ErrorState', 'export function Page',
  'export function PageHeader', 'export function PageSection', 'export function Table', 'export function Tabs',
  'export function Dialog', 'export function Tooltip', 'export function Breadcrumb'
]);
requireAll('Base UI wrappers', ui, ['@base-ui/react/checkbox', '@base-ui/react/dialog', '@base-ui/react/switch', '@base-ui/react/tabs', '@base-ui/react/tooltip']);

const css = read('packages/ui/src/ui.css');
requireAll('UI states', css, [
  '.gj-button:focus-visible', '[data-variant="destructive"]', '.gj-input[aria-invalid="true"]',
  '.gj-checkbox[data-checked]', '.gj-switch[data-checked]', '.gj-dialog-backdrop',
  '@media (max-width: 639px)', '@media (prefers-reduced-motion: reduce)'
]);
const hardColors = css.match(/#[0-9a-fA-F]{3,8}\b/g);
if (hardColors) throw new Error(`@gojet/ui must consume semantic tokens, raw hex found: ${[...new Set(hardColors)].join(', ')}`);

const devRoute = read('apps/site/src/router.tsx');
const devPage = read('apps/site/src/routes/DevUi.tsx');
requireAll('internal UI route', devRoute, ['path: "/dev/ui"', 'lazy(() => import("./routes/DevUi"))']);
requireAll('internal UI verification surface', devPage, ['Buttons / Actions', 'Forms', 'Status / Feedback', 'Data / Tabs', 'Overlay / Destructive', 'Resource States']);

console.log('P03 design system foundation contract verified.');
