import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, '..');
const readFrontend = (file) => fs.readFileSync(path.join(frontendRoot, file), 'utf8');
const readRepo = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const requireAll = (label, text, values) => { for (const value of values) if (!text.includes(value)) throw new Error(`${label} missing: ${value}`); };
const forbid = (label, text, values) => { for (const value of values) if (text.includes(value)) throw new Error(`${label} forbidden: ${value}`); };

const router = readFrontend('apps/workspace/src/router.tsx');
requireAll('P05 workspace routes', router, ['path: "/links"','path: "/links/$linkId"','./routes/LinksPageV503','./routes/LinkDetailPageV503']);

const list = readFrontend('apps/workspace/src/routes/LinksPageV503.tsx');
requireAll('P05 list/create implementation', list, [
  'data-v503-links-list','linksClient.create','linksClient.list','linksClient.capabilities','linksClient.domains','linksClient.organization','linksClient.risks','linksClient.bulkStatus','linksClient.bulkTags','linksClient.bulkDelete','linksClient.exportUrl','useLocale','CreateLinkForm','source: selectedDomain.source','one_time: oneTime'
]);
forbid('P05 list runtime fixtures', list, ['mockLinks','fixtureLinks','demoLinks','localStorage.setItem','sessionStorage.setItem']);

const detail = readFrontend('apps/workspace/src/routes/LinkDetailPageV503.tsx');
requireAll('P05 detail implementation', detail, ['data-v503-link-detail','linksClient.get','linksClient.capabilities','linksClient.risk','LinkDetailPanelsV503','useLocale']);
const panels = readFrontend('apps/workspace/src/links/LinkDetailPanelsV503.tsx');
requireAll('P05 detail editors', panels, ['validateLinkRouting','linksClient.updateRouting','linksClient.updateDestinations','linksClient.updateUTM','linksClient.updateAccess','linksClient.restoreVersion','linksClient.qr','useLocale']);
forbid('P05 detail persistence', panels, ['localStorage.setItem','sessionStorage.setItem']);

const api = readFrontend('packages/api-client/src/links.ts');
requireAll('P05 typed API client', api, ['/links/capabilities','/links/presentation','/link-domains','/links/official','/link-risks','/bulk-status','/bulk-tags','/bulk-move','/links/bulk','/links/export.csv','/versions/','/analytics','/qr','source === "official"']);
const backend = readRepo('services/platformapi/cmd/server/linksp05.go');
requireAll('P05 backend presentation', backend, ['linksP05Capabilities','listLinksP05','getLinkP05','linkP05QR','updated_at','password_protected','l.created_at>=?','l.created_at<?','case "png"','case "svg"','case "pdf"']);
const productRoutes = readRepo('services/platformapi/cmd/server/productroutes.go');
requireAll('P05 registered backend routes', productRoutes, ['GET /api/workspaces/{id}/link-domains','POST /api/workspaces/{id}/links/official','GET /api/workspaces/{id}/links/presentation','GET /api/workspaces/{id}/links/capabilities','GET /api/workspaces/{id}/links/{link}/presentation','GET /api/workspaces/{id}/links/{link}/qr']);
const css = readFrontend('apps/workspace/src/links.css');
requireAll('P05 responsive contract', css, ['grid-template-columns:minmax(220px,1.8fr)','.links-mobile-list{display:none}','@media(max-width:767px)','.links-desktop-table{display:none}','.links-mobile-list{display:grid','.link-qr-layout']);
const rootPackage = JSON.parse(readFrontend('package.json'));
if (rootPackage.scripts?.['test:links'] !== 'playwright test -c playwright.links.config.ts') throw new Error('P05 browser test script missing');
requireAll('P05 browser config', readFrontend('playwright.links.config.ts'), ['testDir: "./tests/links"','browserName: "chromium"','reducedMotion: "reduce"','4184']);
requireAll('P05 browser evidence', readFrontend('tests/links/p05-links.spec.ts'), ['width: 1440, height: 900','width: 1024, height: 768','width: 390, height: 844','pageerror','scrollWidth','clientWidth','page.screenshot']);
console.log('P05 Links contract verified against the routed bilingual V5.0.3 implementation and real link APIs.');
