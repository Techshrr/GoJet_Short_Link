import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, '..');
const readFrontend = (file) => fs.readFileSync(path.join(frontendRoot, file), 'utf8');
const readRepo = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const requireAll = (label, text, values) => {
  for (const value of values) if (!text.includes(value)) throw new Error(`${label} missing: ${value}`);
};
const forbid = (label, text, values) => {
  for (const value of values) if (text.includes(value)) throw new Error(`${label} forbidden: ${value}`);
};

const contract = readRepo('docs/v5/P05_LINKS_CONTRACT.md');
requireAll('P05 frozen contract', contract, [
  'P05 finishes Links only',
  '`/app/links`',
  'Overview / Analytics / Routing / A/B Test / UTM / Access / QR / Settings / History',
  'P06+ remains untouched'
]);

const router = readFrontend('apps/workspace/src/router.tsx');
requireAll('P05 workspace routes', router, [
  'path: "/links"',
  'path: "/links/$linkId"',
  'LinksPage',
  'LinkDetailPage'
]);
forbid('P05 business route', router, ['LinksBoundary']);

const list = readFrontend('apps/workspace/src/routes/LinksPage.tsx');
requireAll('P05 list/create UI', list, [
  'data-p05-links-list',
  'Create link',
  'Search links',
  'Domain filter',
  'Status filter',
  'Campaign filter',
  'Tag filter',
  'Created from',
  'Created to',
  'Columns ·',
  'Destination',
  'Domain',
  'Clicks',
  'Status',
  'Updated',
  'Activate',
  'Pause',
  'Export',
  'Delete selected links?',
  'links-mobile-list',
  'Advanced settings',
  'Access password',
  'Click limit',
  'One-time link',
  'source: selectedDomain.source'
]);
forbid('P05 list runtime fixtures', list, ['mockLinks', 'fixtureLinks', 'demoLinks']);

const detail = readFrontend('apps/workspace/src/routes/LinkDetailPage.tsx');
requireAll('P05 detail UI', detail, [
  'data-p05-link-detail',
  'Copy',
  'Visit',
  'Edit',
  'Overview',
  'Analytics',
  'Routing',
  'A/B Test',
  'UTM',
  'Access',
  'QR',
  'Settings',
  'History',
  'editable(link.data)',
  'reason: reason.trim()'
]);

const panels = readFrontend('apps/workspace/src/links/LinkDetailPanels.tsx');
requireAll('P05 detail editors', panels, [
  'Change reason',
  'validateLinkRouting',
  'Save routing',
  'Total weight:',
  'Save A/B Test',
  'Destination preview',
  'Save UTM',
  'Save access',
  'password_protected',
  'format: "png" | "svg" | "pdf"',
  'PNG',
  'SVG',
  'PDF',
  'Danger zone',
  'Restore revision',
  'Snapshot / diff source'
]);
forbid('P05 QR frontend token bypass', panels, ['#14231d', '#ffffff']);

const api = readFrontend('packages/api-client/src/links.ts');
requireAll('P05 typed API client', api, [
  '/links/capabilities',
  '/links/presentation',
  '/link-domains',
  '/links/official',
  '/link-risks',
  '/bulk-status',
  '/bulk-tags',
  '/bulk-move',
  '/links/bulk',
  '/links/export.csv',
  '/versions/',
  '/analytics',
  '/qr',
  'source === "official"',
  'A/B 版本权重总和必须为 100'
]);

const backend = readRepo('services/platformapi/cmd/server/linksp05.go');
requireAll('P05 backend presentation', backend, [
  'linksP05Capabilities',
  'listLinksP05',
  'getLinkP05',
  'linkP05QR',
  'updated_at',
  'password_protected',
  'l.created_at>=?',
  'l.created_at<?',
  'format == ""',
  'case "png"',
  'case "svg"',
  'case "pdf"'
]);

const productRoutes = readRepo('services/platformapi/cmd/server/productroutes.go');
requireAll('P05 registered backend routes', productRoutes, [
  'GET /api/workspaces/{id}/link-domains',
  'POST /api/workspaces/{id}/links/official',
  'GET /api/workspaces/{id}/links/presentation',
  'GET /api/workspaces/{id}/links/capabilities',
  'GET /api/workspaces/{id}/links/{link}/presentation',
  'GET /api/workspaces/{id}/links/{link}/qr'
]);

const css = readFrontend('apps/workspace/src/links.css');
requireAll('P05 responsive contract', css, [
  'grid-template-columns:minmax(220px,1.8fr)',
  '.links-mobile-list{display:none}',
  '@media(max-width:767px)',
  '.links-desktop-table{display:none}',
  '.links-mobile-list{display:grid',
  '.link-qr-layout'
]);

console.log('P05 Links vertical slice contract verified.');
