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
if (uiPackage.dependencies?.['@tanstack/react-table'] !== '^8.21.3') throw new Error('@gojet/ui must pin the stable TanStack Table v8 adapter range');
const expectedExports = {
  '.': './src/index.tsx', './patterns': './src/patterns.tsx', './patterns.css': './src/patterns.css',
  './overlays': './src/overlays.tsx', './overlays.css': './src/overlays.css', './data': './src/data.tsx',
  './data.css': './src/data.css', './feedback': './src/feedback.tsx', './feedback.css': './src/feedback.css', './layout.css': './src/layout.css',
};
for (const [key, value] of Object.entries(expectedExports)) if (uiPackage.exports?.[key] !== value) throw new Error(`@gojet/ui export ${key} must be ${value}`);

const lockfile = read('pnpm-lock.yaml');
requireAll('P03 locked dependencies', lockfile, ["'@tanstack/react-table':", 'specifier: ^8.21.3', 'version: 8.21.3']);

const iconPackage = JSON.parse(read('packages/icons/package.json'));
if (!iconPackage.dependencies?.['lucide-react']) throw new Error('@gojet/icons must bind the Lucide React package');

const ui = read('packages/ui/src/index.tsx');
requireAll('P03 controls/feedback/layout primitives', ui, [
  'export function Button', 'export function IconButton', 'export function Field', 'export function Input',
  'export function Textarea', 'export function Select', 'export function Checkbox', 'export function Switch',
  'export function Badge', 'export const StatusBadge', 'export function Alert', 'export function Skeleton',
  'export function Spinner', 'export function EmptyState', 'export function ErrorState', 'export function Page',
  'export function PageHeader', 'export function PageSection', 'export function DataRegion', 'export function SettingsSection',
  'export function FormSection', 'export function Table', 'export function Tabs', 'export function Dialog',
  'export function Tooltip', 'export function Breadcrumb'
]);
requireAll('Base UI wrappers', ui, ['@base-ui/react/checkbox', '@base-ui/react/dialog', '@base-ui/react/switch', '@base-ui/react/tabs', '@base-ui/react/tooltip']);

const patterns = read('packages/ui/src/patterns.tsx');
requireAll('P03 controls/navigation/data/layout patterns', patterns, [
  'export function RadioGroup', 'export function Slider', 'export function DatePicker', 'export function DateTime',
  'export function OtpInput', 'export function Combobox', 'export function Progress', 'export function InlineMessage',
  'export function Avatar', 'export function Pagination', 'export function FilterBar', 'export function BulkActionBar',
  'export function Metric', 'export function Sparkline', 'export function ChartFrame', 'export function SplitPane',
  'export function AppHeader', 'export function Sidebar', 'export function SidebarItem', 'export function WorkspaceSwitcher',
  'export function Sheet', 'export function Command', 'export function PageTitle', 'export function PageActions', 'export function Surface'
]);
requireAll('P03 product-state semantics', patterns, ['role="progressbar"', 'aria-label="分页"', 'role="region"', 'aria-current={active ? "page" : undefined}', 'aria-label="切换工作区"']);

const overlays = read('packages/ui/src/overlays.tsx');
requireAll('P03 overlays/navigation', overlays, [
  'export function AlertDialog', 'export function Popover', 'export function DropdownMenu', 'export function SelectMenu',
  'export function ContextMenu', 'export function HoverCard', 'export function MobileDrawer', 'export function UserMenu'
]);
requireAll('Base UI overlay wrappers', overlays, [
  '@base-ui/react/alert-dialog', '@base-ui/react/context-menu', '@base-ui/react/drawer', '@base-ui/react/menu',
  '@base-ui/react/popover', '@base-ui/react/preview-card'
]);

const data = read('packages/ui/src/data.tsx');
requireAll('P03 DataTable foundation', data, [
  '@tanstack/react-table', 'useReactTable', 'getCoreRowModel', 'getSortedRowModel', 'export function DataTable',
  'export function ColumnManager', 'enableRowSelection: selectable', 'getToggleSortingHandler()', 'toggleVisibility(checked)',
  'getIsAllRowsSelected()', 'data-density={density}', 'loading ?', 'error ?'
]);

const feedback = read('packages/ui/src/feedback.tsx');
requireAll('P03 Toast foundation', feedback, [
  '@base-ui/react/toast', 'BaseToast.createToastManager()', 'export function notify', 'export function ToastProvider',
  '<BaseToast.Provider', '<BaseToast.Viewport', '<BaseToast.Root', 'priority: tone === "danger" ? "high" : "low"'
]);

const cssFiles = [
  ['@gojet/ui', 'packages/ui/src/ui.css'], ['@gojet/ui patterns', 'packages/ui/src/patterns.css'],
  ['@gojet/ui overlays', 'packages/ui/src/overlays.css'], ['@gojet/ui data', 'packages/ui/src/data.css'],
  ['@gojet/ui feedback', 'packages/ui/src/feedback.css'], ['@gojet/ui layout', 'packages/ui/src/layout.css'],
];
for (const [label, file] of cssFiles) forbidRawHex(label, read(file));

const css = read('packages/ui/src/ui.css');
requireAll('UI states', css, ['.gj-button:focus-visible', '[data-variant="destructive"]', '[data-variant="link"]', '.gj-input[aria-invalid="true"]', '.gj-checkbox[data-checked]', '.gj-switch[data-checked]', '.gj-dialog-backdrop', '@media (max-width: 639px)', '@media (prefers-reduced-motion: reduce)']);
const patternCss = read('packages/ui/src/patterns.css');
requireAll('pattern states', patternCss, ['.gj-progress', '.gj-filter-bar', '.gj-bulk-bar', '.gj-chart-frame', '.gj-split-pane', '.gj-app-header', '.gj-sidebar[data-collapsed]', '.gj-sidebar-item[data-active]', '.gj-sheet', '.gj-command-list', '@media (max-width: 767px)', '@media (prefers-reduced-motion: reduce)']);
const overlayCss = read('packages/ui/src/overlays.css');
requireAll('overlay states', overlayCss, ['.gj-overlay-popup', '.gj-menu-item[data-highlighted]', '.gj-menu-item[data-destructive]', '.gj-preview-popup', '.gj-drawer-viewport', '.gj-drawer-popup', '@media (prefers-reduced-motion: reduce)']);
const dataCss = read('packages/ui/src/data.css');
requireAll('data states', dataCss, ['[data-density="compact"]', '[data-density="default"]', '[data-density="relaxed"]', 'tr[data-selected]', '.gj-data-table-sort:focus-visible', '@media (max-width: 767px)']);
const feedbackCss = read('packages/ui/src/feedback.css');
requireAll('toast states', feedbackCss, ['.gj-toast-viewport', '[data-tone="success"]', '[data-tone="warning"]', '[data-tone="danger"]', '.gj-toast-close:focus-visible', '@media (prefers-reduced-motion: reduce)']);
const layoutCss = read('packages/ui/src/layout.css');
requireAll('layout region styles', layoutCss, ['.gj-data-region', '.gj-settings-section', '.gj-form-section', '.gj-region-header', '@media (max-width: 639px)']);

const siteMain = read('apps/site/src/main.tsx');
requireAll('UI verification runtime/style wiring', siteMain, ['ToastProvider', '@gojet/ui/css', '@gojet/ui/patterns.css', '@gojet/ui/overlays.css', '@gojet/ui/data.css', '@gojet/ui/feedback.css', '@gojet/ui/layout.css']);
const devRoute = read('apps/site/src/router.tsx');
const devPage = read('apps/site/src/routes/DevUi.tsx');
requireAll('internal UI route', devRoute, ['path: "/dev/ui"', 'lazy(() => import("./routes/DevUi"))']);
requireAll('internal UI verification matrix', devPage, [
  'Foundation Modes / 基础模式', 'Buttons / Actions', 'Forms / Controls', 'Status / Feedback / Toast',
  'DataTable / ColumnManager', 'Data / Tabs / Filtering', 'Overlay / Destructive / Command', 'Shell Building Blocks',
  'Layout Regions', 'Resource States', 'applyThemePreference', '"light", "dark", "system"', '"zh-CN" | "en"',
  '@gojet/ui/data', '@gojet/ui/feedback', 'DataRegion', 'SettingsSection', 'FormSection'
]);

if (fs.existsSync(path.join(root, 'packages/ui/src/index.ts'))) throw new Error('stale P01 packages/ui/src/index.ts must not shadow the P03 TSX entry');
if (fs.existsSync(path.join(root, '../.github/workflows/v5-lockfile-refresh.yml'))) throw new Error('one-time P03 lockfile refresh workflow must be removed after use');

console.log('P03 design system foundation contract verified.');
