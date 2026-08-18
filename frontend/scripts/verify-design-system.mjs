import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireAll = (label, text, values) => {
  for (const value of values) if (!text.includes(value)) throw new Error(`${label} missing: ${value}`);
};
const forbidRawHex = (label, text) => {
  const matches = text.match(/#[0-9a-fA-F]{3,8}\b/g);
  if (matches) throw new Error(`${label} must consume semantic tokens, raw hex found: ${[...new Set(matches)].join(', ')}`);
};

const uiPackage = JSON.parse(read('packages/ui/package.json'));
if (!uiPackage.dependencies?.['@base-ui/react']) throw new Error('@gojet/ui must be built on @base-ui/react');
if (uiPackage.exports?.['.'] !== './src/index.tsx') throw new Error('@gojet/ui root export must point at the GoJet wrapper surface');
if (uiPackage.exports?.['./patterns'] !== './src/patterns.tsx') throw new Error('@gojet/ui patterns export is missing');
if (uiPackage.exports?.['./patterns.css'] !== './src/patterns.css') throw new Error('@gojet/ui pattern styles export is missing');
if (uiPackage.exports?.['./overlays'] !== './src/overlays.tsx') throw new Error('@gojet/ui overlays export is missing');
if (uiPackage.exports?.['./overlays.css'] !== './src/overlays.css') throw new Error('@gojet/ui overlay styles export is missing');

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

const patterns = read('packages/ui/src/patterns.tsx');
requireAll('P03 patterns', patterns, [
  'export function RadioGroup', 'export function Slider', 'export function DatePicker', 'export function DateTime',
  'export function OtpInput', 'export function Combobox', 'export function Progress', 'export function InlineMessage',
  'export function Avatar', 'export function Pagination', 'export function FilterBar', 'export function BulkActionBar',
  'export function Metric', 'export function Sparkline', 'export function ChartFrame', 'export function SplitPane',
  'export function AppHeader', 'export function Sidebar', 'export function SidebarItem', 'export function WorkspaceSwitcher',
  'export function Sheet', 'export function Command', 'export function PageTitle', 'export function PageActions', 'export function Surface'
]);
requireAll('P03 product-state semantics', patterns, ['role="progressbar"', 'aria-label="分页"', 'role="region"', 'aria-current={active ? "page" : undefined}', 'aria-label="切换工作区"']);

const overlays = read('packages/ui/src/overlays.tsx');
requireAll('P03 overlays', overlays, [
  'export function AlertDialog', 'export function Popover', 'export function DropdownMenu', 'export function SelectMenu',
  'export function ContextMenu', 'export function HoverCard', 'export function MobileDrawer', 'export function UserMenu'
]);
requireAll('Base UI overlay wrappers', overlays, [
  '@base-ui/react/alert-dialog', '@base-ui/react/context-menu', '@base-ui/react/drawer', '@base-ui/react/menu',
  '@base-ui/react/popover', '@base-ui/react/preview-card'
]);

const css = read('packages/ui/src/ui.css');
requireAll('UI states', css, [
  '.gj-button:focus-visible', '[data-variant="destructive"]', '.gj-input[aria-invalid="true"]',
  '.gj-checkbox[data-checked]', '.gj-switch[data-checked]', '.gj-dialog-backdrop',
  '@media (max-width: 639px)', '@media (prefers-reduced-motion: reduce)'
]);
forbidRawHex('@gojet/ui', css);

const patternCss = read('packages/ui/src/patterns.css');
requireAll('pattern states', patternCss, [
  '.gj-progress', '.gj-filter-bar', '.gj-bulk-bar', '.gj-chart-frame', '.gj-split-pane',
  '.gj-app-header', '.gj-sidebar[data-collapsed]', '.gj-sidebar-item[data-active]', '.gj-sheet', '.gj-command-list',
  '@media (max-width: 767px)', '@media (prefers-reduced-motion: reduce)'
]);
forbidRawHex('@gojet/ui patterns', patternCss);

const overlayCss = read('packages/ui/src/overlays.css');
requireAll('overlay states', overlayCss, [
  '.gj-overlay-popup', '.gj-menu-item[data-highlighted]', '.gj-menu-item[data-destructive]', '.gj-preview-popup',
  '.gj-drawer-viewport', '.gj-drawer-popup', '@media (prefers-reduced-motion: reduce)'
]);
forbidRawHex('@gojet/ui overlays', overlayCss);

const siteMain = read('apps/site/src/main.tsx');
requireAll('UI verification style wiring', siteMain, ['@gojet/ui/css', '@gojet/ui/patterns.css', '@gojet/ui/overlays.css']);
const devRoute = read('apps/site/src/router.tsx');
const devPage = read('apps/site/src/routes/DevUi.tsx');
requireAll('internal UI route', devRoute, ['path: "/dev/ui"', 'lazy(() => import("./routes/DevUi"))']);
requireAll('internal UI verification surface', devPage, ['Buttons / Actions', 'Forms / Controls', 'Status / Feedback', 'Data / Tabs / Filtering', 'Overlay / Destructive / Command', 'Shell Building Blocks', 'Resource States', '@gojet/ui/overlays']);

if (fs.existsSync(path.join(root, 'packages/ui/src/index.ts'))) throw new Error('stale P01 packages/ui/src/index.ts must not shadow the P03 TSX entry');

console.log('P03 design system foundation contract verified.');
