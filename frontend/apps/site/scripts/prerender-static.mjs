import fs from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const dist = path.join(appRoot, 'dist');
const origin = 'https://gojet.cc';
const year = 2026;
const pair = (en, zh) => ({ en, zh });
const t = (value, locale) => typeof value === 'string' ? value : value[locale];
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

const navigation = [
  [pair('Products', '产品'), '/products/'],
  [pair('Solutions', '解决方案'), '/solutions/'],
  [pair('Integrations', '集成'), '/developers/'],
  [pair('Pricing', '价格'), '/pricing/'],
  [pair('Docs', '文档'), '/docs/']
];

const footerGroups = [
  {
    title: pair('Products', '产品'),
    items: [
      [pair('URL Shortener', '短链接'), '/products/links/'],
      [pair('QR Codes', '二维码'), '/products/qr-codes/'],
      [pair('File Sharing', '文件分享'), '/products/files/'],
      [pair('Text Sharing', '文本分享'), '/products/text-sharing/'],
      [pair('Bio Pages', '个人主页'), '/products/link-in-bio/'],
      [pair('Analytics', '访问分析'), '/products/analytics/'],
      [pair('Smart Routing', '智能跳转'), '/products/smart-routing/'],
      [pair('Custom Domains', '自定义域名'), '/products/custom-domains/'],
      [pair('Pricing', '价格'), '/pricing/']
    ]
  },
  {
    title: pair('Solutions', '解决方案'),
    items: [
      [pair('For Marketing', '市场推广'), '/solutions/marketing/'],
      [pair('For Creators', '内容创作者'), '/solutions/creators/'],
      [pair('For Teams', '团队协作'), '/solutions/teams/'],
      [pair('For Integrations', '系统集成'), '/solutions/developers/']
    ]
  },
  {
    title: pair('Integrations', '集成'),
    items: [
      [pair('API & Webhooks', 'API 与 Webhook'), '/developers/'],
      [pair('API Reference', 'API 参考'), '/docs/developers/api-reference/'],
      [pair('Documentation', '使用文档'), '/docs/'],
      [pair('Changelog', '更新日志'), '/changelog/'],
      [pair('Service Status', '服务状态'), '/status/']
    ]
  },
  {
    title: pair('Company', '关于'),
    items: [
      [pair('About GoJet', '关于 GoJet'), '/about/'],
      [pair('Contact', '联系我们'), '/contact/'],
      [pair('Help Center', '帮助中心'), '/docs/']
    ]
  },
  {
    title: pair('Legal', '法律条款'),
    items: [
      [pair('Privacy Policy', '隐私政策'), '/legal/privacy/'],
      [pair('Terms of Service', '服务条款'), '/legal/terms/'],
      [pair('Acceptable Use Policy', '可接受使用政策'), '/legal/acceptable-use/'],
      [pair('Report Abuse', '举报滥用'), '/report-abuse/']
    ]
  }
];

const common = {
  getStarted: pair('Create account', '创建账号'),
  signIn: pair('Sign in', '登录'),
  docs: pair('Read documentation', '查看使用文档'),
  more: pair('Learn more', '了解更多')
};

const pages = [
  {
    route: '/',
    title: pair('GoJet — Short links, QR codes and shareable content', 'GoJet — 短链接、二维码与内容分享'),
    description: pair('Create short links, QR codes, file shares, text pages and bio pages, use custom domains and review visits from one GoJet account.', '在一个 GoJet 账号中创建短链接、二维码、文件分享、文本页面和个人主页，使用自定义域名并查看访问数据。'),
    home: true
  },
  {
    route: '/products/',
    title: pair('GoJet Products', 'GoJet 产品'),
    description: pair('Manage links, QR codes, files, text, bio pages, domains and visit data from the same account.', '在同一个账号中管理短链接、二维码、文件、文本、个人主页、域名和访问数据。'),
    heading: pair('Everything you publish stays manageable after you share it.', '每一项对外分享的内容，发布之后仍然可以继续管理。'),
    lead: pair('GoJet keeps different sharing formats in one workspace so you can update destinations, access rules, domains and reporting without rebuilding the same content in separate tools.', 'GoJet 把不同分享形式放在同一个工作区中。内容发布后仍可继续更新目标地址、访问规则、域名和查看数据，不需要在多个工具中重复维护。'),
    cards: [
      [pair('Short links', '短链接'), pair('Create branded short URLs, change destinations when necessary, add expiration or access rules and keep the public address stable.', '创建品牌短网址，在需要时修改目标地址，设置有效期或访问规则，同时保持已经对外发布的地址不变。')],
      [pair('QR codes', '二维码'), pair('Generate downloadable QR codes from links and keep scan activity connected to the same destination and report.', '根据短链接生成可下载二维码，并让扫码数据继续关联同一个目标地址和访问报告。')],
      [pair('Files, text and bio pages', '文件、文本与个人主页'), pair('Publish more than URLs. Share files and text safely or maintain a public profile page from the same account.', '不仅可以分享网址，还可以安全分享文件与文本，或在同一个账号中维护公开个人主页。')]
    ]
  },
  {
    route: '/products/links/', title: pair('GoJet URL Shortener', 'GoJet 短链接'),
    description: pair('Create, organize and measure short links with custom domains, expiration, access rules and routing options.', '使用自定义域名、有效期、访问规则和跳转选项创建、整理并查看短链接数据。'),
    heading: pair('Short links that remain useful after they are published.', '短链接发布之后，仍然可以继续维护和使用。'),
    lead: pair('Choose the destination, public domain and short code, then add title, campaign, tags, expiration, password or routing rules when the link needs more control.', '选择目标地址、公开域名和短码；需要进一步管理时，可以添加标题、推广活动、标签、有效期、密码或跳转规则。'),
    cards: [
      [pair('Create the public address you want', '创建需要的公开地址'), pair('Select an available GoJet domain or a verified custom domain and choose the short code that will be shared publicly.', '选择可用的 GoJet 域名或已验证的自定义域名，并设置真正要对外分享的短码。')],
      [pair('Change the destination without replacing the link', '修改目标地址而无需更换短链'), pair('When campaign or product pages change, update the saved destination while keeping the short URL already used in messages, print or social posts.', '活动页或产品页发生变化时，只需更新后台目标地址，不必更换已经用于短信、印刷物料或社交平台的短网址。')],
      [pair('Review actual visits', '查看真实访问情况'), pair('Use time, domain, campaign, country, device and referrer filters to understand how the link is being used.', '按时间、域名、推广活动、国家或地区、设备和来源筛选访问数据，了解短链接的实际使用情况。')]
    ]
  },
  {
    route: '/products/qr-codes/', title: pair('GoJet QR Codes', 'GoJet 二维码'),
    description: pair('Create QR codes from managed GoJet links and export PNG, SVG or PDF files.', '根据可管理的 GoJet 链接创建二维码，并导出 PNG、SVG 或 PDF 文件。'),
    heading: pair('Keep the QR code connected to a link you can still manage.', '让二维码始终连接到可以继续管理的短链接。'),
    lead: pair('Choose an active destination link, set the size and colors, preview the result and export the format you need. Scan counts stay connected to the same link.', '选择正在使用的目标链接，设置尺寸和颜色，预览效果并导出需要的格式。扫码次数会继续记录在对应短链接下。'),
    cards: [
      [pair('Use an existing managed link', '选择已有短链接'), pair('The QR code points to a GoJet link rather than duplicating a destination in a second place, so future destination changes remain manageable.', '二维码指向 GoJet 短链接，而不是单独复制一份目标地址，因此以后修改目标时仍然可以在同一处完成。')],
      [pair('Export for screen or print', '适用于屏幕和印刷'), pair('Choose the resolution and foreground or background colors, then export PNG, SVG or PDF according to the material you are preparing.', '根据使用场景选择分辨率以及前景色和背景色，再按物料需要导出 PNG、SVG 或 PDF。')],
      [pair('See scan activity separately', '单独查看扫码访问'), pair('QR visits are recorded separately from ordinary link opens so you can compare printed or offline placements with other channels.', '二维码扫码会与普通短链接访问区分记录，便于比较印刷物料、线下场景与其他渠道的效果。')]
    ]
  },
  {
    route: '/products/files/', title: pair('GoJet File Sharing', 'GoJet 文件分享'),
    description: pair('Upload files, wait for the safety check, then share them with optional expiration and password protection.', '上传文件并等待安全检查完成，再使用可选的有效期和密码保护进行分享。'),
    heading: pair('Share a file without leaving it permanently exposed.', '分享文件，同时避免文件长期处于公开状态。'),
    lead: pair('Files are checked before they become downloadable. Set an expiration time or password when the material should only be available to a limited audience or for a limited period.', '文件完成安全检查后才会进入可下载状态。需要限制访问对象或时间时，可以设置有效期或访问密码。'),
    cards: [
      [pair('Safety check before publishing', '发布前完成安全检查'), pair('The file remains unavailable while scanning is pending or unsuccessful instead of being published first and checked later.', '文件在安全检查尚未完成或未通过时不会进入公开下载状态，避免先发布后检查。')],
      [pair('Control how long it stays available', '控制文件可用时间'), pair('Use an expiration time for temporary deliveries and remove the share when it is no longer required.', '临时交付可以设置有效期，不再需要时也可以直接移除分享。')],
      [pair('Protect access when necessary', '按需要保护访问'), pair('Add password protection for files that should not be downloadable by anyone who happens to receive the URL.', '对于不希望任何拿到链接的人都能下载的文件，可以增加访问密码。')]
    ]
  },
  {
    route: '/products/text-sharing/', title: pair('GoJet Text Sharing', 'GoJet 文本分享'),
    description: pair('Publish plain text, Markdown or code snippets with optional expiration and access protection.', '发布纯文本、Markdown 或代码片段，并可按需要设置有效期和访问保护。'),
    heading: pair('Publish text or code without creating another website.', '无需另建网站，也可以快速发布文本或代码。'),
    lead: pair('Choose plain text, Markdown or code, review the presentation, then publish a shareable page with the access controls the content needs.', '选择纯文本、Markdown 或代码形式，确认展示效果后即可发布分享页面，并按内容需要设置访问限制。'),
    cards: [
      [pair('Choose the right display mode', '选择合适的展示方式'), pair('Use plain text for simple notes, Markdown for formatted documents and code mode when source formatting should remain clear.', '简单说明使用纯文本，需要排版时使用 Markdown，需要清晰保留源码格式时使用代码模式。')],
      [pair('Protect temporary information', '保护临时信息'), pair('Use password protection, expiration or one-time access when the text should not remain available indefinitely.', '对于不应长期公开的内容，可以设置密码、有效期或一次性访问。')],
      [pair('Use your own public domain', '使用自己的公开域名'), pair('When a verified custom domain is available, publish text under the same brand domain used by your other GoJet content.', '自定义域名验证完成后，可以让文本分享使用与其他 GoJet 内容一致的品牌域名。')]
    ]
  },
  {
    route: '/products/link-in-bio/', title: pair('GoJet Bio Pages', 'GoJet 个人主页'),
    description: pair('Build a mobile-friendly public profile page with links, content blocks, social accounts and a custom domain.', '创建适合移动端访问的公开个人主页，展示链接、内容模块、社交账号并可绑定自定义域名。'),
    heading: pair('Keep one public profile address while the content changes behind it.', '保持一个长期公开主页地址，内容可以持续更新。'),
    lead: pair('Arrange the links and information you want people to see, choose the page appearance, preview it on smaller screens and publish it under a GoJet or custom domain.', '整理希望用户看到的链接和信息，选择页面外观，在小屏幕上预览效果，再使用 GoJet 域名或自定义域名发布。'),
    cards: [
      [pair('Arrange links and content clearly', '清晰整理链接与内容'), pair('Add the links and profile information that matter, control their order and keep outdated items from crowding the page.', '添加真正重要的链接和个人信息，调整展示顺序，并及时移除不再需要的内容。')],
      [pair('Preview before publishing', '发布前预览'), pair('Check the page at mobile sizes so the public profile remains easy to scan and use on the devices most visitors carry.', '在移动端尺寸下检查页面，确保访客使用常见手机设备时仍然容易浏览和点击。')],
      [pair('Keep visits connected to the page', '持续查看主页访问'), pair('Review activity for the public page together with the other links and content managed in the same workspace.', '个人主页访问数据可以与同一工作区中的其他链接和内容一起查看。')]
    ]
  },
  {
    route: '/products/analytics/', title: pair('GoJet Analytics', 'GoJet 访问分析'),
    description: pair('Review recorded visits by content, domain, campaign, country, device, referrer and time period.', '按内容、域名、推广活动、国家或地区、设备、来源和时间范围查看已记录的访问数据。'),
    heading: pair('Understand how people actually reach the content you publish.', '了解用户实际上如何访问你发布的内容。'),
    lead: pair('Filter recorded visits, compare periods and export data when you need to continue analysis outside GoJet. Empty periods remain empty instead of being filled with sample metrics.', '筛选真实访问记录、比较不同时间段，并在需要进一步处理时导出数据。没有访问的时间段会保持为空，不会用示例数据填充。'),
    cards: [
      [pair('Filter the question you are asking', '按实际问题筛选数据'), pair('Narrow the view by resource, domain, campaign, country, device or referrer so unrelated traffic does not hide the pattern you need.', '按内容、域名、推广活动、国家或地区、设备或来源缩小范围，避免无关访问干扰需要观察的结果。')],
      [pair('Compare equal periods', '比较相同长度的时间段'), pair('Compare the selected period with the previous period of the same length to see whether activity is changing in a meaningful way.', '将选定时间段与之前相同长度的时间段进行比较，更清楚地判断访问是否发生变化。')],
      [pair('Export when further work is needed', '需要时导出数据'), pair('Download the current filtered data as CSV for reporting, spreadsheet work or another analysis process.', '将当前筛选结果导出为 CSV，用于报表、表格处理或其他分析流程。')]
    ]
  },
  {
    route: '/products/smart-routing/', title: pair('GoJet Smart Routing', 'GoJet 智能跳转'),
    description: pair('Send visitors from one public link to different destinations based on configured conditions and a fallback.', '根据已配置的条件和默认目标，让同一个公开链接把不同访客送到不同页面。'),
    heading: pair('Use one public link even when different visitors need different destinations.', '不同访客需要不同目标页面时，仍然只使用一个公开链接。'),
    lead: pair('Create routing conditions for country, device, language or source, order the rules clearly and always keep a fallback destination for visits that match none of them.', '根据国家或地区、设备、语言或来源设置跳转条件，清晰安排规则顺序，并始终为未命中任何条件的访问保留默认目标。'),
    cards: [
      [pair('Route by visitor context', '根据访问情况跳转'), pair('Use the conditions supported by your current plan to direct visitors to a more suitable landing page without publishing multiple public URLs.', '使用当前套餐支持的条件，把访客导向更合适的落地页，而不需要对外发布多个不同网址。')],
      [pair('Keep a predictable fallback', '保留明确的默认目标'), pair('Every routing setup should have a normal destination so a visitor still reaches useful content when no special rule matches.', '每组跳转规则都应保留普通默认目标，确保没有命中特殊条件时访客仍能到达有效内容。')],
      [pair('Review results after publishing', '发布后查看实际结果'), pair('Use visit data to see whether the routing arrangement matches the audiences and channels you expected.', '通过访问数据确认实际受众和渠道是否符合原先设置跳转规则时的预期。')]
    ]
  },
  {
    route: '/products/custom-domains/', title: pair('GoJet Custom Domains', 'GoJet 自定义域名'),
    description: pair('Verify a domain you control, wait for HTTPS readiness and then use it for GoJet links and pages.', '验证自己控制的域名，等待 HTTPS 就绪后用于 GoJet 的链接和页面。'),
    heading: pair('Put your own domain in the public address people see.', '让用户看到的公开地址使用你自己的域名。'),
    lead: pair('Add the hostname, copy the verification record into DNS, return to verify ownership and wait until HTTPS is ready before assigning the domain to public content.', '添加主机名，把验证记录配置到 DNS，返回 GoJet 验证所有权，并等待 HTTPS 就绪后再把域名用于公开内容。'),
    cards: [
      [pair('Verify control through DNS', '通过 DNS 验证所有权'), pair('GoJet provides the verification record to add at your DNS provider. Verification only succeeds after the expected record can be read publicly.', 'GoJet 会提供需要在 DNS 服务商处添加的验证记录，只有系统能够公开读取到正确记录后才会通过验证。')],
      [pair('Wait for HTTPS readiness', '等待 HTTPS 就绪'), pair('A domain is not offered for public links until ownership and HTTPS status are ready, avoiding addresses that look configured but cannot be opened safely.', '域名所有权和 HTTPS 尚未准备完成时不会进入公开链接可用列表，避免出现看似已经配置但无法安全访问的地址。')],
      [pair('Use the same domain across content', '在不同内容中使用同一域名'), pair('Once ready, choose the verified domain when creating supported links or pages so the public address remains consistent with your brand.', '域名准备完成后，在支持的链接或页面中选择该域名，使公开地址与品牌保持一致。')]
    ]
  },
  {
    route: '/solutions/', title: pair('GoJet Solutions', 'GoJet 解决方案'),
    description: pair('Practical ways to use GoJet for marketing, creator publishing, team collaboration and integrations.', '了解 GoJet 在市场推广、内容创作、团队协作和系统集成中的具体使用方式。'),
    heading: pair('Use the same account for the different ways your links are published and maintained.', '不同发布场景仍然使用同一个账号管理链接和内容。'),
    lead: pair('The same core tools can support campaigns, public profile pages, internal teams and automated systems without splitting ownership, domains and visit reporting into separate products.', '同一套核心功能可以用于推广活动、公开个人主页、团队协作和自动化系统，不必把账号归属、域名和访问数据拆散到不同产品中。'),
    cards: [
      [pair('Marketing', '市场推广'), pair('Organize campaign links and QR codes, use consistent domains and compare recorded visits from different placements.', '整理推广链接和二维码，使用统一域名，并比较不同投放位置产生的真实访问。')],
      [pair('Creators', '内容创作者'), pair('Keep a stable public profile and update the links, files or text behind it as content changes.', '保持稳定的公开主页入口，在内容变化时持续更新其中的链接、文件或文本。')],
      [pair('Teams and integrations', '团队与系统集成'), pair('Share workspaces with the right permissions or connect approved automation through API keys and webhook notifications.', '按职责共享工作区权限，或通过 API 密钥和 Webhook 通知接入经过授权的自动化流程。')]
    ]
  },
  {
    route: '/solutions/marketing/', title: pair('GoJet for Marketing', 'GoJet 市场推广'),
    description: pair('Create campaign links and QR codes, organize them with domains and tags, then compare recorded visits.', '创建推广链接和二维码，使用域名与标签整理内容，再比较真实访问数据。'),
    heading: pair('Keep campaign links, QR codes and visit results in one place.', '把推广链接、二维码和访问结果放在同一个地方管理。'),
    lead: pair('Create each campaign entry point, keep naming and domains consistent, route visitors when needed and review actual activity without rebuilding the tracking setup for every channel.', '为每个推广渠道创建入口，保持命名和域名一致，需要时设置跳转规则，并直接查看真实访问，不必为每个渠道重复搭建统计方式。'),
    cards: [
      [pair('Prepare reusable campaign addresses', '准备可持续使用的推广地址'), pair('Use short links that can keep the same public address while destination pages or campaign details change.', '使用公开地址可以保持不变的短链接，在落地页或活动内容变化时继续更新后台目标。')],
      [pair('Connect offline placements with QR codes', '使用二维码连接线下物料'), pair('Generate QR files for print and keep their scans tied to the same campaign destination and report.', '为印刷物料生成二维码，并让扫码继续关联同一推广目标和访问报告。')],
      [pair('Compare channels from recorded visits', '根据真实访问比较渠道'), pair('Use campaign, source, country and device filters to compare placements using the visits GoJet actually recorded.', '按推广活动、来源、国家或地区和设备筛选，根据 GoJet 实际记录的访问比较不同投放渠道。')]
    ]
  },
  {
    route: '/solutions/creators/', title: pair('GoJet for Creators', 'GoJet 内容创作者'),
    description: pair('Maintain a public bio page, branded links and shareable content from one account.', '使用一个账号维护公开个人主页、品牌链接和可分享内容。'),
    heading: pair('Keep the public address familiar even when your content changes often.', '即使内容经常变化，也让用户继续使用熟悉的公开入口。'),
    lead: pair('Use a bio page as a long-term entry point, publish additional links or files when needed and keep everything under consistent domains and account ownership.', '把个人主页作为长期入口，需要时继续发布链接或文件，并让这些内容保持一致的域名和账号归属。'),
    cards: [
      [pair('One profile for changing content', '用一个主页承载持续变化的内容'), pair('Update links, descriptions and featured items behind the same public profile address instead of asking followers to remember a new URL.', '在同一个公开主页地址中更新链接、介绍和重点内容，不必反复让关注者记住新的网址。')],
      [pair('Use branded public addresses', '使用品牌公开地址'), pair('Connect a verified custom domain when you want short links and profile pages to reinforce the same identity.', '需要让短链接和个人主页保持统一品牌识别时，可以绑定已验证的自定义域名。')],
      [pair('See which content receives attention', '了解哪些内容获得更多访问'), pair('Review visits across the profile and related links to understand which published items people actually open.', '查看个人主页和相关链接的访问情况，了解用户真正打开了哪些内容。')]
    ]
  },
  {
    route: '/solutions/teams/', title: pair('GoJet for Teams', 'GoJet 团队协作'),
    description: pair('Use workspaces, member roles, shared domains, billing and support to coordinate link and content management.', '通过工作区、成员角色、共享域名、账单和工单协调团队的链接与内容管理。'),
    heading: pair('Give each person the access they need without sharing one account password.', '按职责分配需要的权限，而不是多人共用一个账号密码。'),
    lead: pair('Invite members into the workspace, assign an appropriate role, keep shared domains and content under the workspace and use billing and support records from the same account.', '邀请成员加入工作区并分配合适角色，让共享域名和内容归属于工作区，同时在同一个账号体系中管理账单和工单记录。'),
    cards: [
      [pair('Separate personal accounts from workspace access', '区分个人账号和工作区权限'), pair('Each member signs in with their own account while workspace membership decides which shared resources they can view or change.', '每个成员使用自己的账号登录，再由工作区成员关系决定可以查看或修改哪些共享资源。')],
      [pair('Keep shared domains and content with the team', '让共享域名和内容归属于团队'), pair('Campaign links, domains and public pages remain attached to the workspace rather than to one employee browser or password.', '推广链接、域名和公开页面归属于工作区，而不是依赖某位员工的浏览器或密码。')],
      [pair('Keep support and billing history together', '集中保留支持与账单记录'), pair('Workspace billing and support requests remain available to authorized members so administrative history does not disappear when responsibilities change.', '工作区账单和工单会保留给有权限的成员，职责变化时相关管理记录也不会随个人离开而丢失。')]
    ]
  },
  {
    route: '/solutions/developers/', title: pair('GoJet for Integrations', 'GoJet 系统集成'),
    description: pair('Connect approved systems to GoJet through scoped API keys and signed webhook notifications.', '通过限定权限的 API 密钥和带签名的 Webhook 通知，把经过授权的系统接入 GoJet。'),
    heading: pair('Automate repeatable work without sharing a user password.', '自动处理重复工作，同时避免共享用户密码。'),
    lead: pair('Create an API key only for the permissions an integration requires, keep the secret in server-side storage and verify webhook signatures before accepting event notifications.', '只为集成创建真正需要的 API 权限，把密钥保存在服务端安全存储中，并在接收事件通知前验证 Webhook 签名。'),
    cards: [
      [pair('Use narrowly scoped API keys', '使用最小权限 API 密钥'), pair('Create separate credentials for different systems and grant only the operations each integration actually needs.', '为不同系统创建独立凭据，并只授予每个集成实际需要执行的操作。')],
      [pair('Treat secrets as server credentials', '把密钥作为服务端凭据管理'), pair('New secret values are shown only when they are created. Store them in an appropriate secret manager rather than browser storage or source code.', '新密钥只会在创建时显示一次，应保存到合适的密钥管理系统中，不要放进浏览器存储或源代码。')],
      [pair('Verify webhook notifications', '验证 Webhook 通知'), pair('Check the signature and handle retries safely before using a webhook event to change another system.', '在使用 Webhook 事件修改其他系统之前，应验证签名并正确处理可能出现的重复重试。')]
    ]
  },
  {
    route: '/developers/', title: pair('GoJet Integrations', 'GoJet 集成'),
    description: pair('API keys, webhooks and documentation for connecting GoJet to other systems.', '用于把 GoJet 接入其他系统的 API 密钥、Webhook 与使用文档。'),
    heading: pair('Connect GoJet to the tools and services that already run your work.', '把 GoJet 接入已经在使用的工具和服务。'),
    lead: pair('Use the API for approved resource operations and signed webhooks for event notifications. Keep credentials scoped, private and separated by integration.', '通过 API 执行经过授权的资源操作，通过带签名的 Webhook 接收事件通知。不同集成应使用独立、最小权限且妥善保管的凭据。'),
    cards: [
      [pair('API access', 'API 访问'), pair('Create and manage API credentials from the workspace settings, then use the documented endpoints for the operations granted to that key.', '从工作区设置中创建和管理 API 凭据，再按照文档调用该密钥被授权使用的接口。')],
      [pair('Webhook notifications', 'Webhook 通知'), pair('Register destinations for the events you need and verify the signature on every received request before processing it.', '为需要的事件登记接收地址，并在处理每一个收到的请求前验证签名。')],
      [pair('Reference documentation', '参考文档'), pair('Use the API reference for request fields, response shapes, authentication and error behavior before connecting production systems.', '在接入生产系统前，通过 API 参考确认请求字段、响应结构、鉴权方式和错误处理。')]
    ]
  },
  {
    route: '/pricing/', title: pair('GoJet Pricing', 'GoJet 价格'),
    description: pair('Review the plans and billing periods currently available for your GoJet workspace.', '查看当前 GoJet 工作区可用的套餐和计费周期。'),
    heading: pair('Choose a plan based on the limits and features your workspace actually needs.', '根据工作区真正需要的功能和额度选择套餐。'),
    lead: pair('Current plan names, supported billing periods and prices are shown from the same billing configuration used by your account. Sign in to see the current options available for this installation.', '当前套餐名称、可选计费周期和价格来自账号实际使用的同一份计费配置。登录后可以查看当前站点真正可用的套餐。'),
    pricing: true,
    cards: [
      [pair('Start with the current plan', '先确认当前套餐'), pair('Open Billing to see which plan the workspace uses today, its billing period and the limits currently applied.', '进入账单页面查看工作区当前使用的套餐、计费周期以及已经生效的额度。')],
      [pair('Compare available upgrades', '比较可用升级方案'), pair('Available plans and prices are read from the current billing configuration instead of a separate hard-coded marketing table.', '可用套餐和价格会读取当前计费配置，而不是维护一份可能过期的独立静态价格表。')],
      [pair('Keep invoices and payments with the workspace', '账单和支付记录归属于工作区'), pair('Authorized members can review invoices and payment history from the same Billing area used to manage the plan.', '有权限的成员可以在管理套餐的同一账单页面中查看发票和支付记录。')]
    ]
  },
  {
    route: '/security/', title: pair('GoJet Protection & Trust', 'GoJet 安全保护'),
    description: pair('How GoJet protects accounts, destinations, files and administrative actions.', '了解 GoJet 如何保护账号、目标地址、文件和后台管理操作。'),
    heading: pair('Protect accounts and public content at the points where problems can actually occur.', '在真正可能发生风险的位置保护账号和公开内容。'),
    lead: pair('Account verification, human checks, destination review, file scanning, role permissions and activity history are applied to the actions they protect rather than shown as decorative claims.', '邮箱验证、人机验证、目标地址检测、文件扫描、角色权限和操作记录会应用到对应的实际操作中，而不是只作为页面上的安全说明。'),
    cards: [
      [pair('Account protection', '账号保护'), pair('Use email verification, secure sessions, optional two-step verification and human checks on sensitive public authentication flows.', '通过邮箱验证、安全会话、可选的双因素验证，以及敏感公开登录流程中的人机验证保护账号。')],
      [pair('Content protection', '内容保护'), pair('Check destinations before publishing links and scan uploaded files before they become available for download.', '短链接发布前检查目标地址，上传文件完成安全扫描后才允许公开下载。')],
      [pair('Administrative accountability', '后台操作可追踪'), pair('Administrator permissions are checked for protected actions and important changes are retained in activity records for later review.', '后台受保护操作会检查管理员权限，重要修改会保留操作记录，便于之后核对。')]
    ]
  },
  {
    route: '/about/', title: pair('About GoJet', '关于 GoJet'),
    description: pair('GoJet combines common sharing tools in one manageable account and workspace.', 'GoJet 把常用分享工具集中到一个可持续管理的账号和工作区中。'),
    heading: pair('A simpler way to manage the public links and content a person or team keeps using.', '更简单地管理个人或团队持续使用的公开链接和内容。'),
    lead: pair('GoJet is built around a practical idea: the URL or page people already received should remain manageable after publication, with domains, access rules and visit data kept alongside the content.', 'GoJet 围绕一个实际需求设计：用户已经收到的链接或页面，在发布之后仍然应该可以继续维护，并让域名、访问规则和访问数据与内容本身保持在一起。'),
    cards: [
      [pair('One account for several sharing formats', '一个账号管理多种分享形式'), pair('Links, QR codes, files, text and public profile pages do not need separate accounts and unrelated settings.', '短链接、二维码、文件、文本和公开个人主页不需要分散到不同账号和互不关联的设置中。')],
      [pair('Keep ownership clear', '保持归属清晰'), pair('Workspaces keep shared domains, content and member access together so teams can understand what they own and who can change it.', '工作区把共享域名、内容和成员权限放在一起，让团队清楚知道资源归属以及谁可以修改。')],
      [pair('Show real states instead of sample success', '真实展示当前状态'), pair('Loading, empty, pending and failed states remain visible so users can understand what the system has actually completed.', '加载中、暂无数据、等待处理和失败状态都会明确显示，让用户知道系统实际上已经完成到了哪一步。')]
    ]
  },
  {
    route: '/contact/', title: pair('Contact GoJet', '联系 GoJet'),
    description: pair('Find the right GoJet channel for account support, product questions, security concerns and abuse reports.', '根据账号支持、产品问题、安全问题和滥用举报找到合适的 GoJet 联系入口。'),
    heading: pair('Use the contact path that keeps the right information with your request.', '选择能够保留必要信息和处理记录的联系入口。'),
    lead: pair('Signed-in users should use support tickets for account-specific help. Security or abuse concerns can be reported without placing sensitive account information in a public message.', '已登录用户处理账号相关问题时应使用工单。安全或滥用问题可以通过专门入口提交，避免在公开信息中暴露敏感账号内容。'),
    cards: [
      [pair('Account and billing support', '账号与账单支持'), pair('Open a support ticket from your workspace so replies and the full conversation remain attached to the account that needs help.', '从工作区提交工单，让回复和完整沟通过程保留在真正需要帮助的账号下。')],
      [pair('Product and integration questions', '产品与集成问题'), pair('Use the documentation first for common setup steps, then include the affected feature and expected result when you contact support.', '常见配置先查看使用文档；仍需联系支持时，请说明涉及的功能和期望结果，便于准确处理。')],
      [pair('Abuse or harmful content', '滥用或有害内容'), pair('Use the abuse-report form and include the GoJet URL, what you observed and any context needed to review the report.', '使用滥用举报表单，并提供涉及的 GoJet 地址、发现的问题以及审核所需的必要说明。')]
    ]
  },
  {
    route: '/status/', title: pair('GoJet Service Status', 'GoJet 服务状态'),
    description: pair('Check the current availability of GoJet services and recent service notices.', '查看 GoJet 服务当前可用状态和近期服务通知。'),
    heading: pair('Check service availability before repeating a failed action.', '重复提交失败操作之前，先确认服务当前是否可用。'),
    lead: pair('This page is the public entry point for service availability and incident notices. Account-specific errors should still be followed up through a support ticket.', '这里用于公开查看服务可用状态和故障通知。只影响特定账号的问题仍应通过工单继续处理。'),
    cards: [
      [pair('Website and sign-in', '官网与登录'), pair('Review whether the public website and account sign-in are currently available.', '查看官网和账号登录当前是否可用。')],
      [pair('Links and public content', '短链接与公开内容'), pair('Review whether redirects, public file or text shares and profile pages are currently reachable.', '查看短链接跳转、公开文件或文本分享以及个人主页当前是否可以正常访问。')],
      [pair('Account services', '账号服务'), pair('Review whether workspace APIs, background processing and notifications are operating normally.', '查看工作区接口、后台处理任务和消息通知是否正常运行。')]
    ]
  },
  {
    route: '/changelog/', title: pair('GoJet Changelog', 'GoJet 更新日志'),
    description: pair('Product, reliability and security changes made to GoJet.', '查看 GoJet 的产品体验、可靠性和安全相关更新。'),
    heading: pair('See what changed before a new behavior surprises your team.', '在新行为影响团队使用之前，先了解发生了哪些变化。'),
    lead: pair('Release notes should explain user-visible changes, migration requirements and important fixes in normal product language rather than internal development milestone names.', '更新说明应使用正常产品语言解释用户可见变化、必要迁移和重要修复，而不是展示内部开发节点名称。'),
    cards: [
      [pair('Product changes', '产品变化'), pair('New or changed user-facing features are described with the affected page and the action that changed.', '新增或调整的用户功能会说明涉及页面以及发生变化的具体操作。')],
      [pair('Reliability fixes', '稳定性修复'), pair('Service, installation and upgrade fixes include the condition they address when users need to take action.', '服务、安装和升级相关修复会说明解决的问题，以及用户是否需要执行额外操作。')],
      [pair('Security changes', '安全更新'), pair('Security-related changes explain the practical effect without exposing secrets or unnecessary exploit detail.', '安全相关更新会说明实际影响，同时避免暴露密钥或不必要的攻击细节。')]
    ]
  }
];

const legalPages = [
  {
    route: '/legal/privacy/',
    title: pair('GoJet Privacy Policy', 'GoJet 隐私政策'),
    heading: pair('Privacy Policy', '隐私政策'),
    intro: pair('This policy explains the information GoJet processes when you use the website, create an account, manage workspace content or contact support, and how that information is used and protected.', '本政策说明当你访问 GoJet 官网、创建账号、管理工作区内容或联系支持时，GoJet 会处理哪些信息，以及这些信息如何被使用和保护。'),
    sections: [
      [pair('1. Information you provide', '一、你主动提供的信息'), pair('Account registration can include your email address, display name, password credential and verification information. Workspace activity can include links, domains, files, text, profile content, member invitations, billing records and support messages you choose to submit.', '账号注册可能包括邮箱地址、显示名称、密码凭据和验证信息。工作区使用过程中可能包括你主动提交的链接、域名、文件、文本、主页内容、成员邀请、账单记录和工单消息。')],
      [pair('2. Information generated while using the service', '二、使用服务过程中产生的信息'), pair('GoJet may record request time, IP address, browser or device information, sign-in and security events, link or QR visits, file download activity, service errors and administrator actions. These records are used to operate the requested feature, protect accounts and public content, investigate abuse and maintain service reliability.', 'GoJet 可能记录请求时间、IP 地址、浏览器或设备信息、登录与安全事件、短链接或二维码访问、文件下载活动、服务错误和管理员操作。这些记录用于提供相应功能、保护账号和公开内容、调查滥用行为以及维护服务稳定性。')],
      [pair('3. How information is used', '三、信息如何使用'), pair('Information is used to create and secure accounts, deliver workspace features, process requests, provide billing and support records, prevent abuse, diagnose failures, measure service usage and communicate service-related notices. GoJet does not need to use private workspace content for unrelated advertising in order to provide these functions.', '相关信息用于创建和保护账号、提供工作区功能、处理请求、保留账单与支持记录、防止滥用、诊断故障、统计服务使用情况以及发送服务相关通知。为提供这些功能，GoJet 不需要把私有工作区内容用于与服务无关的广告用途。')],
      [pair('4. Service providers and disclosures', '四、服务提供商与必要披露'), pair('Infrastructure, email, payment, security or other service providers may process the minimum information required to perform the service they provide. Information may also be preserved or disclosed when required by applicable law, a valid legal process, fraud prevention, security response or protection of users and the service.', '基础设施、邮件、支付、安全或其他服务提供商可能处理完成其服务所必需的最少信息。在适用法律、有效法律程序、欺诈防范、安全响应或保护用户和服务所必需时，相关信息也可能被依法保存或披露。')],
      [pair('5. Cookies and session data', '五、Cookie 与会话数据'), pair('GoJet uses cookies or equivalent browser data for signed-in sessions, CSRF protection, language preference and other functions that are necessary to keep account actions consistent and secure. Sensitive authentication credentials should not be stored in ordinary browser Web Storage.', 'GoJet 会使用 Cookie 或同等浏览器数据维持登录会话、CSRF 防护、语言偏好以及保障账号操作一致和安全所必需的其他功能。敏感身份凭据不应保存在普通浏览器 Web Storage 中。')],
      [pair('6. Retention and deletion', '六、保存与删除'), pair('Information is retained for as long as it is needed to provide the service, meet security or accounting requirements, resolve disputes, comply with law or preserve necessary audit history. When an account or content is deleted, some records may remain for a limited period in backups, billing records, security logs or abuse evidence where retention is reasonably required.', '信息会在提供服务、满足安全或会计要求、解决争议、遵守法律或保留必要审计记录所需的期限内保存。账号或内容删除后，部分记录可能因备份、账单、安全日志或滥用证据的合理保存需要而在有限期限内继续保留。')],
      [pair('7. Your choices', '七、你的选择'), pair('You can review and update supported account and workspace information from the product settings. Where the service provides deletion, session management, connected-account or notification controls, use those controls to manage the related data. For requests that cannot be completed in the product, contact support from the affected account when possible.', '你可以在产品设置中查看和修改系统支持的账号与工作区信息。对于系统提供的删除、会话管理、关联账号或通知控制，请直接使用相应功能管理相关数据。无法在产品中完成的请求，建议尽量从涉及的账号中提交工单。')],
      [pair('8. Changes to this policy', '八、政策更新'), pair('When this policy changes materially, the updated version should identify the new effective date and important changes should be communicated through an appropriate product or service notice.', '本政策发生重大调整时，新版本应注明新的生效日期；重要变化应通过适当的产品或服务通知告知用户。')]
    ]
  },
  {
    route: '/legal/terms/',
    title: pair('GoJet Terms of Service', 'GoJet 服务条款'),
    heading: pair('Terms of Service', '服务条款'),
    intro: pair('These terms govern use of GoJet accounts, workspaces, public links and related services. By creating an account or continuing to use the service, you agree to follow these terms and the Acceptable Use Policy.', '本条款适用于 GoJet 账号、工作区、公开链接及相关服务。创建账号或继续使用服务，即表示你同意遵守本条款以及《可接受使用政策》。'),
    sections: [
      [pair('1. Your account', '一、你的账号'), pair('You are responsible for providing accurate registration information, protecting your sign-in credentials and using individual accounts rather than sharing passwords among multiple people. Notify support promptly if you believe an account or administrator credential has been compromised.', '你应提供准确的注册信息，妥善保护登录凭据，并让不同人员使用各自账号，而不是多人共享密码。如怀疑账号或管理员凭据泄露，应尽快联系支持。')],
      [pair('2. Workspaces and permissions', '二、工作区与权限'), pair('Workspace owners and authorized members are responsible for deciding who may access shared content, domains, billing and administrative functions. Adding a member or changing a role can give that person access to workspace information and actions within the granted permission range.', '工作区所有者和有权限的成员负责决定谁可以访问共享内容、域名、账单和管理功能。邀请成员或修改角色后，该成员可能在被授予的权限范围内查看工作区信息并执行操作。')],
      [pair('3. Your content and destinations', '三、你的内容与目标地址'), pair('You remain responsible for the links, files, text, profile content, domains and destinations you submit. You must have the rights and authority needed to publish or link to that material and must not use GoJet to disguise unlawful, deceptive or harmful activity.', '你需要对自己提交的链接、文件、文本、主页内容、域名和目标地址负责，并应具备发布或链接相关内容所需的权利与授权。不得利用 GoJet 隐藏违法、欺骗或有害活动。')],
      [pair('4. Service protection and enforcement', '四、服务保护与处置'), pair('GoJet may block, restrict, quarantine, suspend or remove content or accounts when reasonably necessary to protect users, respond to abuse, comply with law, preserve platform security or enforce these terms. Where appropriate, the service may request additional verification before restoring access.', '为保护用户、处理滥用、遵守法律、维护服务安全或执行本条款，GoJet 可以在合理必要时阻止、限制、隔离、暂停或移除内容或账号；在适当情况下，恢复访问前可能要求进一步验证。')],
      [pair('5. Plans, billing and payments', '五、套餐、账单与支付'), pair('Paid plans, prices, billing periods, renewal behavior, taxes and payment methods are those shown in the billing flow at the time of purchase or renewal. You are responsible for reviewing the amount and billing period before confirming payment and for maintaining a valid payment method where recurring billing applies.', '付费套餐、价格、计费周期、续费方式、税费和支付方式以购买或续费时账单流程实际显示为准。确认支付前应核对金额和计费周期；适用自动续费时，应维护有效的支付方式。')],
      [pair('6. Availability and changes', '六、服务可用性与调整'), pair('GoJet aims to provide a reliable service but cannot guarantee uninterrupted availability. Features may change to improve security, reliability or product behavior. Material user-facing changes should be documented or communicated when reasonable.', 'GoJet 会尽力保持服务稳定，但无法保证任何情况下都持续无中断。为提升安全性、可靠性或产品体验，功能可能进行调整；对用户有重大影响的变化应在合理情况下通过文档或通知说明。')],
      [pair('7. Suspension and termination', '七、暂停与终止'), pair('You may stop using the service and use available account controls to cancel or delete supported resources. GoJet may suspend or terminate access for material violations, repeated abuse, security threats, unpaid amounts where applicable or legal requirements. Some records may remain where retention is required by law, billing, security or audit obligations.', '你可以停止使用服务，并通过系统提供的账号功能取消或删除支持的资源。对于重大违规、重复滥用、安全威胁、适用情况下的未付款项或法律要求，GoJet 可以暂停或终止访问。因法律、账单、安全或审计义务需要，部分记录可能继续保留。')],
      [pair('8. Responsibility and limitations', '八、责任与限制'), pair('You are responsible for deciding whether GoJet is appropriate for your intended use, maintaining your own copies of critical information and verifying destinations or files before relying on them. To the extent permitted by applicable law, the service is provided without a promise that it will satisfy every specialized requirement or remain error-free at all times.', '你需要自行判断 GoJet 是否适合预期用途，对关键资料保留自己的副本，并在依赖目标地址或文件前进行必要核对。在适用法律允许的范围内，服务不承诺满足所有特殊需求，也不承诺任何时候都完全不存在错误。')]
    ]
  },
  {
    route: '/legal/acceptable-use/',
    title: pair('GoJet Acceptable Use Policy', 'GoJet 可接受使用政策'),
    heading: pair('Acceptable Use Policy', '可接受使用政策'),
    intro: pair('This policy describes activity that is not permitted when using GoJet links, files, text pages, profile pages, domains, APIs or other service features.', '本政策说明在使用 GoJet 的短链接、文件、文本页面、个人主页、域名、API 或其他服务功能时禁止或受限制的行为。'),
    sections: [
      [pair('1. Malware, credential theft and harmful payloads', '一、恶意软件、凭据窃取与有害载荷'), pair('Do not distribute malware, ransomware, spyware, malicious scripts, exploit payloads, credential-stealing pages or files intended to compromise another device, account or network.', '不得传播恶意软件、勒索软件、间谍软件、恶意脚本、漏洞利用载荷、窃取凭据的页面，或用于入侵其他设备、账号或网络的文件。')],
      [pair('2. Fraud, impersonation and deceptive redirects', '二、欺诈、冒充与欺骗性跳转'), pair('Do not use short links, custom domains or routing rules to impersonate another person or organization, conceal fraudulent destinations, mislead users about the site they are visiting or evade reasonable security warnings.', '不得利用短链接、自定义域名或跳转规则冒充他人或其他机构、隐藏欺诈目标、误导用户对访问站点的判断，或规避合理的安全警告。')],
      [pair('3. Illegal or rights-infringing content', '三、违法或侵犯权利的内容'), pair('Do not publish or distribute content that is unlawful in the applicable jurisdiction or that you do not have the right to distribute, including material that infringes copyright, trademark, privacy or other legal rights.', '不得发布或传播适用司法辖区内违法的内容，也不得传播你无权发布的材料，包括侵犯著作权、商标权、隐私权或其他合法权利的内容。')],
      [pair('4. Abuse, harassment and threats', '四、骚扰、威胁与滥用'), pair('Do not use GoJet to facilitate targeted harassment, credible threats, doxxing, stalking or other conduct intended to cause harm to an individual or group.', '不得利用 GoJet 实施针对性骚扰、可信威胁、人肉搜索、跟踪或其他旨在伤害个人或群体的行为。')],
      [pair('5. Spam and unwanted bulk distribution', '五、垃圾信息与未经同意的批量传播'), pair('Do not use the service to support unsolicited bulk messaging, deceptive promotional traffic, automated account creation or other activity that creates excessive unwanted requests or complaints.', '不得利用服务支持未经请求的批量消息、欺骗性推广流量、自动批量创建账号，或其他造成大量非自愿请求或投诉的活动。')],
      [pair('6. Attempts to bypass service limits or security', '六、规避服务限制或安全措施'), pair('Do not probe, attack, overload or intentionally bypass authentication, rate limits, destination checks, file scanning, account restrictions, permission boundaries or other security controls except within an explicitly authorized security-testing scope.', '除明确授权的安全测试范围外，不得探测、攻击、压垮或故意绕过身份验证、频率限制、目标地址检测、文件扫描、账号限制、权限边界或其他安全措施。')],
      [pair('7. Enforcement and appeals', '七、处置与申诉'), pair('Content or accounts that violate this policy may be restricted, removed or suspended. Reports are reviewed using the information available at the time. If you believe an action was taken in error, contact support from the affected account and provide the relevant URL, action and context needed for review.', '违反本政策的内容或账号可能被限制、移除或暂停。举报会根据当时能够获得的信息进行审核。如认为处置有误，请尽量从受影响账号提交工单，并提供相关地址、处置情况和复核所需背景。')]
    ]
  }
];

function routeFor(route, locale) {
  if (route.startsWith('/docs/')) return locale === 'zh' ? route.replace('/docs/', '/docs/zh-CN/') : route;
  if (route === '/docs/') return locale === 'zh' ? '/docs/zh-CN/' : '/docs/';
  if (route.startsWith('/login') || route.startsWith('/register') || route.startsWith('/forgot') || route.startsWith('/reset') || route.startsWith('/verify')) return route;
  return locale === 'zh' ? (`/zh-CN${route}`).replace(/\/+/g, '/') : route;
}

function header(locale, current) {
  const nav = navigation.map(([label, href]) => `<a href="${routeFor(href, locale)}"${current.startsWith(href) ? ' aria-current="page"' : ''}>${esc(t(label, locale))}</a>`).join('');
  const switchHref = locale === 'zh' ? current : (`/zh-CN${current}`).replace(/\/+/g, '/');
  const switchLabel = locale === 'zh' ? 'English' : '简体中文';
  return `<header class="gj-website-header"><div class="site-width gj-website-header-inner"><a class="brand" href="${routeFor('/', locale)}" aria-label="GoJet">GoJet<span>.</span></a><nav class="gj-website-nav" aria-label="${locale === 'zh' ? '主导航' : 'Primary navigation'}">${nav}</nav><div class="gj-website-actions"><a class="gj-language-link" href="${switchHref}" hreflang="${locale === 'zh' ? 'en' : 'zh-CN'}">${switchLabel}</a><a class="sign-in" href="/login">${esc(t(common.signIn, locale))}</a><a class="header-cta" href="/register">${esc(t(common.getStarted, locale))}</a><details class="gj-website-mobile-menu"><summary>${locale === 'zh' ? '菜单' : 'Menu'}</summary><nav>${nav}<a href="/login">${esc(t(common.signIn, locale))}</a></nav></details></div></div></header>`;
}

function footer(locale) {
  const groups = footerGroups.map((group) => `<div class="footer-column"><h2>${esc(t(group.title, locale))}</h2>${group.items.map(([label, href]) => `<a href="${routeFor(href, locale)}">${esc(t(label, locale))}</a>`).join('')}</div>`).join('');
  return `<footer class="site-footer"><div class="site-width footer-main"><div class="footer-brand"><a class="brand" href="${routeFor('/', locale)}">GoJet<span>.</span></a><p>${locale === 'zh' ? '集中创建和管理短链接、二维码、文件、文本和个人主页，并让域名、访问规则和访问数据保持在同一个账号中。' : 'Create and manage short links, QR codes, files, text and bio pages while keeping domains, access rules and visit data in the same account.'}</p></div><div class="footer-columns">${groups}</div></div><div class="site-width footer-bottom"><span>© ${year} GoJet. ${locale === 'zh' ? '保留所有权利。' : 'All rights reserved.'}</span><div><a href="${routeFor('/legal/privacy/', locale)}">${locale === 'zh' ? '隐私政策' : 'Privacy'}</a><a href="${routeFor('/legal/terms/', locale)}">${locale === 'zh' ? '服务条款' : 'Terms'}</a><a href="${routeFor('/report-abuse/', locale)}">${locale === 'zh' ? '举报滥用' : 'Report abuse'}</a></div></div></footer>`;
}

function productStage(locale) {
  const x = (en, zh) => locale === 'zh' ? zh : en;
  return `<div class="product-stage" aria-label="${x('GoJet product preview', 'GoJet 产品预览')}" data-product-source="workspace-current-ui"><div class="ambient-halo" aria-hidden="true"></div><div class="jet-path" aria-hidden="true"><span></span><span></span><span></span></div><section class="workspace-card product-float"><div class="ui-card-head"><div><small>${x('Links', '短链接')}</small><strong>${x('Create link', '创建短链接')}</strong></div><span class="ui-status">${x('Draft', '草稿')}</span></div><div class="ui-fields"><label>${x('Destination', '目标地址')}<input value="https://example.com/campaign" readonly></label><div class="ui-grid"><label>${x('Domain', '域名')}<select><option>go.example.com</option></select></label><label>${x('Short code', '短码')}<input value="launch" readonly></label></div><label>${x('Title', '标题')}<input value="Launch campaign" readonly></label></div><button type="button" class="advanced" aria-expanded="false">${x('More options', '更多设置')}</button><button type="button" class="create-button">${x('Create link', '创建短链接')}</button></section><aside class="qr-module product-float-delayed"><small>${x('QR preview', '二维码预览')}</small><div class="qr-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><strong>PNG · SVG · PDF</strong><span>${x('Destination · Size · File format', '目标地址 · 尺寸 · 文件格式')}</span></aside><aside class="analytics-module product-float"><div><small>${x('Visit report', '访问数据')}</small><strong>${x('Recent activity', '近期访问')}</strong></div><div class="analytics-controls"><span>${x('From', '开始')}</span><span>${x('To', '结束')}</span><span>${x('Compare', '比较')}</span><span>${x('Export CSV', '导出 CSV')}</span></div><div class="analytics-filters"><span>${x('Content', '内容')}</span><span>${x('Domain', '域名')}</span><span>${x('Campaign', '推广活动')}</span><span>${x('Country', '国家/地区')}</span><span>${x('Device', '设备')}</span></div><svg viewBox="0 0 320 90" role="img" aria-label="${x('Visit trend', '访问趋势')}"><path d="M4 72 C52 70 64 32 108 45 S160 80 204 38 S266 22 316 10" fill="none" stroke="currentColor" stroke-width="2"/></svg></aside></div>`;
}

function capability(locale) {
  const items = [[pair('Short links','短链接'),'/products/links/'],[pair('QR codes','二维码'),'/products/qr-codes/'],[pair('Files','文件'),'/products/files/'],[pair('Text','文本'),'/products/text-sharing/'],[pair('Bio pages','个人主页'),'/products/link-in-bio/']];
  return `<div class="capability-ribbon" aria-label="${locale === 'zh' ? '常用功能' : 'Common features'}">${items.map(([label, href]) => `<a href="${routeFor(href, locale)}">${esc(t(label, locale))}</a>`).join('')}</div>`;
}

function homeBody(locale) {
  const x = (en, zh) => locale === 'zh' ? zh : en;
  return `<main><section class="hero site-width"><div class="hero-copy reveal"><span class="eyebrow">${x('Links and shareable content', '链接与内容分享')}</span><h1>${x('Create, publish and keep control of everything you share.', '创建并发布内容，在分享之后仍然保持可管理。')}</h1><p>${x('Create short links, QR codes, file shares, text pages and bio pages from one account. Use your own domains, set access or routing rules when needed, and review recorded visits without maintaining separate tools.', '在一个账号中创建短链接、二维码、文件分享、文本页面和个人主页。可以使用自己的域名，按需要设置访问或跳转规则，并查看真实访问数据，不必维护多套彼此分离的工具。')}</p><div class="hero-actions"><a class="primary" href="/register">${x('Create account','创建账号')}</a><a class="secondary" href="${routeFor('/docs/', locale)}">${x('Read documentation','查看使用文档')}</a></div>${capability(locale)}</div><div class="hero-stage reveal">${productStage(locale)}</div></section><section class="section site-width reveal"><h2>${x('Create the format you need, then manage the details in the same account.', '先创建真正需要的分享形式，再在同一个账号中持续管理细节。')}</h2><div class="four-grid"><article><b>01</b><h3>${x('Create what you need to share','创建需要分享的内容')}</h3><p>${x('Short links, QR codes, files, text and bio pages are available from the same workspace.','短链接、二维码、文件、文本和个人主页都可以从同一个工作区创建。')}</p></article><article><b>02</b><h3>${x('Choose the public address and access rules','设置公开地址和访问规则')}</h3><p>${x('Use an available domain, add expiration or password protection where supported, and keep shared content under the right workspace.','选择可用域名，并在支持的功能中设置有效期或密码保护，让公开内容始终归属于正确的工作区。')}</p></article><article><b>03</b><h3>${x('Update content without starting again','内容变化时无需重新开始')}</h3><p>${x('Change destinations, page content or settings behind addresses that have already been distributed.','对于已经对外发布的地址，可以继续修改目标页面、内容或相关设置。')}</p></article><article><b>04</b><h3>${x('Review visits and account activity','查看访问与账号操作')}</h3><p>${x('Use recorded visits, support history and account activity to understand what happened instead of relying on sample success states.','通过真实访问、工单记录和账号操作了解实际发生的情况，而不是依赖示例成功状态。')}</p></article></div></section><section class="section section-soft"><div class="site-width reveal"><h2>${x('Useful for campaigns, public profiles, team work and system integrations.', '适用于推广活动、公开主页、团队协作和系统集成。')}</h2><div class="three-grid"><a href="${routeFor('/solutions/marketing/', locale)}"><h3>${x('Marketing and campaigns','市场推广与活动')}</h3><p>${x('Keep campaign links, QR codes, domains and visit results together.','集中管理推广链接、二维码、域名和访问结果。')}</p></a><a href="${routeFor('/solutions/creators/', locale)}"><h3>${x('Creators and public profiles','内容创作者与公开主页')}</h3><p>${x('Maintain a stable profile address while the links and content behind it continue to change.','保持稳定的主页地址，同时持续更新其中的链接和内容。')}</p></a><a href="${routeFor('/solutions/teams/', locale)}"><h3>${x('Teams and shared workspaces','团队与共享工作区')}</h3><p>${x('Give members separate accounts and the permissions they need for shared content.','让成员使用各自账号，并按职责获得共享内容所需权限。')}</p></a></div></div></section><section class="security-band"><div class="site-width reveal"><div><h2>${x('Protect accounts and public content before problems become public.', '在问题真正影响公开内容之前保护账号和资源。')}</h2></div><div class="security-pills"><span>${x('Destination checks','目标地址检测')}</span><span>${x('File scanning','文件扫描')}</span><span>${x('Role permissions','角色权限')}</span><span>${x('Activity history','操作记录')}</span><span>${x('Human verification','人机验证')}</span></div></div></section><section class="section site-width developer-band reveal"><div><h2>${x('Connect GoJet to the systems you already use.', '把 GoJet 接入已经在使用的系统。')}</h2><p>${x('Use scoped API keys for approved operations and signed webhook notifications for events that another system needs to receive. Keep credentials private and separated by integration.','通过限定权限的 API 密钥执行经过授权的操作，通过带签名的 Webhook 把需要的事件通知给其他系统。不同集成应使用独立且妥善保管的凭据。')}</p><a class="secondary" href="${routeFor('/docs/developers/api-reference/', locale)}">${x('View API reference','查看 API 参考')}</a></div><div class="integration-card"><strong>${x('Integration basics','集成基本要求')}</strong><ul><li>${x('Use only the permissions the integration needs.','只授予集成实际需要的权限。')}</li><li>${x('Keep secrets in server-side secret storage.','把密钥保存在服务端安全存储中。')}</li><li>${x('Verify every webhook signature before processing.','处理 Webhook 前验证每次请求的签名。')}</li></ul></div></section><section class="final-cta site-width reveal"><h2>${x('Create the first item you need to share, then keep it manageable.', '先创建真正需要分享的内容，再让它在发布之后继续可管理。')}</h2><p>${x('Start with one account and add custom domains, access rules, team members or integrations only when your real use case requires them.','从一个账号开始，只有在实际场景需要时再逐步增加自定义域名、访问规则、团队成员或系统集成。')}</p><a class="primary" href="/register">${x('Create account','创建账号')}</a></section></main>`;
}

function detailBody(page, locale) {
  const cards = page.cards.map(([title, body]) => `<article><h2>${esc(t(title, locale))}</h2><p>${esc(t(body, locale))}</p></article>`).join('');
  const pricing = page.pricing ? `<div class="pricing-source" data-pricing-source="account"><h2>${locale === 'zh' ? '查看当前站点实际可用的套餐' : 'View the plans currently available for this site'}</h2><p>${locale === 'zh' ? '套餐名称、价格和计费周期以账号账单页面当前显示为准，避免官网静态价格与实际计费配置出现不一致。' : 'Plan names, prices and billing periods are shown from the billing configuration used by the account area so the website does not maintain a second set of amounts that can drift out of date.'}</p><a class="secondary" href="/app/billing">${locale === 'zh' ? '进入账单与套餐' : 'Open Billing & Plans'}</a></div>` : '';
  return `<main><section class="detail-hero site-width reveal"><h1>${esc(t(page.heading, locale))}</h1><p>${esc(t(page.lead, locale))}</p><div class="hero-actions"><a class="primary" href="/register">${esc(t(common.getStarted, locale))}</a><a class="secondary" href="${routeFor('/docs/', locale)}">${esc(t(common.docs, locale))}</a></div></section>${capability(locale)}<section class="section site-width reveal"><div class="detail-grid">${cards}</div>${pricing}</section><section class="final-cta site-width reveal"><h2>${locale === 'zh' ? '准备好后，从自己的工作区开始。' : 'When you are ready, start from your own workspace.'}</h2><p>${locale === 'zh' ? '创建账号后可以先完成最核心的操作，再根据实际需要逐步开启更多设置。' : 'Create an account, complete the core task first and add more settings only when your actual use requires them.'}</p><a class="primary" href="/register">${esc(t(common.getStarted, locale))}</a></section></main>`;
}

function legalBody(page, locale) {
  const sections = page.sections.map(([heading, body]) => `<section class="legal-section"><h2>${esc(t(heading, locale))}</h2><p>${esc(t(body, locale))}</p></section>`).join('');
  return `<main><section class="detail-hero legal-hero site-width"><h1>${esc(t(page.heading, locale))}</h1><p>${esc(t(page.intro, locale))}</p><p class="legal-updated">${locale === 'zh' ? '最后更新：2026 年 8 月 20 日' : 'Last updated: 20 August 2026'}</p></section><div class="site-width legal-layout"><aside class="legal-note"><strong>${locale === 'zh' ? '相关页面' : 'Related pages'}</strong><a href="${routeFor('/legal/privacy/', locale)}">${locale === 'zh' ? '隐私政策' : 'Privacy Policy'}</a><a href="${routeFor('/legal/terms/', locale)}">${locale === 'zh' ? '服务条款' : 'Terms of Service'}</a><a href="${routeFor('/legal/acceptable-use/', locale)}">${locale === 'zh' ? '可接受使用政策' : 'Acceptable Use Policy'}</a><a href="${routeFor('/report-abuse/', locale)}">${locale === 'zh' ? '举报滥用' : 'Report Abuse'}</a></aside><article class="legal-content">${sections}</article></div></main>`;
}

function abuseBody(locale) {
  const x = (en, zh) => locale === 'zh' ? zh : en;
  return `<main><section class="detail-hero site-width"><h1>${x('Report abuse or harmful content','举报滥用或有害内容')}</h1><p>${x('Use this page when a GoJet link, file, text page or public profile appears to be used for phishing, malware, fraud, harassment, rights infringement or another prohibited activity.','当 GoJet 短链接、文件、文本页面或公开个人主页疑似被用于钓鱼、恶意软件、欺诈、骚扰、侵权或其他禁止行为时，请通过此页面举报。')}</p></section><section class="section site-width"><div class="report-grid"><article><h2>${x('What to include','需要提供的信息')}</h2><p>${x('Provide the exact GoJet URL, describe what you observed and include the minimum context needed to review the report. Do not submit passwords, payment card data or unrelated private information.','请提供准确的 GoJet 地址、说明发现的问题，并补充审核所需的最少背景信息。不要提交密码、银行卡数据或与举报无关的私人信息。')}</p></article><article><h2>${x('What happens next','提交后的处理')}</h2><p>${x('Reports are reviewed against the Terms of Service and Acceptable Use Policy. Content may be restricted while a serious safety concern is investigated, and additional information may be requested when the report cannot be evaluated from the submitted evidence.','举报会按照《服务条款》和《可接受使用政策》审核。对于严重安全风险，调查期间相关内容可能被临时限制；如果现有材料不足以判断，也可能需要补充信息。')}</p></article><article><h2>${x('Account-specific support','账号相关问题')}</h2><p>${x('If the issue concerns your own account, billing or workspace permissions rather than abusive public content, sign in and open a support ticket so the request can be handled with the correct account context.','如果问题涉及你自己的账号、账单或工作区权限，而不是公开内容滥用，请登录后提交工单，以便在正确的账号上下文中处理。')}</p></article></div><div class="report-action"><a class="primary" href="/reportabuse">${x('Open abuse report form','打开滥用举报表单')}</a></div></section></main>`;
}

function htmlDocument({ route, locale, title, description, body }) {
  const lang = locale === 'zh' ? 'zh-CN' : 'en';
  const publicRoute = routeFor(route, locale);
  const canonical = `${origin}${publicRoute}`;
  const alternate = `${origin}${routeFor(route, locale === 'zh' ? 'en' : 'zh')}`;
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@type': route === '/' ? 'SoftwareApplication' : 'WebPage', name: t(title, locale), url: canonical, description: t(description, locale) });
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t(title, locale))}</title><meta name="description" content="${esc(t(description, locale))}"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="${locale === 'zh' ? 'en' : 'zh-CN'}" href="${alternate}"><link rel="alternate" hreflang="x-default" href="${origin}${route}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(t(title, locale))}"><meta property="og:description" content="${esc(t(description, locale))}"><meta property="og:url" content="${canonical}"><meta property="og:site_name" content="GoJet"><link rel="stylesheet" href="/marketing.css"><script>document.cookie='gojet_locale=${locale === 'zh' ? 'zh-CN' : 'en'}; Path=/; Max-Age=31536000; SameSite=Lax'</script><script type="application/ld+json">${jsonLd}</script></head><body><div class="gj-website-shell">${header(locale, route)}<div class="gj-website-content">${body}</div>${footer(locale)}</div><script src="/marketing.js" defer></script></body></html>`;
}

function writeRoute(route, locale, html) {
  const relative = route === '/' ? '' : route.replace(/^\//, '');
  const root = locale === 'zh' ? path.join(dist, 'zh-CN') : dist;
  const out = path.join(root, relative, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

if (!fs.existsSync(dist)) throw new Error('Run vite build before static prerender.');
const spa = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const route of ['/login/','/register/','/verify-email/','/forgot-password/','/reset-password/','/verifyemail/','/resetpassword/','/dev/ui/']) {
  const out = path.join(dist, route.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, spa);
}

for (const page of pages) {
  for (const locale of ['en', 'zh']) {
    const body = page.home ? homeBody(locale) : detailBody(page, locale);
    writeRoute(page.route, locale, htmlDocument({ route: page.route, locale, title: page.title, description: page.description, body }));
  }
}
for (const page of legalPages) {
  for (const locale of ['en', 'zh']) writeRoute(page.route, locale, htmlDocument({ route: page.route, locale, title: page.title, description: page.intro, body: legalBody(page, locale) }));
}
for (const locale of ['en', 'zh']) {
  const title = pair('Report Abuse — GoJet', '举报滥用 — GoJet');
  const description = pair('Report a GoJet link or public resource that appears to be used for prohibited or harmful activity.', '举报疑似被用于禁止或有害行为的 GoJet 链接或公开资源。');
  writeRoute('/report-abuse/', locale, htmlDocument({ route: '/report-abuse/', locale, title, description, body: abuseBody(locale) }));
}

const allRoutes = [...pages.map((page) => page.route), ...legalPages.map((page) => page.route), '/report-abuse/'];
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
const sitemapUrls = allRoutes.flatMap((route) => [route, routeFor(route, 'zh')]);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapUrls.map((route) => `<url><loc>${origin}${route}</loc></url>`).join('')}</urlset>`);
console.log(`Static site ready: ${allRoutes.length} routes in English and Simplified Chinese plus authentication SPA entries.`);
