#!/usr/bin/env python3
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1] / 'frontend' / 'marketing-site'

PAGES = {
    'about': ('关于 GoJet', 'GoJet 把短链接、二维码、内容分享和访问分析放进一个清晰的工作区，让日常分享更容易创建、维护和复盘。', [('一致的体验','官网、控制台、邮件和公开分享页面使用统一的品牌语言与交互习惯。'),('清晰的状态','重要操作明确显示处理中、成功或失败，减少重复操作和不确定感。'),('明确的边界','系统资源、用户资源和敏感配置分开管理，降低误删和相互影响。')]),
    'contact': ('联系我们', '产品使用、账户与账单、团队协作或安全问题，都可以通过对应入口持续跟进。', [('客户工单','登录账户后提交工单，回复、状态和处理记录都会保留在同一会话中。'),('产品与合作','了解套餐、品牌、自定义域名和团队使用方式。'),('安全与滥用','发现可疑链接或内容时，可使用公开的滥用举报入口。')]),
    'resources': ('资源中心', '集中查看使用指南、服务状态和常见帮助入口。', [('帮助文档','查找账户、短链接、二维码、分享和团队操作说明。'),('服务状态','查看主要服务的当前状态和必要通知。'),('安全与滥用','了解安全使用建议，并报告可疑链接或内容。')]),
    'docs': ('帮助文档', '从创建账户到管理链接、二维码、文件与团队，按功能查找操作说明。', [('开始使用','账户、工作区和基础设置。'),('链接与分享','创建、修改、保护和管理分享资源。'),('账户与安全','密码、人机验证、权限和账户安全说明。')]),
    'developers': ('开发者 API', '把常用的链接创建、查询与管理动作接入自己的业务流程。', [('接口鉴权','通过受控凭据访问允许的功能。'),('清晰响应','围绕常见业务动作提供明确的请求与结果。'),('权限控制','接口操作遵循账户和工作区的现有权限范围。')]),
    'blog': ('GoJet 博客', '分享链接管理、二维码、品牌和访问分析中的实用方法。', [('产品实践','更高效地整理和维护链接与二维码。'),('运营方法','设计更清晰的活动入口和渠道追踪。'),('安全意识','降低恶意链接、误操作和账户风险。')]),
    'browser-extension': ('GoJet 浏览器扩展', '在浏览网页时更快创建、复制和管理常用链接。', [('快速创建','减少在网页与控制台之间来回切换。'),('一键复制','创建后即可复制并发送给需要的人。'),('账户同步','与自己的 GoJet 工作区保持一致。')]),
    'apps': ('GoJet 应用', '在不同设备和工作场景中访问常用 GoJet 功能。', [('随时管理','快速查看常用链接、二维码和分享资源。'),('保持同步','关键内容与工作区保持一致。'),('聚焦常用操作','减少复杂步骤和不必要入口。')]),
    'changelog': ('GoJet 更新日志', '查看产品体验、可靠性和安全能力的版本更新。', [('产品体验','页面、交互和工作流程改进。'),('稳定性','服务可用性和异常处理体验改进。'),('安全','账户、权限和风险控制相关改进。')]),
    'solutions/marketing': ('营销解决方案', '用短链接、二维码和访问分析连接线上线下营销触点。', [('渠道管理','统一组织活动链接和二维码。'),('品牌一致','使用自己的域名和统一视觉。'),('效果复盘','查看访问、来源、地区和设备表现。')]),
    'solutions/creators': ('创作者解决方案', '用个人主页、链接和访问分析连接内容与受众。', [('统一入口','把重要内容聚合到一个可分享页面。'),('灵活更新','内容变化时无需频繁更换公开入口。'),('了解受众','查看常用访问和来源指标。')]),
    'solutions/teams': ('团队解决方案', '用工作区、角色权限和工单支持组织多人协作。', [('工作区协作','按团队或项目组织链接与分享资源。'),('角色权限','让成员只操作职责范围内的内容。'),('客户支持','通过工单保留问题、回复和处理状态。')]),
}


def shell_header():
    # app.js replaces this compact placeholder with the canonical navigation.
    return '<header class="siteHeader"><div class="container nav"><a class="logo" href="/">GoJet<i>.</i></a></div></header>'


def shell_footer():
    # app.js replaces this compact placeholder with the canonical footer.
    return '<footer><div class="container"><a class="logo" href="/">GoJet<i>.</i></a></div></footer><script src="/assets/app.js?v=rc12"></script>'


def render(title, desc, cards, contact=False):
    items = ''.join(
        f'<article class="card"><h3>{escape(name)}</h3><p>{escape(text)}</p></article>'
        for name, text in cards
    )
    support = ''
    if contact:
        support = '''<section class="section alt"><div class="container split"><div><span class="eyebrow">已有账户</span><h2>优先从客户工单继续沟通</h2><p>工单会保留问题上下文、双方回复和当前处理状态，更适合持续跟进账户、账单和产品问题。</p><div class="actions"><a class="btn primary" href="/app/">进入用户控制台</a><a class="btn" href="/report-abuse/">滥用举报</a></div></div><div class="uiPanel"><header><b>客户支持</b><small>可持续跟进</small></header><div class="row"><b>提交问题</b><small>选择支持部门</small><small>1</small></div><div class="row"><b>查看回复</b><small>同一会话</small><small>2</small></div><div class="row"><b>问题解决</b><small>关闭工单</small><small>3</small></div></div></div></section>'''
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="{escape(desc)}"><title>{escape(title)} · GoJet</title><link rel="stylesheet" href="/assets/styles.css?v=rc12"></head><body>{shell_header()}<main><section class="hero"><div class="container"><span class="eyebrow">GOJET</span><h1>{escape(title)}</h1><p>{escape(desc)}</p><div class="actions"><a class="btn primary" href="/register">免费开始</a><a class="btn" href="/pricing/">查看套餐</a></div></div></section><section class="section"><div class="container"><div class="cards">{items}</div></div></section>{support}<section class="cta"><div class="container"><div class="ctaBox"><h2>把链接与分享集中到一个工作区</h2><p>从免费账户开始，再按实际需要使用更多能力。</p><div class="actions" style="justify-content:center"><a class="btn" href="/register">免费开始</a></div></div></div></section></main>{shell_footer()}</body></html>'''


for slug, (title, desc, cards) in PAGES.items():
    target = ROOT / slug / 'index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render(title, desc, cards, slug == 'contact'), encoding='utf-8')
