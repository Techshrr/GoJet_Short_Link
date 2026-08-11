#!/usr/bin/env python3
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1] / 'frontend' / 'marketing-site'

PRODUCTS = {
    'url-shortener': ('短链接', '让每一条长链接，变成可管理的品牌入口。', '创建品牌短链、自定义短码、访问保护、到期策略和营销参数，并在同一工作区持续管理。', ['短码与域名', '生命周期', '访问保护', '智能路由', 'A/B 分流', '组织管理'], ['营销活动', '产品发布', '客服与运营', '渠道追踪']),
    'analytics': ('访问分析', '看见链接背后的访问表现，而不只是一个点击数字。', '在统一数据面板理解点击、访客、来源、设备、地区与活动表现。', ['点击趋势', '独立访客', '来源分析', '设备维度', '异常访问', '数据导出'], ['增长分析', '渠道归因', '内容运营', '异常排查']),
    'qr-code': ('二维码', '把线上链接，带到每一个线下触点。', '为链接和活动生成二维码，让包装、展架、门店、资料和活动现场拥有可管理的数字入口。', ['动态二维码', '链接联动', '访问分析', '批量管理', '生命周期', '随时下载'], ['线下物料', '包装标签', '活动现场', '门店导流']),
    'bio-pages': ('个人主页', '用一个页面，承载所有重要入口。', '创建简洁的个人主页，把社交账号、内容、产品、活动和其他链接放进统一公开页面。', ['统一主页', '链接组件', '品牌展示', '移动优先', '工作区管理', '持续更新'], ['创作者主页', '社交媒体', '个人品牌', '活动导航']),
    'text-sharing': ('文本分享', '临时文本、说明和代码，也值得一个干净的分享地址。', '快速发布文本内容，通过独立地址分享，并在工作区继续更新、查看和删除。', ['快速发布', '独立地址', '生命周期', '统一权限', '资源列表', '轻量交付'], ['代码片段', '临时说明', '活动文本', '团队交付']),
    'file-sharing': ('文件分享', '文件可以快速分享，安全状态也应该清楚可见。', '文件上传后进入安全检查流程，通过检查后再开放分享；管理员可以查看扫描、隔离和处理状态。', ['文件分享', '安全扫描', '隔离状态', '管理员队列', '下载统计', '存储隔离'], ['文件交付', '产品资料', '临时下载', '团队共享']),
}


def header():
    return '''<header class="header"><div class="wrap nav"><a class="logo" href="/">GoJet<span>.</span></a><div class="nav-links"><a href="/products/url-shortener/">产品</a><a href="/solutions/marketing/">解决方案</a><a href="/pricing/">定价</a><a href="/resources/">资源</a><a href="/about/">关于</a></div><div class="nav-actions"><a class="btn" href="/login/">登录</a><a class="btn brand" href="/register/">免费开始</a></div></div></header>'''


def footer():
    return '''<footer class="footer"><div class="wrap"><div class="footer-grid"><div><a class="logo" href="/">GoJet<span>.</span></a><p>让链接、二维码与每次触达更清晰、更可控。</p></div><div><b>产品</b><a href="/products/url-shortener/">短链接</a><a href="/products/analytics/">访问分析</a><a href="/products/qr-code/">二维码</a></div><div><b>分享</b><a href="/products/bio-pages/">个人主页</a><a href="/products/text-sharing/">文本分享</a><a href="/products/file-sharing/">文件分享</a></div><div><b>资源</b><a href="/pricing/">定价</a><a href="/docs/">帮助文档</a><a href="/status/">服务状态</a></div><div><b>GoJet</b><a href="/about/">关于</a><a href="/contact/">联系我们</a><a href="/privacy/">隐私政策</a><a href="/terms/">服务条款</a><a href="/report-abuse/">滥用举报</a></div></div><div class="legal"><span>© 2026 GoJet. 保留所有权利。</span><span><a href="/privacy/">隐私政策</a> · <a href="/terms/">服务条款</a></span></div></div></footer>'''


def head(title, desc):
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} — GoJet</title><meta name="description" content="{escape(desc)}"><link rel="stylesheet" href="/assets/gojet-design-system.css"><link rel="stylesheet" href="/assets/product.css"><link rel="stylesheet" href="/assets/product-brand.css"></head><body>'''


def product_page(slug, item):
    name, title, desc, features, uses = item
    cards = ''.join(f'<article class="feature-card"><em>{i + 1:02}</em><h3>{escape(feature)}</h3><p>在统一工作区中完成配置、查看状态并持续管理。</p></article>' for i, feature in enumerate(features))
    tags = ''.join(f'<span>{escape(tag)}</span>' for tag in uses)
    return head(title, desc) + header() + f'''<main><section class="product-hero"><div class="wrap product-hero-grid"><div><div class="crumb"><a href="/">GoJet</a> / 产品 / {escape(name)}</div><span class="eyebrow">GOJET</span><h1>{escape(title)}</h1><p>{escape(desc)}</p><div class="hero-actions"><a class="btn brand" href="/register/">免费开始</a><a class="btn" href="/login/">进入控制台</a></div><div class="hero-note">一个账户 · 一个工作区 · 统一品牌与权限</div></div><div class="product-demo"><div class="demo-bar"><i></i><i></i><i></i></div><div class="demo-canvas"><span class="demo-title">GOJET WORKSPACE</span><div class="demo-big">{escape(name)}</div><div class="demo-row"><div><span>状态</span><strong>可用</strong></div><div><span>工作区</span><strong>统一</strong></div><div><span>管理</span><strong>清晰</strong></div></div><div class="mini-bars">{''.join(f'<i style="height:{h}%"></i>' for h in [28,44,37,66,57,78,70,96,81,89])}</div></div></div></div></section><section class="value-strip"><div class="wrap"><div><b>统一工作区</b><span>资源与权限集中管理</span></div><div><b>清晰状态</b><span>重要操作结果及时可见</span></div><div><b>品牌一致</b><span>官网、控制台与分享页面统一</span></div><div><b>安全边界</b><span>系统资源与用户资源分离</span></div></div></section><section class="section"><div class="wrap"><div class="section-head"><small>CAPABILITIES</small><h2>把常用能力放进清晰的日常工作流。</h2><p>从创建、配置到后续管理，每一步都围绕实际使用场景组织。</p></div><div class="feature-grid">{cards}</div></div></section><section class="section soft"><div class="wrap"><div class="section-head"><small>WORKFLOW</small><h2>创建、管理、复盘，都在同一个工作区。</h2></div><div class="workflow"><article><h3>创建资源</h3><p>按页面引导填写业务需要的信息。</p></article><article><h3>持续管理</h3><p>统一查看资源状态、权限与生命周期。</p></article><article><h3>观察优化</h3><p>依据访问表现和业务反馈持续调整。</p></article></div></div></section><section class="section"><div class="wrap use-grid"><article class="use-card"><h3>适合需要持续维护的业务入口。</h3><p>资源进入统一工作区，减少散落文件、临时页面和重复配置。</p><div class="tag-list">{tags}</div></article><article class="use-card light"><h3>先从免费账户开始。</h3><p>创建账户后即可进入工作区，按需要逐步使用更多品牌、团队与分析能力。</p><div class="hero-actions"><a class="btn brand" href="/register/">创建账户</a></div></article></div></section><section class="cta"><div class="wrap"><div class="cta-box"><h2>把下一次分享交给 GoJet。</h2><p>短链、分享、二维码和访问分析，放进同一个工作区。</p><a class="btn light" href="/register/">免费开始</a></div></div></section></main>''' + footer() + '</body></html>'


def pricing_page():
    desc = '套餐覆盖个人使用、专业增长与团队协作；具体价格和配额以当前站点显示为准。'
    return head('定价', desc) + header() + '''<main><section class="pricing-hero"><div class="wrap"><span class="eyebrow">PRICING</span><h1>从轻量使用，到团队协作。</h1><p>套餐与配额由当前站点统一维护，下单前可在账户中查看实际账单币种与价格。</p></div></section><section><div class="wrap pricing-grid"><article class="price-card"><small>FREE</small><h2>Free</h2><div class="price">免费 <span>/ 入门</span></div><ul><li>短链接基础能力</li><li>文本与二维码资源</li><li>基础访问分析</li><li>个人工作区</li></ul><a class="btn" href="/register/">免费开始</a></article><article class="price-card featured"><small>PRO</small><h2>Pro</h2><div class="price">按站点价格 <span>/ 专业</span></div><ul><li>更高资源配额</li><li>完整访问分析</li><li>文件与个人主页</li><li>自定义域名</li></ul><a class="btn brand" href="/register/">创建账户</a></article><article class="price-card"><small>BUSINESS</small><h2>Business</h2><div class="price">按站点价格 <span>/ 团队</span></div><ul><li>团队工作区</li><li>成员角色与权限</li><li>操作记录</li><li>更高业务配额</li></ul><a class="btn" href="/contact/">联系我们</a></article></div></section><section class="section soft"><div class="wrap"><div class="section-head"><small>BILLING</small><h2>账单金额在创建时固定汇率快照。</h2><p>系统以 USD 为统一汇率基准，并在生成账单时保存当时的换算信息，避免后续汇率更新改变已生成账单。</p></div></div></section></main>''' + footer() + '</body></html>'


for slug, item in PRODUCTS.items():
    target = ROOT / 'products' / slug / 'index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(product_page(slug, item), encoding='utf-8')

(ROOT / 'pricing' / 'index.html').write_text(pricing_page(), encoding='utf-8')
