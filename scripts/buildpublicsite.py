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
    'docs': ('帮助文档', '从创建账户到管理链接、二维码、文件与团队，按功能查找操作说明。', [
        ('开始使用', '账户、工作区和基础设置。'),
        ('链接与分享', '创建、修改、保护和管理分享资源。'),
        ('账户与安全', '密码、人机验证、权限和账户安全说明。'),
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
    'urlshortener': ('短链接', 'SHORT LINKS', '把冗长网址变成更容易分享、管理和复盘的短链接。', ['自定义短码与跳转状态', '链接发出后仍可维护目标', '密码、有效期与访问规则'], ['粘贴目标网址', '设置短码与规则', '分享并持续查看访问表现']),
    'qrcode': ('二维码', 'QR CODE', '让线下物料通过同一条可维护短链接持续连接线上内容。', ['二维码与短链接保持关联', '多种尺寸与前景/背景颜色', '单独统计二维码访问'], ['选择正在使用的短链接', '生成并下载二维码', '更新链接目标而无需重印二维码']),
    'analytics': ('访问分析', 'ANALYTICS', '用清晰的数据了解链接从哪里被打开、使用什么设备，以及访问变化。', ['点击与独立访客', '来源、地区、设备与浏览器', '最近访问与二维码访问区分'], ['创建并分享链接', '等待真实访问发生', '在工作区查看趋势与明细']),
    'biopages': ('个人主页', 'BIO PAGES', '用一个长期入口整理品牌、社交账号、内容和活动链接。', ['多种页面风格', '链接排序与实时预览', '公开地址长期保持稳定'], ['创建主页并填写介绍', '添加需要展示的入口', '预览后发布并持续更新']),
    'textsharing': ('文本分享', 'TEXT SHARING', '快速分享普通文本、Markdown、代码片段和临时说明。', ['密码保护与有效期', '一次性读取规则', '适合文本、Markdown 与代码'], ['输入需要分享的内容', '设置访问规则', '复制分享地址']),
    'filesharing': ('文件分享', 'FILE SHARING', '在安全检查完成后生成可控的文件分享入口。', ['上传后先执行安全检查', '密码、有效期与下载次数', '分享状态与下载次数可查看'], ['选择一个文件上传', '等待安全检查完成', '复制分享地址并管理访问']),
    'customdomains': ('自定义域名', 'CUSTOM DOMAINS', '让短链接延续自己的品牌域名和信任感。', ['DNS 所有权验证', 'HTTPS 状态检查', '验证通过后用于短链接'], ['添加需要使用的域名', '按提示配置 DNS', '验证通过后创建品牌短链']),
    'smartlinks': ('智能链接', 'SMART LINKS', '根据访问上下文把不同访客送达更合适的目标。', ['按访问条件配置规则', '保留统一公开入口', '与访问分析结合复盘'], ['创建统一短链接', '配置访问规则', '根据数据持续优化目标']),
    'abtesting': ('A/B 测试', 'A/B TESTING', '让同一入口在多个目标之间分配流量，用真实访问比较表现。', ['多目标流量分配', '保持一个公开短链接', '结合访问结果持续调整'], ['添加候选目标', '配置流量比例', '观察数据并选择更合适的方案']),
    'qrcampaigns': ('QR 营销活动', 'QR CAMPAIGNS', '围绕活动批量组织二维码、短链接和访问表现。', ['统一管理活动入口', '线下物料与线上内容连接', '访问结果集中复盘'], ['建立活动与链接', '生成所需二维码', '上线后持续查看访问表现']),
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


def product_page(title, kicker, desc, features, steps):
    cards = ''.join(f'<article class="card"><span class="eyebrow">0{i}</span><h3>{escape(name)}</h3><p>围绕真实使用场景保持状态清晰、操作可控，并与 GoJet 工作区中的其他能力保持一致。</p></article>' for i, name in enumerate(features, 1))
    flow = ''.join(f'<article class="card"><span class="eyebrow">STEP {i}</span><h3>{escape(name)}</h3><p>完成当前步骤后再进入下一步，重要状态和结果都会明确显示。</p></article>' for i, name in enumerate(steps, 1))
    faq = f'<details><summary>{escape(title)}创建后还能继续管理吗？</summary><p>可以。相关资源会保留在工作区中，后续可根据功能支持范围继续查看、修改状态或更新内容。</p></details><details><summary>是否和 GoJet 其他功能使用同一账户？</summary><p>是。{escape(title)}与短链接、二维码、分析、分享和团队能力使用同一个工作区与权限体系。</p></details>'
    return f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{escape(desc)}"><title>{escape(title)} · GoJet</title><link rel="stylesheet" href="/assets/styles.css"></head><body>{header()}<main><section class="hero"><div class="container split"><div><span class="eyebrow">{escape(kicker)}</span><h1>{escape(title)}</h1><p>{escape(desc)}</p><div class="actions"><a class="btn primary" href="/register">免费开始</a><a class="btn" href="/pricing">查看套餐</a></div></div><div class="uiPanel"><header><b>{escape(title)}</b><small>GoJet 工作区</small></header><div class="row"><b>创建</b><small>清晰输入</small><small>01</small></div><div class="row"><b>管理</b><small>状态可见</small><small>02</small></div><div class="row"><b>复盘</b><small>结果可追踪</small><small>03</small></div></div></div></section><section class="section"><div class="container"><div class="sectionHead"><span class="eyebrow">核心能力</span><h2>围绕真实使用流程设计</h2><p>不把功能拆成零散工具，而是让每一步都自然进入同一个工作区。</p></div><div class="cards">{cards}</div></div></section><section class="section alt"><div class="container"><div class="sectionHead"><span class="eyebrow">使用方式</span><h2>三步完成主要流程</h2></div><div class="cards">{flow}</div></div></section><section class="section"><div class="container"><div class="sectionHead"><span class="eyebrow">常见问题</span><h2>开始前需要了解的内容</h2></div><div class="mk-faq">{faq}</div></div></section><section class="cta"><div class="container"><div class="ctaBox"><h2>开始使用 {escape(title)}</h2><p>创建账户后即可在 GoJet 工作区中使用并持续管理。</p><div class="actions" style="justify-content:center"><a class="btn" href="/register">免费开始</a></div></div></div></section></main>{footer()}</body></html>'


def pricing_page():
    return f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="GoJet 套餐覆盖个人使用、专业增长与团队协作；实际价格与配额以当前站点账户页面为准。"><title>套餐价格 · GoJet</title><link rel="stylesheet" href="/assets/styles.css"></head><body>{header()}<main><section class="hero"><div class="container"><span class="eyebrow">套餐价格</span><h1>从个人使用，到团队协作</h1><p>先从适合当前规模的套餐开始。实际价格、币种、资源配额和可用支付方式以登录后的账户页面与正式账单为准。</p><div class="actions"><a class="btn primary" href="/register">免费开始</a><a class="btn" href="/login">登录账户</a></div></div></section><section class="section"><div class="container"><div class="pricing"><article class="price"><span class="eyebrow">FREE</span><h3>Free</h3><b>适合个人试用与轻量分享</b><p>短链接、二维码和基础分享能力，适合先体验完整工作流程。</p><a class="btn" href="/register">免费开始</a></article><article class="price featured"><span class="eyebrow">PRO</span><h3>Pro</h3><b>适合持续运营和专业使用</b><p>更高资源配额、更多分析与品牌能力。具体价格以账户页面为准。</p><a class="btn primary" href="/register">创建账户</a></article><article class="price"><span class="eyebrow">BUSINESS</span><h3>Business</h3><b>适合多人团队与业务协作</b><p>面向团队工作区、成员管理和更高业务规模。具体方案以账户页面为准。</p><a class="btn" href="/contact">了解更多</a></article></div></div></section></main>{footer()}</body></html>'


def validate(route, html):
    match = FORBIDDEN.search(html)
    if match:
        raise SystemExit(f'engineering copy or release asset token leaked into {route}: {match.group(0)}')
    if route.startswith('products/'):
        for marker in ('/assets/styles.css', '/assets/app.js', 'siteHeader'):
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

    for route, (title, desc, cards) in GENERIC.items():
        write(output, route, generic_page(title, desc, cards, route == 'contact'))
    for slug, data in PRODUCTS.items():
        write(output, f'products/{slug}', product_page(*data))
    write(output, 'pricing', pricing_page())

    expected = set(GENERIC) | {
        'home', 'pricing', 'announcements', 'forgotpassword', 'login', 'privacy',
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
