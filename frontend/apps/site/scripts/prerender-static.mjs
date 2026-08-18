import fs from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const dist = path.join(appRoot, 'dist');
const workspaceRoutes = path.resolve(appRoot, '../workspace/src/routes');
const read = (file) => fs.readFileSync(file, 'utf8');
const assertTokens = (file, tokens) => {
  const source = read(file);
  for (const token of tokens) if (!source.includes(token)) throw new Error(`P19 exact-product guard: ${path.basename(file)} missing ${token}`);
};

assertTokens(path.join(workspaceRoutes, 'LinksPage.tsx'), ['Create link', 'Destination', 'Domain', 'Code', 'Title', 'Advanced settings']);
assertTokens(path.join(workspaceRoutes, 'QRPage.tsx'), ['Destination link', 'Name', 'Size', 'Export format', 'Foreground', 'Background', 'PNG', 'SVG', 'PDF']);
assertTokens(path.join(workspaceRoutes, 'AnalyticsPage.tsx'), ['Analytics', 'From', 'To', 'Compare', 'Export CSV', 'Resource', 'Domain', 'Campaign', 'Country', 'Device']);
assertTokens(path.join(workspaceRoutes, 'BillingPage.tsx'), ['billingClient.workspace(', 'data.plans.map(', 'monthly_price_cents', 'plan.currency', 'billing_periods']);

const origin = 'https://gojet.cc';
const nav = [
  ['Products', '/products/'], ['Solutions', '/solutions/'], ['Developers', '/developers/'], ['Pricing', '/pricing/'], ['Docs', '/docs/']
];
const routes = [
  ['/', 'GoJet — Create, control, understand and operate every share', 'GoJet brings links, QR codes, files, text, bio pages, analytics, routing and domains into one operational workspace.', 'GOJET WORKSPACE', 'Create. Control. Understand. Operate.', 'One workspace for every resource you publish, route and measure.'],
  ['/products/', 'GoJet Products', 'Links, QR Codes, Files, Text, Bio Pages, Analytics, Smart Routing and Custom Domains in one workspace.', 'PRODUCTS', 'One workspace. Multiple publishing surfaces.', 'Create resources without separating control, analytics, domains and governance.'],
  ['/products/links/', 'GoJet Links', 'Create and operate short links with custom domains, routing, controls, campaigns and analytics.', 'LINKS', 'Short links with operational depth.', 'Create, route, protect, organize and measure links from the same workspace.'],
  ['/products/qr-codes/', 'GoJet QR Codes', 'Create, style, export and measure QR distribution from safe GoJet links.', 'QR CODES', 'QR distribution stays connected to the link.', 'Generate PNG, SVG and PDF exports while keeping destination safety and analytics server-authoritative.'],
  ['/products/files/', 'GoJet Files', 'Share scanned files with expiry, password controls and workspace governance.', 'FILES', 'Share files without losing control.', 'File availability follows server-side scan state, access policy and workspace permissions.'],
  ['/products/text-sharing/', 'GoJet Text Sharing', 'Publish plain text, Markdown and code with raw view, expiry, password and custom domains.', 'TEXT', 'Publish text with the same control plane.', 'Plain text, Markdown and code fit the same resource, domain and analytics model.'],
  ['/products/link-in-bio/', 'GoJet Bio Pages', 'Build mobile-first bio pages with blocks, social links, domains, SEO and analytics.', 'BIO PAGES', 'A public profile backed by workspace controls.', 'Compose blocks, links, themes, domains and analytics without creating a separate product silo.'],
  ['/products/analytics/', 'GoJet Analytics', 'Understand clicks, scans, geography, devices, referrers and campaigns across GoJet resources.', 'ANALYTICS', 'Understand distribution without inventing a dashboard.', 'Analytics reflects server-returned resource activity, filters and export capabilities.'],
  ['/products/smart-routing/', 'GoJet Smart Routing', 'Route links by country, device, language, source, A/B rules and fallbacks.', 'SMART ROUTING', 'Route at the redirect layer.', 'Rules are evaluated by the server; browser previews explain configuration but never become the decision authority.'],
  ['/products/custom-domains/', 'GoJet Custom Domains', 'Add, verify and operate custom domains with DNS, TLS status and resource assignment.', 'CUSTOM DOMAINS', 'Own the hostname behind every resource.', 'Go from DNS to verification, TLS status and assignment with server-authoritative state.'],
  ['/solutions/', 'GoJet Solutions', 'Operational sharing workflows for marketing, creators, teams and developers.', 'SOLUTIONS', 'Built for people who publish repeatedly.', 'Use one control plane across campaigns, public profiles, teams and integrations.'],
  ['/solutions/marketing/', 'GoJet for Marketing', 'Create campaign links and QR codes, route traffic, tag activity and measure performance.', 'MARKETING', 'Campaign distribution with fewer disconnected tools.', 'Keep campaign links, QR distribution, domains, routing and analytics in one workspace.'],
  ['/solutions/creators/', 'GoJet for Creators', 'Operate links, QR codes, files, text and bio pages under a consistent brand.', 'CREATORS', 'Publish more than one kind of resource.', 'Use custom domains and a shared workspace to keep public distribution coherent.'],
  ['/solutions/teams/', 'GoJet for Teams', 'Manage members, roles, billing, shared domains and resource governance.', 'TEAMS', 'Collaboration has a workspace boundary.', 'Roles, resources, domains, billing and audit context stay attached to the workspace.'],
  ['/solutions/developers/', 'GoJet for Developers', 'Use scoped API keys and signed webhooks to automate GoJet workflows.', 'DEVELOPERS', 'Automate the control plane.', 'Prefer API and webhook composition over browser automation.'],
  ['/developers/', 'GoJet Developers', 'Integrate with GoJet APIs and signed webhooks using scoped credentials.', 'DEVELOPER PLATFORM', 'APIs for the same product surface.', 'Create and inspect resources with scoped credentials, stable IDs and retry-safe webhook consumers.'],
  ['/pricing/', 'GoJet Pricing', 'GoJet pricing follows server-owned billing configuration rather than duplicated static amounts.', 'PRICING', 'Pricing follows the deployed billing configuration.', 'Plan names, currency, monthly base price and enabled billing periods come from the billing service. The marketing site does not maintain a second price truth.'],
  ['/security/', 'GoJet Security', 'GoJet security covers destination risk, file scanning, RBAC, audit trails and adaptive anti-abuse controls.', 'SECURITY', 'Security is enforced at the server boundary.', 'Risk decisions, ClamAV scanning, RBAC, audit evidence and Turnstile policy are operational controls—not decorative badges.'],
  ['/about/', 'About GoJet', 'GoJet is a workspace for controlled publishing, routing and measurement across common shareable resources.', 'ABOUT', 'A focused control plane for distribution.', 'GoJet keeps creation, policy, domains, analytics and operations together.'],
  ['/contact/', 'Contact GoJet', 'Contact GoJet for product, security, support or business enquiries.', 'CONTACT', 'Reach the right GoJet workflow.', 'Use the published support and security channels for the deployed service.'],
  ['/legal/privacy/', 'GoJet Privacy Policy', 'Privacy information for GoJet services and website.', 'LEGAL', 'Privacy Policy', 'This route is the canonical privacy-policy surface for the GoJet website deployment.'],
  ['/legal/terms/', 'GoJet Terms of Service', 'Terms governing use of GoJet services.', 'LEGAL', 'Terms of Service', 'This route is the canonical service-terms surface for the GoJet website deployment.'],
  ['/legal/acceptable-use/', 'GoJet Acceptable Use Policy', 'Acceptable-use requirements for GoJet services.', 'LEGAL', 'Acceptable Use Policy', 'This route defines prohibited and restricted use of the deployed GoJet service.']
];

const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const navHtml = (current) => nav.map(([label, href]) => `<a href="${href}"${current.startsWith(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
const footer = `<footer class="site-footer"><div class="site-width footer-grid"><div><a class="brand" href="/">GoJet<span>.</span></a><p>Create · Control · Understand · Operate.</p></div><nav aria-label="Footer"><a href="/products/">Products</a><a href="/security/">Security</a><a href="/docs/">Docs</a><a href="/legal/privacy/">Privacy</a><a href="/legal/terms/">Terms</a><a href="/legal/acceptable-use/">Acceptable use</a></nav></div></footer>`;
const capability = `<div class="capability-ribbon" aria-label="Capabilities"><a href="/products/links/">Links</a><a href="/products/qr-codes/">QR</a><a href="/products/files/">Files</a><a href="/products/text-sharing/">Text</a><a href="/products/link-in-bio/">Bio</a></div>`;

function productStage() {
  return `<div class="product-stage" aria-label="Exact-head product interface composition" data-product-source="workspace-exact-head">
    <div class="ambient-halo" aria-hidden="true"></div>
    <div class="jet-path" aria-hidden="true"><span></span><span></span><span></span></div>
    <section class="workspace-card product-float">
      <div class="ui-card-head"><div><small>WORKSPACE · LINKS</small><strong>Create link</strong></div><span class="ui-status">Draft</span></div>
      <div class="ui-fields"><label>Destination<input value="https://example.com/campaign" readonly></label><div class="ui-grid"><label>Domain<select><option>go.example.com</option></select></label><label>Code<input value="launch" readonly></label></div><label>Title<input value="Launch campaign" readonly></label></div>
      <button type="button" class="advanced" aria-expanded="false">Advanced settings</button><button type="button" class="create-button">Create link</button>
    </section>
    <aside class="qr-module product-float-delayed"><small>QR live preview</small><div class="qr-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><strong>PNG · SVG · PDF</strong><span>Destination link · Size · Export format</span></aside>
    <aside class="analytics-module product-float"><div><small>ANALYTICS</small><strong>Analytics</strong></div><div class="analytics-controls"><span>From</span><span>To</span><span>Compare</span><span>Export CSV</span></div><div class="analytics-filters"><span>Resource</span><span>Domain</span><span>Campaign</span><span>Country</span><span>Device</span></div><svg viewBox="0 0 320 90" role="img" aria-label="Analytics interface trend placeholder"><path d="M4 72 C52 70 64 32 108 45 S160 80 204 38 S266 22 316 10" fill="none" stroke="currentColor" stroke-width="2"/></svg></aside>
  </div>`;
}

function homeBody() {
  return `<main>
    <section class="hero site-width"><div class="hero-copy reveal"><span class="eyebrow">GOJET WORKSPACE</span><h1>Create. Control. Understand. Operate.</h1><p>One workspace for links, QR codes, files, text and bio pages—connected by domains, routing, analytics and governance.</p><div class="hero-actions"><a class="primary" href="/register">Get started</a><a class="secondary" href="/docs/">Read the docs</a></div>${capability}</div><div class="hero-stage reveal">${productStage()}</div></section>
    <section class="section site-width reveal"><span class="eyebrow">WORKFLOW</span><h2>Four jobs, one control plane.</h2><div class="four-grid"><article><b>01</b><h3>Create</h3><p>Links, QR Codes, Files, Text and Bio Pages.</p></article><article><b>02</b><h3>Control</h3><p>Domains, expiry, access, routing, campaigns, tags and roles.</p></article><article><b>03</b><h3>Understand</h3><p>Analytics across resources, geography, devices, referrers and campaigns.</p></article><article><b>04</b><h3>Operate</h3><p>Billing, members, support, webhooks, API keys and audit context.</p></article></div></section>
    <section class="section section-soft"><div class="site-width reveal"><span class="eyebrow">USE CASES</span><h2>Built for repeated distribution.</h2><div class="three-grid"><a href="/solutions/marketing/"><h3>Marketing</h3><p>Campaign links, QR distribution, routing and measurement.</p></a><a href="/solutions/creators/"><h3>Creators</h3><p>Public resources and bio pages under consistent domains.</p></a><a href="/solutions/teams/"><h3>Teams</h3><p>Members, roles, shared resources, billing and governance.</p></a></div></div></section>
    <section class="security-band"><div class="site-width reveal"><div><span class="eyebrow">SECURITY</span><h2>Server-enforced controls, visible where they matter.</h2></div><div class="security-pills"><span>Destination Risk</span><span>ClamAV</span><span>RBAC</span><span>Audit</span><span>Turnstile</span></div></div></section>
    <section class="section site-width developer-band reveal"><div><span class="eyebrow">DEVELOPER</span><h2>API + signed webhooks.</h2><p>Use scoped credentials and retry-safe webhook consumers to automate the same product resources.</p><a class="secondary" href="/docs/en/developers/api-reference/">Open API Reference</a></div><pre><code>POST /api/links\nAuthorization: Bearer &lt;API_KEY&gt;\nContent-Type: application/json</code></pre></section>
    <section class="final-cta site-width reveal"><h2>Publish with a control plane behind it.</h2><p>Start in GoJet Workspace, then connect the domains, routing and analytics your distribution needs.</p><a class="primary" href="/register">Create your workspace</a></section>
  </main>`;
}

function detailBody(route, eyebrow, heading, lead) {
  const isPricing = route === '/pricing/';
  return `<main><section class="detail-hero site-width reveal"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(heading)}</h1><p>${esc(lead)}</p><div class="hero-actions"><a class="primary" href="/register">Get started</a><a class="secondary" href="/docs/">Documentation</a></div></section>${capability}<section class="section site-width reveal"><div class="detail-grid"><article><span class="eyebrow">CREATE</span><h2>Start from a real resource.</h2><p>GoJet uses the Workspace product model rather than a disconnected marketing mock.</p></article><article><span class="eyebrow">CONTROL</span><h2>Keep server authority intact.</h2><p>Permissions, risk, billing and routing states are enforced by backend services.</p></article><article><span class="eyebrow">UNDERSTAND</span><h2>Use observable activity.</h2><p>Analytics and audit surfaces report real service data instead of hard-coded success states.</p></article></div>${isPricing ? `<div class="pricing-source" data-pricing-source="server"><span class="eyebrow">SERVER-OWNED PRICING</span><h2>No duplicated static price table.</h2><p>Plan names, currency, monthly base price and enabled billing periods are loaded by Workspace Billing from its server-owned <code>/api/workspaces/:id/billing</code> payload. This static website intentionally does not invent amounts.</p><a class="secondary" href="/app/billing">Open Workspace Billing</a></div>` : ''}</section></main>`;
}

function pageHtml(route, title, description, eyebrow, heading, lead) {
  const canonical = `${origin}${route}`;
  const jsonLd = JSON.stringify({ '@context':'https://schema.org', '@type': route === '/' ? 'SoftwareApplication' : 'WebPage', name:title, url:canonical, description });
  const body = route === '/' ? homeBody() : detailBody(route, eyebrow, heading, lead);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:site_name" content="GoJet"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/marketing.css"><script type="application/ld+json">${jsonLd}</script></head><body><div class="gj-website-shell"><header class="gj-website-header"><div class="gj-website-header-inner site-width"><a class="brand" href="/" aria-label="GoJet home">GoJet<span>.</span></a><nav class="gj-website-nav" aria-label="Primary navigation">${navHtml(route)}</nav><div class="gj-website-actions"><a class="sign-in" href="/login">Sign in</a><a class="header-cta" href="/register">Get started</a><details class="gj-website-mobile-menu"><summary>Menu</summary><nav>${navHtml(route)}<a href="/login">Sign in</a></nav></details></div></div></header>${body}${footer}</div><script src="/marketing.js" defer></script></body></html>`;
}

if (!fs.existsSync(dist)) throw new Error('Run vite build before P19 static prerender.');
const spa = read(path.join(dist, 'index.html'));
for (const route of ['/login/','/register/','/verify-email/','/forgot-password/','/reset-password/','/verifyemail/','/resetpassword/','/dev/ui/']) {
  const out = path.join(dist, route.slice(1), 'index.html'); fs.mkdirSync(path.dirname(out), { recursive:true }); fs.writeFileSync(out, spa);
}
for (const route of routes) {
  const [pathname, title, description, eyebrow, heading, lead] = route;
  const out = pathname === '/' ? path.join(dist, 'index.html') : path.join(dist, pathname.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive:true });
  fs.writeFileSync(out, pageHtml(pathname, title, description, eyebrow, heading, lead));
}
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(([r])=>`<url><loc>${origin}${r}</loc></url>`).join('')}</urlset>`);
console.log(`P19 static prerender complete: ${routes.length} marketing routes + auth SPA entries; exact Workspace UI source guard passed.`);
