import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.cwd(), 'dist');
const origin = 'https://gojet.cc';

const englishRewrite = {
  'GOJET WORKSPACE': 'GOJET',
  'WORKFLOW': 'HOW GOJET WORKS',
  'USE CASES': 'MADE FOR',
  'DEVELOPER PLATFORM': 'INTEGRATIONS',
  'DEVELOPERS': 'INTEGRATIONS',
  'DEVELOPER': 'INTEGRATIONS',
  'SECURITY': 'PROTECTION',
  'Create. Control. Understand. Operate.': 'Create, manage and measure everything you share.',
  'One workspace for links, QR codes, files, text and bio pages—connected by domains, routing, analytics and governance.': 'Create short links, QR codes, file shares, text pages and bio pages in one account. Use your own domains, set delivery rules and access controls, then review traffic and activity without moving between separate tools.',
  'Four jobs, one control plane.': 'Create content, organize it, publish it and follow the results.',
  'Links, QR Codes, Files, Text and Bio Pages.': 'Create short links, QR codes, file shares, text pages and bio pages from the same account.',
  'Domains, expiry, access, routing, campaigns, tags and roles.': 'Choose the domain, expiration, access rules, routing conditions, campaign and tags for each item you publish.',
  'Analytics across resources, geography, devices, referrers and campaigns.': 'Review visits by content, domain, campaign, country, device and referrer so you can see what people actually use.',
  'Billing, members, support, webhooks, API keys and audit context.': 'Manage members, billing, support requests, API access, webhook notifications and account activity from the same workspace.',
  'Built for repeated distribution.': 'Useful when you publish and update links, files and pages regularly.',
  'Campaign links, QR distribution, routing and measurement.': 'Build campaign links and QR codes, route visitors to the right destination and compare results from the same campaign view.',
  'Public resources and bio pages under consistent domains.': 'Publish links, files and profile pages under consistent domains, then update them without replacing every public URL.',
  'Members, roles, shared resources, billing and governance.': 'Give team members the access they need, share domains and content, and keep billing and account activity in one place.',
  'Server-enforced controls, visible where they matter.': 'Protect destinations, files and accounts before content is published or changed.',
  'Destination Risk': 'Destination checks',
  'ClamAV': 'File scanning',
  'RBAC': 'Role permissions',
  'Audit': 'Activity history',
  'API + signed webhooks.': 'Connect GoJet to the systems you already use.',
  'Use scoped credentials and retry-safe webhook consumers to automate the same product resources.': 'Create API keys only for the permissions an integration needs, receive signed webhook notifications for important events, and keep automated changes tied to the same workspace permissions as manual changes.',
  'Open API Reference': 'View API reference',
  'Publish with a control plane behind it.': 'Publish from one place and keep control after the link is shared.',
  'Start in GoJet Workspace, then connect the domains, routing and analytics your distribution needs.': 'Create the item you want to share, connect the domain you want people to see, configure any access or routing rules, and use the activity view to understand what happens after publication.',
  'Create your workspace': 'Create an account',
  'One workspace. Multiple publishing surfaces.': 'Create and manage every type of shareable content from one account.',
  'Create resources without separating control, analytics, domains and governance.': 'Short links, QR codes, files, text and profile pages use the same domains, permissions, folders, tags and activity history, so you do not have to maintain separate tools for each format.',
  'Short links with operational depth.': 'Short links you can continue to manage after publishing.',
  'Create, route, protect, organize and measure links from the same workspace.': 'Choose the destination and public address, organize the link with campaigns and tags, add expiration or routing rules when needed, and review visits without changing the URL you already shared.',
  'QR distribution stays connected to the link.': 'Create QR codes without separating them from their destination links.',
  'Generate PNG, SVG and PDF exports while keeping destination safety and analytics server-authoritative.': 'Choose a destination link, size and appearance, export PNG, SVG or PDF files, and keep scan activity connected to the same destination and reporting view.',
  'Share files without losing control.': 'Share files while keeping expiry and access rules attached.',
  'File availability follows server-side scan state, access policy and workspace permissions.': 'Uploaded files are checked before they are made available. You can set expiration and password protection, and access follows the permissions of the workspace that owns the file.',
  'Publish text with the same control plane.': 'Publish text or code without setting up a separate site.',
  'Plain text, Markdown and code fit the same resource, domain and analytics model.': 'Publish plain text, Markdown or code, choose raw or formatted viewing, add expiration or password protection, and use a custom domain when you want a branded public address.',
  'A public profile backed by workspace controls.': 'Build a public profile page and manage it from the same account.',
  'Compose blocks, links, themes, domains and analytics without creating a separate product silo.': 'Arrange links and content blocks, choose the page appearance, connect a custom domain and review visits from the same workspace that holds your other GoJet content.',
  'Understand distribution without inventing a dashboard.': 'See how people reach and use the content you publish.',
  'Analytics reflects server-returned resource activity, filters and export capabilities.': 'Filter activity by content, domain, campaign, country, device and time range, compare periods when needed, and export the records you need for further analysis.',
  'Route at the redirect layer.': 'Send visitors to different destinations from one public link.',
  'Rules are evaluated by the server; browser previews explain configuration but never become the decision authority.': 'Create rules for country, device, language, source or A/B distribution and define a fallback destination. The same public link can then send each visit to the matching destination.',
  'Own the hostname behind every resource.': 'Use your own domain for the links and pages you publish.',
  'Go from DNS to verification, TLS status and assignment with server-authoritative state.': 'Add the domain, follow the DNS instructions, wait for verification and HTTPS readiness, then choose which links or pages should use it. Domain status is shown in the workspace as it changes.',
  'Start from a real resource.': 'Create the content you actually need to publish.',
  'GoJet uses the Workspace product model rather than a disconnected marketing mock.': 'Create links, QR codes, file shares, text pages or bio pages directly in your account. The same item can then use your domains, access rules, campaigns, tags and reporting without being recreated elsewhere.',
  'Keep server authority intact.': 'Apply access and delivery rules consistently.',
  'Permissions, risk, billing and routing states are enforced by backend services.': 'Account permissions decide who can make changes, destination and file checks protect public content, and routing or billing settings are applied to the live item rather than being decorative settings in the browser.',
  'Use observable activity.': 'Review real visits and account activity.',
  'Analytics and audit surfaces report real service data instead of hard-coded success states.': 'Traffic reports show recorded visits and filters, while account history shows the actions that were actually saved. Empty, pending and failed states remain visible instead of being replaced with sample success data.',
  'SERVER-OWNED PRICING': 'LIVE PLAN INFORMATION',
  'No duplicated static price table.': 'Plan information comes from the same billing configuration used in your account.',
  'Plan names, currency, monthly base price and enabled billing periods are loaded by Workspace Billing from its server-owned <code>/api/workspaces/:id/billing</code> payload. This static website intentionally does not invent amounts.': 'Available plan names, currency, billing periods and current prices are loaded from the billing configuration used by the account area, so the website does not show a second set of amounts that can drift out of date.',
  'Open Workspace Billing': 'View plans in your account',
  'Sign in': 'Sign in',
  'Get started': 'Create account',
  'Read the docs': 'Read documentation',
  'Documentation': 'Documentation'
};

const zh = {
  'Products': '产品', 'Solutions': '解决方案', 'Integrations': '集成', 'Pricing': '价格', 'Docs': '文档',
  'Sign in': '登录', 'Create account': '创建账号', 'Menu': '菜单', 'Read documentation': '查看使用文档', 'Documentation': '使用文档',
  'GOJET': 'GOJET', 'HOW GOJET WORKS': '使用方式', 'MADE FOR': '适用场景', 'INTEGRATIONS': '集成与自动化', 'PROTECTION': '安全保护',
  'Create, manage and measure everything you share.': '集中创建、管理并查看每一项对外分享的内容。',
  'Create short links, QR codes, file shares, text pages and bio pages in one account. Use your own domains, set delivery rules and access controls, then review traffic and activity without moving between separate tools.': '在一个账号中创建短链接、二维码、文件分享、文本页面和个人主页。可以绑定自己的域名，设置访问与跳转规则，并在同一处查看访问数据和操作记录，不需要在多个工具之间反复切换。',
  'Create content, organize it, publish it and follow the results.': '从创建、整理到发布和查看结果，都在同一个工作区完成。',
  'Create': '创建', 'Control': '管理', 'Understand': '查看数据', 'Operate': '账号管理',
  'Create short links, QR codes, file shares, text pages and bio pages from the same account.': '从同一个账号创建短链接、二维码、文件分享、文本页面和个人主页。',
  'Choose the domain, expiration, access rules, routing conditions, campaign and tags for each item you publish.': '为每一项发布内容选择域名，并按需要设置有效期、访问规则、跳转条件、推广活动和标签。',
  'Review visits by content, domain, campaign, country, device and referrer so you can see what people actually use.': '按内容、域名、推广活动、国家或地区、设备和来源查看访问记录，了解用户实际使用情况。',
  'Manage members, billing, support requests, API access, webhook notifications and account activity from the same workspace.': '在同一个工作区管理成员、账单、工单、API 访问、Webhook 通知以及账号操作记录。',
  'Useful when you publish and update links, files and pages regularly.': '适合需要持续发布、更新和维护链接、文件或页面的个人与团队。',
  'Marketing': '市场推广', 'Creators': '内容创作者', 'Teams': '团队协作',
  'Build campaign links and QR codes, route visitors to the right destination and compare results from the same campaign view.': '创建推广链接与二维码，根据需要将访问者导向不同目标地址，并在同一个推广活动中查看和对比访问结果。',
  'Publish links, files and profile pages under consistent domains, then update them without replacing every public URL.': '使用统一域名发布链接、文件和个人主页；内容需要调整时可以在后台更新，不必重新更换已经对外发布的地址。',
  'Give team members the access they need, share domains and content, and keep billing and account activity in one place.': '按职责为成员分配所需权限，共享域名与内容，并把账单和账号操作记录集中在同一个工作区。',
  'Protect destinations, files and accounts before content is published or changed.': '在内容发布或修改前检查目标地址、文件与账号操作，降低恶意链接、风险文件和越权修改带来的问题。',
  'Destination checks': '目标地址检测', 'File scanning': '文件扫描', 'Role permissions': '角色权限', 'Activity history': '操作记录', 'Turnstile': '人机验证',
  'Connect GoJet to the systems you already use.': '把 GoJet 接入现有系统和自动化流程。',
  'Create API keys only for the permissions an integration needs, receive signed webhook notifications for important events, and keep automated changes tied to the same workspace permissions as manual changes.': '只为集成创建所需权限的 API 密钥，通过带签名的 Webhook 接收重要事件通知，并让自动化操作与人工操作遵守同一套工作区权限。',
  'View API reference': '查看 API 参考',
  'Publish from one place and keep control after the link is shared.': '从一个工作区发布内容，并在对外分享之后继续保持可管理状态。',
  'Create the item you want to share, connect the domain you want people to see, configure any access or routing rules, and use the activity view to understand what happens after publication.': '先创建需要分享的内容，再绑定希望用户看到的域名；如有需要可配置访问或跳转规则，发布后通过访问数据和操作记录了解实际使用情况。',
  'Create an account': '创建账号',
  'Create and manage every type of shareable content from one account.': '用一个账号创建并管理多种对外分享内容。',
  'Short links you can continue to manage after publishing.': '短链接发布后仍可继续修改目标地址、规则和状态。',
  'Create QR codes without separating them from their destination links.': '二维码与目标链接保持关联，后续修改和数据查看不需要分开维护。',
  'Share files while keeping expiry and access rules attached.': '分享文件的同时保留有效期和访问限制。',
  'Publish text or code without setting up a separate site.': '无需单独搭建网站即可发布文本、Markdown 或代码内容。',
  'Build a public profile page and manage it from the same account.': '创建公开个人主页，并与其他内容一起管理。',
  'See how people reach and use the content you publish.': '查看用户如何访问和使用已经发布的内容。',
  'Send visitors to different destinations from one public link.': '通过同一个公开链接，根据条件把访问者导向不同目标地址。',
  'Use your own domain for the links and pages you publish.': '使用自己的域名发布链接和页面。',
  'Create the content you actually need to publish.': '直接创建真正需要对外发布的内容。',
  'Apply access and delivery rules consistently.': '统一设置访问权限和内容交付规则。',
  'Review real visits and account activity.': '查看真实访问数据和账号操作记录。',
  'LIVE PLAN INFORMATION': '当前套餐信息',
  'Plan information comes from the same billing configuration used in your account.': '网站与账号后台使用同一份套餐与计费配置。',
  'View plans in your account': '在账号中查看套餐'
};

const pathTranslations = {
  'GoJet Products': 'GoJet 产品', 'GoJet Solutions': 'GoJet 解决方案', 'GoJet Links': 'GoJet 短链接', 'GoJet QR Codes': 'GoJet 二维码',
  'GoJet Files': 'GoJet 文件分享', 'GoJet Text Sharing': 'GoJet 文本分享', 'GoJet Bio Pages': 'GoJet 个人主页', 'GoJet Analytics': 'GoJet 数据分析',
  'GoJet Smart Routing': 'GoJet 智能跳转', 'GoJet Custom Domains': 'GoJet 自定义域名', 'GoJet Pricing': 'GoJet 价格', 'GoJet Security': 'GoJet 安全保护',
  'About GoJet': '关于 GoJet', 'Contact GoJet': '联系 GoJet', 'Privacy Policy': '隐私政策', 'Terms of Service': '服务条款', 'Acceptable Use Policy': '可接受使用政策',
  'LINKS': '短链接', 'QR CODES': '二维码', 'FILES': '文件分享', 'TEXT': '文本分享', 'BIO PAGES': '个人主页', 'ANALYTICS': '数据分析',
  'SMART ROUTING': '智能跳转', 'CUSTOM DOMAINS': '自定义域名', 'MARKETING': '市场推广', 'CREATORS': '内容创作者', 'TEAMS': '团队协作',
  'ABOUT': '关于', 'CONTACT': '联系', 'LEGAL': '法律条款', 'PRICING': '价格'
};

function replaceMap(input, map) {
  return Object.entries(map).sort((a,b)=>b[0].length-a[0].length).reduce((html,[from,to]) => html.split(from).join(to), input);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function routeFromFile(file) {
  const rel = path.relative(dist, file).replaceAll(path.sep, '/');
  if (rel === 'index.html') return '/';
  return '/' + rel.replace(/index\.html$/, '');
}

function languageControl(currentRoute, locale) {
  const english = currentRoute;
  const chinese = `/zh-CN${currentRoute}`.replace(/\/+/g,'/');
  const current = locale === 'zh-CN' ? '简体中文' : 'English';
  const otherHref = locale === 'zh-CN' ? english : chinese;
  const otherLabel = locale === 'zh-CN' ? 'English' : '简体中文';
  return `<details class="gj-language-menu"><summary>${current}</summary><a href="${otherHref}">${otherLabel}</a></details>`;
}

const languageStyle = `<style>.gj-language-menu{position:relative;font-size:14px}.gj-language-menu summary{cursor:pointer;list-style:none;border:1px solid #d9e0ea;border-radius:9px;padding:8px 10px;background:#fff}.gj-language-menu summary::-webkit-details-marker{display:none}.gj-language-menu a{position:absolute;right:0;top:42px;z-index:20;white-space:nowrap;padding:9px 12px;border:1px solid #d9e0ea;border-radius:9px;background:#fff;color:inherit;text-decoration:none;box-shadow:0 10px 30px rgba(15,23,42,.10)}</style>`;

const marketingPrefixes = ['/products/','/solutions/','/developers/','/pricing/','/security/','/about/','/contact/','/legal/'];
function chineseLinks(html) {
  for (const prefix of marketingPrefixes) html = html.split(`href="${prefix}`).join(`href="/zh-CN${prefix}`);
  html = html.split('href="/docs/"').join('href="/docs/zh-CN/"');
  html = html.split('href="/"').join('href="/zh-CN/"');
  return html;
}

const files = walk(dist).filter((file) => file.endsWith('.html'));
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('gj-website-shell')) continue;
  const route = routeFromFile(file);
  let en = replaceMap(source, englishRewrite);
  en = en.replace('</head>', `${languageStyle}<script>document.cookie='gojet_locale=en; Path=/; Max-Age=31536000; SameSite=Lax'</script></head>`);
  en = en.replace('<a class="sign-in"', `${languageControl(route, 'en')}<a class="sign-in"`);
  fs.writeFileSync(file, en);

  let chinese = replaceMap(en, zh);
  chinese = replaceMap(chinese, pathTranslations);
  chinese = chinese.replace('<html lang="en">', '<html lang="zh-CN">');
  chinese = chinese.replace("document.cookie='gojet_locale=en; Path=/; Max-Age=31536000; SameSite=Lax'", "document.cookie='gojet_locale=zh-CN; Path=/; Max-Age=31536000; SameSite=Lax'");
  chinese = chinese.replace(languageControl(route, 'en'), languageControl(route, 'zh-CN'));
  chinese = chineseLinks(chinese);
  const zhRoute = route === '/' ? '/zh-CN/' : `/zh-CN${route}`;
  const canonical = `${origin}${zhRoute}`;
  chinese = chinese.replace(/<link rel="canonical" href="[^"]+">/, `<link rel="canonical" href="${canonical}">`);
  chinese = chinese.replace(/<meta property="og:url" content="[^"]+">/, `<meta property="og:url" content="${canonical}">`);
  const out = path.join(dist, 'zh-CN', route.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, chinese);
}
