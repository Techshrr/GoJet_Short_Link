#!/usr/bin/env python3
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1] / 'frontend' / 'marketing-site'

PAGES = {
    'about': ('关于 GoJet', 'GoJet 专注于把短链接、二维码、分享与访问分析做成一套清晰、稳定、易于日常使用的工作平台。', [('统一体验','官网、控制台、邮件与分享页面使用一致的品牌语言。'),('清晰状态','重要操作明确显示处理中、成功或失败。'),('安全边界','系统资源、用户资源和敏感配置保持清晰隔离。')]),
    'contact': ('联系我们', '无论是产品使用、账户与账单、部署咨询，还是安全与滥用问题，都可以找到对应处理入口。', [('客户支持','登录账户后通过工单提交问题并持续跟进。'),('产品与合作','了解功能、套餐、品牌和团队使用方式。'),('安全与滥用','通过滥用举报入口报告可疑链接或内容。')]),
    'resources': ('资源中心', '集中查看使用指南、服务状态和常见帮助入口。', [('帮助文档','查找账户、链接、二维码和团队操作说明。'),('服务状态','查看主要服务的当前状态。'),('安全与滥用','了解并报告可疑链接或内容。')]),
    'docs': ('帮助文档', '从创建账户到管理链接、二维码、文件与团队，按功能查找操作说明。', [('开始使用','账户、工作区和基础设置。'),('链接与分享','创建、修改、保护和管理资源。'),('账户与安全','密码、验证、权限和安全相关说明。')]),
    'developers': ('开发者 API', '将链接创建、管理和查询能力接入你的业务流程。', [('明确鉴权','使用受控凭据访问允许的接口。'),('稳定接口','围绕常见业务动作提供清晰请求与响应。'),('权限与审计','敏感操作遵循账户权限和操作记录规则。')]),
    'blog': ('GoJet 博客', '分享链接管理、二维码、品牌和增长分析中的实用方法。', [('产品实践','更高效地管理链接与二维码资产。'),('增长方法','设计更清晰的渠道与活动归因。'),('安全意识','降低恶意链接、误操作和账户风险。')]),
    'browser-extension': ('GoJet 浏览器扩展', '在浏览网页时更快创建、复制和管理链接。', [('快速创建','减少在网页与控制台之间反复切换。'),('一键复制','创建后即可复制并分享。'),('账户同步','与 GoJet 工作区保持一致。')]),
    'apps': ('GoJet 应用', '在不同设备和工作场景中访问常用 GoJet 功能。', [('随时管理','快速查看常用链接与二维码。'),('保持同步','关键数据与工作区保持一致。'),('聚焦常用操作','减少复杂步骤和不必要入口。')]),
    'changelog': ('GoJet 更新日志', '查看产品体验、可靠性和安全能力的版本更新。', [('产品体验','页面、交互和工作流程改进。'),('可靠性','运行、恢复和监控能力改进。'),('安全','账户、权限和风险控制改进。')]),
    'solutions/marketing': ('营销解决方案', '用短链、二维码、活动参数和访问分析连接线上线下营销触点。', [('渠道管理','统一组织活动链接和二维码。'),('品牌一致','使用品牌域名和统一视觉。'),('效果复盘','查看点击、来源、地区和设备表现。')]),
    'solutions/creators': ('创作者解决方案', '用个人主页、智能链接和访问分析连接内容与受众。', [('统一入口','把重要内容聚合到一个可分享页面。'),('灵活更新','内容变化时无需频繁更换公开入口。'),('了解受众','查看常用访问和来源指标。')]),
    'solutions/teams': ('团队解决方案', '用工作区、角色权限和操作记录组织多人协作。', [('工作区协作','按团队或项目组织链接资产。'),('角色权限','让成员只操作职责范围内的内容。'),('操作记录','重要管理动作可以回溯。')]),
}


def header():
    return '''<header class="siteHeader"><div class="container nav"><a class="logo" href="/">GoJet<i>.</i></a><a href="/products/url-shortener/">产品</a><a href="/solutions/marketing/">解决方案</a><a href="/pricing/">定价</a><a href="/resources/">资源</a><a href="/about/">关于</a><a class="push" href="/login/">登录</a><a class="btn primary" href="/register/">免费开始</a></div></header>'''


def footer():
    return '''<footer><div class="container"><div class="footerGrid"><div><a class="logo" href="/">GoJet<i>.</i></a><p>让链接、二维码与每次触达更清晰、更可控。</p></div><div><b>产品</b><a href="/products/url-shortener/">短链接</a><a href="/products/analytics/">访问分析</a><a href="/products/qr-code/">二维码</a></div><div><b>解决方案</b><a href="/solutions/marketing/">营销</a><a href="/solutions/creators/">创作者</a><a href="/solutions/teams/">团队</a></div><div><b>资源</b><a href="/docs/">帮助文档</a><a href="/status/">服务状态</a><a href="/report-abuse/">滥用举报</a></div><div><b>GoJet</b><a href="/about/">关于</a><a href="/contact/">联系我们</a><a href="/privacy/">隐私政策</a><a href="/terms/">服务条款</a></div></div><div class="legal"><span>© 2026 GoJet. 保留所有权利。</span><span><a href="/privacy/">隐私政策</a> · <a href="/terms/">服务条款</a></span></div></div></footer>'''


def render(title, desc, cards, contact=False):
    items = ''.join(f'<article class="card"><h3>{escape(name)}</h3><p>{escape(text)}</p></article>' for name,text in cards)
    extra = ''
    if contact:
        extra = '''<section class="section alt"><div class="container"><div class="uiPanel"><h2>已有账户？</h2><p>优先从控制台提交工单，便于保留问题上下文、回复记录和处理状态。</p><a class="btn primary" href="/app/?view=support">进入客户工单</a></div></div></section>'''
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} | GoJet</title><meta name="description" content="{escape(desc)}"><link rel="stylesheet" href="/assets/gojet-design-system.css"><link rel="stylesheet" href="/assets/styles.css"></head><body>{header()}<main><section class="hero"><div class="container"><span class="eyebrow">GOJET</span><h1>{escape(title)}</h1><p>{escape(desc)}</p></div></section><section class="section"><div class="container"><div class="cards">{items}</div></div></section>{extra}</main>{footer()}</body></html>'''


for slug, (title, desc, cards) in PAGES.items():
    target = ROOT / slug / 'index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render(title, desc, cards, slug == 'contact'), encoding='utf-8')
