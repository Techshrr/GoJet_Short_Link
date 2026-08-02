@php($zh=app()->getLocale()==='zh_CN')
<x-layouts.marketing :title="__('v3.public.changelog_title')">
  <section class="bg-gradient-to-b from-cyan-50 to-white px-5 py-20 text-center lg:px-8"><h1 class="text-4xl font-black text-slate-950 sm:text-6xl">{{ __('v3.public.changelog_title') }}</h1><p class="mx-auto mt-5 max-w-2xl text-lg text-slate-600">{{ $zh?'记录 GoJet 产品能力、安全修复、部署变化和升级注意事项。':'Product capabilities, security fixes, deployment changes, and upgrade notes for GoJet.' }}</p></section>
  <section class="mx-auto max-w-4xl space-y-6 px-5 pb-20 lg:px-8">
    @foreach([
      ['V4',$zh?'整套产品重构：页面级公开网站、正式 SaaS 控制台、独立管理后台、设置中心、Go 持久化跳转面、同步统计、邮件诊断与恢复、工作区邀请生命周期和全新验收门禁。':'Full product rebuild: page-complete marketing site, SaaS console, separate administration, settings center, durable Go redirect plane, synchronous analytics, recoverable mail, invitation lifecycle, and new release gates.','Current'],
      ['V3',$zh?'链接管理、智能分流、文本与文件分享、个人主页、工作区、套餐、API 和 Webhook 的功能基础。':'Functional foundation for link management, smart routing, sharing, profiles, workspaces, plans, APIs, and webhooks.','Released'],
      ['V2',$zh?'图形安装器、动态后台路径、基础短链、域名、分析和安全治理。':'Graphical installer, dynamic administration path, foundational links, domains, analytics, and trust controls.','Released'],
      ['V1',$zh?'Laravel、MySQL、Redis 和重定向引擎技术验证。':'Technical validation of Laravel, MySQL, Redis, and redirect engine.','Historical'],
    ] as [$version,$description,$status])
      <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div class="flex items-center justify-between"><h2 class="text-2xl font-black text-slate-950">{{ $version }}</h2><span class="badge-neutral">{{ $status }}</span></div><p class="mt-4 leading-7 text-slate-600">{{ $description }}</p></article>
    @endforeach
  </section>
</x-layouts.marketing>
