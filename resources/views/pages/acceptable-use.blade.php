@php($zh=app()->getLocale()==='zh_CN')
<x-layouts.marketing :title="__('v3.public.acceptable_use_title')"><section class="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-24"><p class="page-kicker">GoJet</p><h1 class="mt-4 text-4xl font-black text-slate-950 sm:text-6xl">{{ __('v3.public.acceptable_use_title') }}</h1><p class="mt-5 leading-8 text-slate-600">{{ $zh?'使用 GoJet 时，用户必须确保链接、文本、文件、个人主页、域名和自动化行为符合法律、服务条款以及本政策。':'Users must ensure that links, text, files, profile pages, domains, and automation comply with law, the Terms, and this policy.' }}</p>@foreach(($zh?[
['禁止的内容与行为','不得用于恶意软件、钓鱼、欺诈、未经授权的访问、垃圾信息、骚扰、侵犯知识产权、规避安全措施或其他违法行为。'],
['文件与下载','不得上传可执行恶意内容、绕过文件策略、传播木马或利用公开下载服务攻击第三方。'],
['链接与域名','不得隐藏欺骗性目标、冒用品牌、绑定无权控制的域名或通过智能路由规避治理。'],
['自动化与 API','不得通过 API、Webhook 或批量导入实施滥用、耗尽资源、攻击服务或绕过配额。'],
['举报与处置','运营方可以隔离、停用或删除违规资源，暂停账户和工作区，并保留审计记录。用户可通过举报页面提交证据。'],
['自托管责任','自托管运营者负责结合所在地法律、业务模式和基础设施制定补充政策、保留周期和处置流程。'],
]:[
['Prohibited content and conduct','Do not use GoJet for malware, phishing, fraud, unauthorized access, spam, harassment, intellectual-property infringement, security bypass, or illegal conduct.'],
['Files and downloads','Do not upload malicious executables, bypass file policies, distribute trojans, or use public downloads to attack third parties.'],
['Links and domains','Do not conceal deceptive targets, impersonate brands, bind domains you do not control, or use routing to evade moderation.'],
['Automation and API','Do not use APIs, webhooks, or bulk import for abuse, resource exhaustion, service attacks, or quota evasion.'],
['Reports and enforcement','Operators may quarantine, disable, or remove violating resources, suspend accounts and workspaces, and retain audit evidence. Reports may be submitted through the abuse form.'],
['Self-hosted responsibility','Self-hosted operators must adapt policies, retention, and enforcement to applicable law, business model, and infrastructure.'],
]) as [$title,$content])<section class="mt-10 border-t border-slate-200 pt-8"><h2 class="text-2xl font-black text-slate-950">{{ $title }}</h2><p class="mt-4 leading-8 text-slate-600">{{ $content }}</p></section>@endforeach</section></x-layouts.marketing>