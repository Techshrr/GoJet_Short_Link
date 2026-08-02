@php
$zh=app()->getLocale()==='zh_CN';
$items=$zh?[
['GoJet 可以完全自托管吗？','可以。传统 Nginx/PHP-FPM、宝塔和 Docker 都是正式支持的部署方式。'],
['短链接的目标地址可以修改吗？','可以。短链接保持不变，目标、UTM、分流规则、到期和访问控制可以更新。'],
['是否支持多个目标和 A/B 测试？','支持。每个链接可以配置多个目标、权重和按国家、设备、浏览器、语言、来源、参数或时间匹配的规则。'],
['是否保存访客原始 IP？','默认不保存原始 IP。系统使用密钥 HMAC 哈希生成不可逆访客标识，并可设置事件保留周期。'],
['文件可以存到 R2 或 MinIO 吗？','可以。GoJet 使用 S3 兼容适配器支持 AWS S3、Cloudflare R2、MinIO 和其他兼容服务。'],
['如何管理多人协作？','使用工作区、邮箱邀请和所有者、管理员、编辑者、分析者、查看者角色。'],
['API 和 Webhook 是否安全？','Token 支持权限范围和到期；Webhook 使用加密保存的密钥、时间戳和 HMAC-SHA256 签名。'],
['是否支持中英文？','官网、安装器、认证、用户控制台、管理后台、错误页和产品页面均提供简体中文与英文。'],
]:[
['Can GoJet be fully self-hosted?','Yes. Traditional Nginx/PHP-FPM, BaoTa, and Docker are supported deployment methods.'],
['Can I change a destination later?','Yes. The short URL remains stable while the destination, UTM, routing, expiry, and access controls can change.'],
['Does it support multiple destinations and A/B tests?','Yes. Configure destinations, weights, and country, device, browser, language, referrer, query, or schedule rules.'],
['Does GoJet store raw visitor IP addresses?','Not by default. It creates irreversible HMAC visitor identifiers and supports configurable event retention.'],
['Can files use R2 or MinIO?','Yes. The S3-compatible adapter supports AWS S3, Cloudflare R2, MinIO, and compatible services.'],
['How are teams managed?','Use workspaces, email invitations, and owner, admin, editor, analyst, and viewer roles.'],
['Are the API and webhooks secure?','Tokens have scopes and expiry; webhooks use encrypted secrets, timestamps, and HMAC-SHA256 signatures.'],
['Is the complete product bilingual?','The marketing site, installer, authentication, console, administration, errors, and product pages support Simplified Chinese and English.'],
];
@endphp
<x-layouts.marketing :title="__('v3.public.faq_title')"><section class="bg-gradient-to-b from-indigo-50 to-white px-5 py-20 text-center lg:px-8"><h1 class="text-4xl font-black text-slate-950 sm:text-6xl">{{ __('v3.public.faq_title') }}</h1></section><section class="mx-auto max-w-4xl space-y-4 px-5 pb-20 lg:px-8">@foreach($items as [$question,$answer])<details class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary class="cursor-pointer list-none pr-8 text-lg font-bold text-slate-950">{{ $question }}</summary><p class="mt-4 leading-7 text-slate-600">{{ $answer }}</p></details>@endforeach</section></x-layouts.marketing>