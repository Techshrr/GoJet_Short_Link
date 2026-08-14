#!/usr/bin/env python3
import argparse
import re
import shutil
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'frontend' / 'publicsite'
PAGES = SOURCE / 'pages'
ASSETS = SOURCE / 'assets'
SHARED = ROOT / 'frontend' / 'shared'
DEFAULT_OUTPUT = ROOT / 'build' / 'public'

GENERIC = {
    'about': ('关于 GoJet', 'GoJet 把短链接、二维码、内容分享和访问分析放进一个清晰的工作区，让日常分享更容易创建、维护和复盘。', [
        ('一致的体验', '官网、控制台、邮件和公开分享页面使用统一的品牌语言与交互习惯。'),
        ('清晰的状态', '重要操作明确显示处理中、成功或失败，减少重复操作和不确定感。'),
        ('明确的边界', '系统资源、用户资源和敏感配置分开管理，降低误删和相互影响。'),
    ]),
    'contact': ('联系我们', '产品使用、账户与账单、团队协作或安全问题，都可以通过对应入口持续跟进。', [
        ('客户工单', '登录账户后提交工单，回复、状态和处理记录都会保留在同一会话中。'),
        ('产品与合作', '了解套餐、品牌、自定义域名和团队使用方式。'),
        ('安全与滥用', '发现可疑链接或内容时，可使用公开的滥用举报入口。'),
    ]),
    'resources': ('资源中心', '集中查看使用指南、服务状态和常见帮助入口。', [
        ('帮助文档', '查找账户、短链接、二维码、分享和团队操作说明。'),
        ('服务状态', '查看主要服务的当前状态和必要通知。'),
        ('安全与滥用', '了解安全使用建议，并报告可疑链接或内容。'),
    ]),
    'developers': ('开发者 API', '把常用的链接创建、查询与管理动作接入自己的业务流程。', [
        ('接口鉴权', '通过受控凭据访问允许的功能。'),
        ('清晰响应', '围绕常见业务动作提供明确的请求与结果。'),
        ('权限控制', '接口操作遵循账户和工作区的现有权限范围。'),
    ]),
    'blog': ('GoJet 博客', '分享链接管理、二维码、品牌和访问分析中的实用方法。', [
        ('产品实践', '更高效地整理和维护链接与二维码。'),
        ('运营方法', '设计更清晰的活动入口和渠道追踪。'),
        ('安全意识', '降低恶意链接、误操作和账户风险。'),
    ]),
    'browserextension': ('GoJet 浏览器扩展', '在浏览网页时更快创建、复制和管理常用链接。', [
        ('快速创建', '减少在网页与控制台之间来回切换。'),
        ('一键复制', '创建后即可复制并发送给需要的人。'),
        ('账户同步', '与自己的 GoJet 工作区保持一致。'),
    ]),
    'apps': ('GoJet 应用', '在不同设备和工作场景中访问常用 GoJet 功能。', [
        ('随时管理', '快速查看常用链接、二维码和分享资源。'),
        ('保持同步', '关键内容与工作区保持一致。'),
        ('聚焦常用操作', '减少复杂步骤和不必要入口。'),
    ]),
    'changelog': ('GoJet 更新日志', '查看产品体验、可靠性和安全能力的版本更新。', [
        ('产品体验', '页面、交互和工作流程改进。'),
        ('稳定性', '服务可用性和异常处理体验改进。'),
        ('安全', '账户、权限和风险控制相关改进。'),
    ]),
    'solutions/marketing': ('营销解决方案', '用短链接、二维码和访问分析连接线上线下营销触点。', [
        ('渠道管理', '统一组织活动链接和二维码。'),
        ('品牌一致', '使用自己的域名和统一视觉。'),
        ('效果复盘', '查看访问、来源、地区和设备表现。'),
    ]),
    'solutions/creators': ('创作者解决方案', '用个人主页、链接和访问分析连接内容与受众。', [
        ('统一入口', '把重要内容聚合到一个可分享页面。'),
        ('灵活更新', '内容变化时无需频繁更换公开入口。'),
        ('了解受众', '查看常用访问和来源指标。'),
    ]),
    'solutions/teams': ('团队解决方案', '用工作区、角色权限和工单支持组织多人协作。', [
        ('工作区协作', '按团队或项目组织链接与分享资源。'),
        ('角色权限', '让成员只操作职责范围内的内容。'),
        ('客户支持', '通过工单保留问题、回复和处理状态。'),
    ]),
}

PRODUCTS = {
    'urlshortener': ('短链接', 'SHORT LINKS', '把冗长网址变成更容易分享、管理和复盘的短链接。', ['自定义短码与跳转状态', '链接发出后仍可维护目标', '密码、有效期与访问规则'], ['粘贴目标网址', '选择域名并设置短码', '分享并持续查看访问表现']),
    'qrcode': ('二维码', 'QR CODE', '让线下物料通过同一条可维护短链接持续连接线上内容。', ['二维码与短链接保持关联', '多种尺寸与前景/背景颜色', '单独统计二维码访问'], ['选择正在使用的短链接', '生成并下载二维码', '更新链接目标而无需重印二维码']),
    'analytics': ('访问分析', 'ANALYTICS', '用清晰的数据了解链接从哪里被打开、使用什么设备，以及访问变化。', ['点击与独立访客', '来源、地区、设备与浏览器', '最近访问与二维码访问区分'], ['创建并分享链接', '等待真实访问发生', '在工作区查看趋势与明细']),
    'biopages': ('个人主页', 'BIO PAGES', '用一个长期入口整理品牌、社交账号、内容和活动链接。', ['多种页面风格', '链接排序与实时预览', '公开地址长期保持稳定'], ['创建主页并填写介绍', '添加需要展示的入口', '预览后发布并持续更新']),
    'textsharing': ('文本分享', 'TEXT SHARING', '快速分享普通文本、Markdown、代码片段和临时说明。', ['纯文本、Markdown 与代码模式', '代码源码安全展示与 HTML 编写预览', '密码、有效期与一次性读取'], ['选择内容格式', '编写并预览内容', '设置访问规则后复制分享地址']),
    'filesharing': ('文件分享', 'FILE SHARING', '在安全检查完成后生成可控的文件分享入口。', ['上传后先执行安全检查', '密码、有效期与下载次数', '分享状态与下载次数可查看'], ['选择一个文件上传', '等待安全检查完成', '复制分享地址并管理访问']),
    'customdomains': ('自定义域名', 'CUSTOM DOMAINS', '让短链接延续自己的品牌域名和信任感。', ['DNS 所有权验证', 'HTTPS 状态检查', '验证通过后用于短链接'], ['添加需要使用的域名', '按提示配置 DNS', '验证通过后创建品牌短链']),
    'smartlinks': ('智能链接', 'SMART LINKS', '根据访问上下文把不同访客送达更合适的目标。', ['按地区、设备、语言或来源配置规则', '保留统一公开入口', '与访问分析结合复盘'], ['创建统一短链接', '配置命中条件与目标', '根据访问数据持续优化']),
    'abtesting': ('A/B 测试', 'A/B TESTING', '让同一入口在多个目标之间分配流量，用真实访问比较表现。', ['多目标流量分配', '保持一个公开短链接', '结合访问结果持续调整'], ['添加候选目标', '配置流量比例', '观察数据并选择更合适的方案']),
    'qrcampaigns': ('QR 营销活动', 'QR CAMPAIGNS', '围绕活动批量组织二维码、短链接和访问表现。', ['统一管理活动入口', '线下物料与线上内容连接', '访问结果集中复盘'], ['建立活动与链接', '生成所需二维码', '上线后持续查看访问表现']),
}

PRODUCT_USE_CASES = {
    '短链接': [('营销活动', '把广告、短信、社交媒体和线下物料统一到更容易记忆的短网址。'), ('日常协作', '把冗长后台地址或文档地址变成团队容易复制和识别的入口。'), ('长期链接', '公开地址保持不变，目标内容发生变化时只需要更新后台目标。')],
    '二维码': [('印刷物料', '菜单、海报、包装、展架和名片使用同一条可维护二维码入口。'), ('线下活动', '把不同物料的扫码访问单独统计，便于判断线下触点表现。'), ('长期展示', '目标页面更新后无需重新生成或重新印刷二维码。')],
    '访问分析': [('渠道复盘', '比较不同来源、设备和地区的真实访问差异。'), ('内容运营', '观察链接在不同时间的访问趋势和独立访客变化。'), ('线下扫码', '把二维码访问与普通短链接访问区分开查看。')],
    '个人主页': [('创作者主页', '将社交账号、作品、内容和联系方式放到一个长期地址。'), ('品牌入口', '用统一视觉整理品牌官网、活动、产品和支持入口。'), ('活动导航', '活动内容变化时更新页面内容，而不是重新发布入口。')],
    '文本分享': [('代码片段', '分享 HTML、JSON、Shell、配置文件和日志，同时保持源码安全展示。'), ('Markdown 文档', '快速发布带标题、列表、引用、链接和代码块的临时说明。'), ('一次性内容', '对临时信息设置密码、有效期或读取一次后失效。')],
    '文件分享': [('交付文件', '为客户或团队成员生成受控下载地址。'), ('临时附件', '设置有效期、密码和下载次数，避免文件长期暴露。'), ('安全分发', '文件先经过安全检查，再进入可下载状态。')],
    '自定义域名': [('品牌短链', '使用自己的域名替代平台公共域名，提高识别度。'), ('多品牌管理', '同一账户可以根据业务和品牌选择不同已验证域名。'), ('长期资产', '把公开入口沉淀到自己可管理的域名体系中。')],
    '智能链接': [('地区分流', '不同国家或地区访问同一短链时进入更合适的页面。'), ('设备分流', '移动端、桌面端或特定设备进入不同下载或落地页。'), ('来源分流', '根据访问来源和语言把访客送达不同目标。')],
    'A/B 测试': [('落地页比较', '让两个页面按比例获取访问，比较真实表现。'), ('活动素材', '同一公开入口背后测试不同营销页面。'), ('持续优化', '根据结果调整比例，而不需要更换已经公开的短链。')],
    'QR 营销活动': [('门店活动', '统一组织门店物料二维码并集中查看访问。'), ('展会与发布会', '为不同展位或素材生成独立入口。'), ('批量投放', '把二维码、短链和访问表现放进同一活动中管理。')],
}

STATIC_VERSION_QUERY = '?' + 'v='
FORBIDDEN = re.compile(
    r'Fresh Install|GoJet V4|不是静态演示数据|真实业务接口|Redis Worker|fileworker|analytics_events|RBAC 权限模型|V4 平台 API|后端业务闭环|可部署|product-hardening|hardening-release|/system-images/|SYSTEM_IMAGE_PATH|'
    + re.escape(STATIC_VERSION_QUERY),
    re.I,
)


def header():
    return '<header class="siteHeader"><div class="container nav"><a class="logo" href="/">GoJet<i>.</i></a></div></header>'


def footer():
    return '<footer><div class="container"><a class="logo" href="/">GoJet<i>.</i></a></div></footer><script src="/assets/app.js"></script>'


def generic_page(title, desc, cards, contact=False):
    items = ''.join(f'<article class="card"><h3>{escape(a)}</h3><p>{escape(b)}</p></article>' for a, b in cards)
    extra = '<section class="section alt"><div class="container split"><div><span class="eyebrow">已有账户</span><h2>优先从客户工单继续沟通</h2><p>工单会保留问题上下文、双方回复和当前处理状态，更适合持续跟进账户、账单和产品问题。</p><div class="actions"><a class="btn primary" href="/app/support">进入支持工单</a><a class="btn" href="/reportabuse">滥用举报</a></div></div></div></section>' if contact else ''
    return f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{escape(desc)}"><title>{escape(title)} · GoJet</title><link rel="stylesheet" href="/assets/styles.css"></head><body>{header()}<main><section class="hero"><div class="container"><span class="eyebrow">GOJET</span><h1>{escape(title)}</h1><p>{escape(desc)}</p><div class="actions"><a class="btn primary" href="/register">免费开始</a><a class="btn" href="/pricing">查看套餐</a></div></div></section><section class="section"><div class="container"><div class="cards">{items}</div></div></section>{extra}<section class="cta"><div class="container"><div class="ctaBox"><h2>把链接与分享集中到一个工作区</h2><p>从免费账户开始，再按实际需要使用更多能力。</p><div class="actions" style="justify-content:center"><a class="btn" href="/register">免费开始</a></div></div></div></section></main>{footer()}</body></html>'


def product_visual(title):
    visuals = {
        '短链接': '<div class="productVisual pv-link"><div class="pv-browser"><span></span><span></span><span></span><b>创建短链接</b></div><label>目标网址<div>https://example.com/very/long/product/page</div></label><div class="pv-inline"><label>短链域名<div>gojet.cc</div></label><label>自定义短码<div>launch</div></label></div><div class="pv-output"><small>创建完成</small><strong>gojet.cc/launch</strong><i>复制</i></div></div>',
        '二维码': '<div class="productVisual pv-qr"><div class="pv-qr-code" aria-hidden="true"></div><div class="pv-qr-side"><small>动态二维码</small><strong>产品发布会</strong><p>目标地址可以继续更新，二维码本身保持不变。</p><div class="pv-color"><i></i><i></i><i></i><i></i></div><span>PNG</span><span>SVG</span><span>PDF</span></div></div>',
        '访问分析': '<div class="productVisual pv-analytics"><div class="pv-metrics"><article><small>访问</small><b>12,842</b><em>+18.4%</em></article><article><small>独立访客</small><b>9,306</b><em>+12.1%</em></article></div><div class="pv-chart"><i style="height:28%"></i><i style="height:43%"></i><i style="height:37%"></i><i style="height:68%"></i><i style="height:58%"></i><i style="height:84%"></i><i style="height:72%"></i><i style="height:94%"></i></div><div class="pv-sources"><span>直接访问 <b>42%</b></span><span>社交媒体 <b>31%</b></span><span>二维码 <b>27%</b></span></div></div>',
        '个人主页': '<div class="productVisual pv-bio"><div class="pv-phone"><div class="pv-avatar">G</div><b>GoJet Studio</b><small>@gojet</small><a>产品介绍</a><a>最新活动</a><a>联系我们</a></div><div class="pv-theme-stack"><i></i><i></i><i></i><small>主题实时预览</small></div></div>',
        '文本分享': '<div class="productVisual pv-code"><div class="pv-code-head"><span>HTML</span><b>launch.html</b><i>安全预览</i></div><pre><code>&lt;main class=&quot;launch&quot;&gt;\n  &lt;h1&gt;Hello GoJet&lt;/h1&gt;\n  &lt;a href=&quot;/docs/&quot;&gt;Docs&lt;/a&gt;\n&lt;/main&gt;</code></pre><div class="pv-code-foot"><span>纯文本</span><span>Markdown</span><span class="on">代码</span></div></div>',
        '文件分享': '<div class="productVisual pv-files"><div class="pv-upload"><strong>安全文件分享</strong><small>上传后先完成安全检查</small></div><div class="pv-file"><i>PDF</i><span><b>proposal.pdf</b><small>2.4 MB · 已通过安全检查</small></span><em>可分享</em></div><div class="pv-file"><i>ZIP</i><span><b>assets.zip</b><small>18.7 MB · 已通过安全检查</small></span><em>可分享</em></div></div>',
        '自定义域名': '<div class="productVisual pv-domain"><div class="pv-domain-name"><small>品牌短链域名</small><strong>go.example.com</strong><em>已验证</em></div><div class="pv-dns"><span><b>TXT</b><code>_gojet.verify</code><i>已匹配</i></span><span><b>CNAME</b><code>gojet.example.net</code><i>已匹配</i></span><span><b>HTTPS</b><code>自动证书</code><i>正常</i></span></div></div>',
        '智能链接': '<div class="productVisual pv-route"><div class="pv-route-source">gojet.cc/app</div><i>↓</i><div class="pv-route-rules"><span><b>中国大陆</b><em>→ /cn</em></span><span><b>移动设备</b><em>→ /mobile</em></span><span><b>其他访问</b><em>→ /global</em></span></div></div>',
        'A/B 测试': '<div class="productVisual pv-ab"><div class="pv-ab-url">gojet.cc/campaign</div><div class="pv-ab-grid"><article><small>版本 A</small><b>60%</b><div><i style="width:60%"></i></div><span>landing-a</span></article><article><small>版本 B</small><b>40%</b><div><i style="width:40%"></i></div><span>landing-b</span></article></div><p>同一个公开入口 · 按比例自动分配</p></div>',
        'QR 营销活动': '<div class="productVisual pv-campaign"><div class="pv-campaign-head"><b>春季门店活动</b><span>12 个二维码</span></div><div class="pv-campaign-grid"><i></i><i></i><i></i><i></i></div><div class="pv-campaign-metrics"><span>扫码 <b>8,416</b></span><span>门店 <b>12</b></span><span>转化入口 <b>4</b></span></div></div>',
    }
    return visuals.get(title, '<div class="productVisual"><strong>GoJet</strong></div>')


def product_page(title, kicker, desc, features, steps):
    benefits = ''.join(f'<article class="productBenefit"><span>0{i}</span><h3>{escape(name)}</h3><p>{escape(description)}</p></article>' for i, (name, description) in enumerate(PRODUCT_USE_CASES.get(title, []), 1))
    feature_cards = ''.join(f'<article class="productFeature"><i>✓</i><h3>{escape(name)}</h3><p>配置集中在同一个工作区，创建后仍可持续查看和维护。</p></article>' for name in features)
    flow = ''.join(f'<article class="productStep"><span>{i:02d}</span><div><h3>{escape(name)}</h3><p>完成当前步骤后即可继续下一步，关键状态和结果都会明确显示。</p></div></article>' for i, name in enumerate(steps, 1))
    faq = f'<details><summary>{escape(title)}创建后还能继续管理吗？</summary><p>可以。创建后的资源会保留在工作区中，后续可以根据功能支持范围继续更新内容、规则或状态。</p></details><details><summary>能和 GoJet 其他功能一起使用吗？</summary><p>可以。{escape(title)}与短链接、二维码、分析、分享、域名和团队能力使用同一个账户与工作区。</p></details><details><summary>第一次使用从哪里开始？</summary><p>登录控制台后按本页三步流程操作即可；需要更详细说明时可以直接进入帮助文档。</p></details>'
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{escape(desc)}"><title>{escape(title)} · GoJet</title><link rel="stylesheet" href="/assets/styles.css"></head><body>{header()}<main class="productLanding">
<section class="hero productHero"><div class="container productHeroGrid"><div class="productHeroCopy"><span class="eyebrow">{escape(kicker)}</span><h1>{escape(title)}</h1><p>{escape(desc)}</p><div class="actions"><a class="btn primary" href="/register">免费开始</a><a class="btn" href="/docs/">查看使用文档</a></div><div class="productHeroTrust"><span>清晰创建</span><span>持续管理</span><span>结果可追踪</span></div></div>{product_visual(title)}</div></section>
<section class="section productStory"><div class="container"><div class="sectionHead"><span class="eyebrow">为什么使用 {escape(title)}</span><h2>从具体场景出发，而不是堆功能</h2><p>每个入口都对应一个实际任务：更快创建、更容易维护，以及在分享之后知道发生了什么。</p></div><div class="productBenefits">{benefits}</div></div></section>
<section class="section alt productCapabilities"><div class="container"><div class="sectionHead"><span class="eyebrow">核心能力</span><h2>{escape(title)}需要的关键能力集中在这里</h2></div><div class="productFeatureGrid">{feature_cards}</div></div></section>
<section class="section productWorkflow"><div class="container productWorkflowGrid"><div class="sectionHead"><span class="eyebrow">使用方式</span><h2>三步完成主要流程</h2><p>不需要先理解复杂配置，先完成核心动作，再按需要逐步打开高级能力。</p><a class="docsAction" href="/docs/">查看完整帮助文档 →</a></div><div class="productSteps">{flow}</div></div></section>
<section class="section productFAQ"><div class="container"><div class="sectionHead"><span class="eyebrow">常见问题</span><h2>开始前需要了解的内容</h2></div><div class="mk-faq">{faq}</div></div></section>
<section class="cta"><div class="container"><div class="ctaBox"><h2>开始使用 {escape(title)}</h2><p>创建账户后即可在 GoJet 工作区中使用，并和其他分享能力一起持续管理。</p><div class="actions" style="justify-content:center"><a class="btn" href="/register">免费开始</a><a class="btn" href="/docs/">阅读文档</a></div></div></div></section>
</main>{footer()}</body></html>'''


def pricing_page():
    return f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="GoJet 套餐覆盖个人使用、专业增长与团队协作；价格与权益实时读取当前站点配置。"><title>套餐价格 · GoJet</title><link rel="stylesheet" href="/assets/styles.css"></head><body>{header()}<main><section class="hero pricingHero"><div class="container"><h1>从个人使用，到团队协作</h1><p>每档套餐的价格、资源配额与功能差异都会从当前站点配置读取，方便直接比较后选择。</p><div class="actions"><a class="btn primary" href="/register">免费开始</a><a class="btn pricingLogin" href="/login">登录账户</a></div></div></section><section class="section"><div class="container"><div id="livePricing" class="pricing"><article class="price pricingSkeleton"><h3>正在读取套餐</h3><p>价格与权益正在同步…</p></article></div></div></section></main>{footer()}</body></html>'


def validate(route, html):
    match = FORBIDDEN.search(html)
    if match:
        raise SystemExit(f'public page {route} contains forbidden engineering copy: {match.group(0)}')
    if '<!doctype html>' not in html.lower() or '</html>' not in html.lower():
        raise SystemExit(f'public page {route} is not a complete HTML document')
    if route.startswith('products/'):
        for marker in ('class="hero', 'class="section', 'class="cta"'):
            if marker not in html:
                raise SystemExit(f'product page {route} is missing canonical shell marker {marker}')


def output_path(output, route):
    if route == 'home':
        return output / 'index.html'
    path = Path(route)
    return output / path.parent / f'{path.name}.html'


def write(output, route, html):
    validate(route, html)
    target = output_path(output, route)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding='utf-8')


def route_from_output(output, path):
    if path == output / 'index.html':
        return 'home'
    return path.relative_to(output).with_suffix('').as_posix()


def build(output):
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    shutil.copytree(ASSETS, output / 'assets')
    shutil.copy2(SHARED / 'gojetdesignsystem.css', output / 'assets' / 'gojetdesignsystem.css')
    shutil.copy2(SHARED / 'brandruntime.js', output / 'assets' / 'brandruntime.js')

    bad_sources = list(PAGES.rglob('index.html'))
    if bad_sources:
        raise SystemExit('canonical public source must not contain route index.html files')

    for src in sorted(PAGES.rglob('*.html')):
        rel = src.relative_to(PAGES)
        route = 'home' if rel == Path('home.html') else rel.with_suffix('').as_posix()
        write(output, route, src.read_text(encoding='utf-8'))

    authored = {'home' if p.relative_to(PAGES) == Path('home.html') else p.relative_to(PAGES).with_suffix('').as_posix() for p in PAGES.rglob('*.html')}
    for route, (title, desc, cards) in GENERIC.items():
        if route in authored:
            continue
        write(output, route, generic_page(title, desc, cards, route == 'contact'))
    for slug, data in PRODUCTS.items():
        write(output, f'products/{slug}', product_page(*data))
    write(output, 'pricing', pricing_page())

    expected = set(GENERIC) | {
        'home', 'docs', 'pricing', 'announcements', 'forgotpassword', 'login', 'privacy',
        'register', 'reportabuse', 'resetpassword', 'status', 'terms', 'verifyemail',
    } | {f'products/{slug}' for slug in PRODUCTS}
    built = {route_from_output(output, path) for path in output.rglob('*.html')}
    missing = sorted(expected - built)
    if missing:
        raise SystemExit('public build is missing routes: ' + ', '.join(missing))

    scattered = [path for path in output.rglob('index.html') if path != output / 'index.html']
    if scattered:
        raise SystemExit('public build contains nested one page index directories: ' + ', '.join(str(p.relative_to(output)) for p in scattered))

    hyphenated = [path for path in output.rglob('*') if '-' in path.name]
    if hyphenated:
        raise SystemExit('public build contains hyphenated file or directory names: ' + ', '.join(str(p.relative_to(output)) for p in hyphenated))

    return len(built)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    count = build(args.output.resolve())
    print(f'public site build ready: {args.output.resolve()} ({count} routes, flat page output)')


if __name__ == '__main__':
    main()
