import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireAll = (label, text, values) => { for (const value of values) if (!text.includes(value)) throw new Error(`${label} missing: ${value}`); };
const forbid = (label, text, values) => { for (const value of values) if (text.includes(value)) throw new Error(`${label} forbidden at P04: ${value}`); };

const uiPackage = JSON.parse(read('packages/ui/package.json'));
for (const [key, value] of Object.entries({ './shells':'./src/shells.tsx', './shells.css':'./src/shells.css', './shells-responsive.css':'./src/shells-responsive.css' })) if (uiPackage.exports?.[key] !== value) throw new Error(`P04 shell export ${key} missing`);
const shells = read('packages/ui/src/shells.tsx');
requireAll('P04 shell primitives', shells, ['export function WebsiteShell', 'export function AuthShell', 'export function ProductShell', 'variant: "workspace" | "admin"', 'window.scrollY >= 80', '<MobileDrawer']);
const shellCss = read('packages/ui/src/shells.css');
requireAll('P04 frozen dimensions', shellCss, ['height:64px', 'grid-template-columns:46% 54%', 'grid-template-columns:248px minmax(0,1fr)', '--shell-header-height:58px', 'grid-template-columns:256px minmax(0,1fr)', '--shell-header-height:56px']);
const responsiveCss = read('packages/ui/src/shells-responsive.css');
requireAll('P04 tablet collapse', responsiveCss, ['max-width:1279px', 'min-width:768px', '.gj-product-sidebar{display:none}', '.gj-product-mobile-trigger{display:block}', '.gj-website-nav{display:none}']);

const siteRouter = read('apps/site/src/router.tsx');
const sitePreview = read('apps/site/src/routes/ShellPreviews.tsx');
requireAll('Website/Auth routes', siteRouter, ['WebsiteShellPreview', 'LoginShellPreview', 'RegisterShellPreview', 'path: "/login"', 'path: "/register"']);
requireAll('Website frozen nav', sitePreview, ['Products', 'Solutions', 'Developers', 'Pricing', 'Docs', '<WebsiteShell', '<AuthShell']);

const workspaceShell = read('apps/workspace/src/WorkspaceShell.tsx');
requireAll('Workspace frozen navigation', workspaceShell, ['Overview', 'CREATE', 'Links', 'QR Codes', 'Files', 'Text', 'Bio Pages', 'INSIGHTS', 'Analytics', 'MANAGE', 'Domains', 'Campaigns', 'Tags', 'DEVELOPER', 'API Keys', 'Webhooks', 'WORKSPACE', 'Members', 'Billing', 'Settings']);
forbid('Workspace first-level IA', workspaceShell, ['label: "Folders"', 'label: "UTM"', 'label: "A/B"', 'label: "Routing"', 'label: "Access"']);
requireAll('Workspace shell mount', read('apps/workspace/src/router.tsx'), ['<WorkspaceShell', 'basepath: "/app"']);

const adminShell = read('apps/admin/src/AdminShell.tsx');
requireAll('Admin frozen navigation', adminShell, ['CUSTOMERS', 'Users', 'Workspaces', 'Memberships', 'RESOURCES', 'TRUST & SAFETY', 'Destination Risk', 'File Security', 'Abuse Reports', 'Security Events', 'OPERATIONS', 'Tickets', 'Announcements', 'Mail', 'Jobs', 'Services', 'COMMERCE', 'Plans', 'Billing', 'Payments', 'FX', 'ACCESS', 'Administrators', 'Roles', 'Permissions', 'Audit', 'PLATFORM', 'General', 'Official Domains', 'OAuth', 'Turnstile', 'Mail Settings', 'Templates', 'Storage', 'Integrations']);
requireAll('Admin shell mount', read('apps/admin/src/router.tsx'), ['<AdminShell', 'basepath: "/admin"']);

const docsConfig = read('apps/docs/astro.config.mjs');
const docsCss = read('apps/docs/src/styles/p04-shell.css');
requireAll('Docs shell config', docsConfig, ['base: "/docs"', 'output: "static"', 'GoJet Docs', 'GoJet 文档', '@gojet/tokens/css', './src/styles/p04-shell.css', 'SocialIcons: "./src/components/WorkspaceLink.astro"']);
requireAll('Docs frozen dimensions', docsCss, ['--sl-nav-height: var(--docs-header-height)', '--sl-sidebar-width: var(--docs-sidebar-width)', '--sl-content-width: var(--docs-article-max)', 'width: var(--docs-toc-width)']);
requireAll('Docs workspace action', read('apps/docs/src/components/WorkspaceLink.astro'), ['href="/app"', 'Go to Workspace']);

const rootPackage = JSON.parse(read('package.json'));
if (rootPackage.devDependencies?.['@playwright/test'] !== '1.62.1') throw new Error('P04 browser gate must pin @playwright/test 1.62.1');
if (rootPackage.scripts?.['test:shells'] !== 'playwright test -c playwright.shells.config.ts') throw new Error('P04 browser test script missing');
const lockfile = read('pnpm-lock.yaml');
requireAll('P04 locked browser dependency', lockfile, ["'@playwright/test':", 'specifier: 1.62.1', 'version: 1.62.1']);
const playwright = read('playwright.shells.config.ts');
requireAll('P04 browser config', playwright, ['browserName: "chromium"', 'reducedMotion: "reduce"', '4173', '4174', '4175', '4176']);
const browser = read('tests/shells/p04-shells.spec.ts');
requireAll('P04 fixed viewport gate', browser, ['width: 1440, height: 900', 'width: 1024, height: 768', 'width: 390, height: 844', 'pageerror', 'message.type() === "error"', 'scrollWidth', 'clientWidth', 'page.screenshot', 'getByRole("button", { name: "Menu" })', 'expectDimension', 'data-sticky", "true"', 'ratio - 0.46', '"width", 260', '"width", target.name === "workspace" ? 248 : 256', '"height", target.name === "workspace" ? 58 : 56']);

if (fs.existsSync(path.join(root, '../.github/workflows/v5-p04-lockfile-refresh.yml'))) throw new Error('one-time P04 lockfile refresh workflow must be removed after use');

console.log('P04 five-surface shell foundation contract verified.');
