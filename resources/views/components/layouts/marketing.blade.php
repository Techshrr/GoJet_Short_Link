@props(['title' => null, 'description' => null])
@php
  $configuration = app(\App\Services\SiteConfiguration::class);
  $meta = $configuration->publicMeta($title, $description);
  $identity = config('gojet.site.identity', $siteConfig['identity'] ?? []);
  $branding = config('gojet.site.branding', $siteConfig['branding'] ?? []);
  $legal = config('gojet.site.legal', $siteConfig['legal'] ?? []);
  $logo = $configuration->assetUrl($branding['logo'] ?? null);
  $logoMark = $configuration->assetUrl($branding['logo_mark'] ?? null);
  $products = [
    ['route'=>'products.url-shortener','label'=>'短网址','desc'=>'创建、编辑和组织品牌短链','icon'=>'↗'],
    ['route'=>'products.link-in-bio','label'=>'个人主页','desc'=>'集中展示内容与社交入口','icon'=>'◫'],
    ['route'=>'products.text-sharing','label'=>'文本分享','desc'=>'分享文本、Markdown 与代码','icon'=>'¶'],
    ['route'=>'products.file-sharing','label'=>'文件分享','desc'=>'安全传输与生命周期控制','icon'=>'⇩'],
    ['route'=>'products.analytics','label'=>'链接数据分析','desc'=>'来源、终端、地域与转化','icon'=>'⌁'],
    ['route'=>'products.qr','label'=>'二维码','desc'=>'动态二维码与扫码分析','icon'=>'▦'],
    ['route'=>'products.smart-routing','label'=>'智能链接','desc'=>'A/B、地域、设备和时间分流','icon'=>'⌘'],
    ['route'=>'products.custom-domains','label'=>'自定义域名','desc'=>'品牌域名与自动证书','icon'=>'◎'],
  ];
  $solutions = [
    ['route'=>'solutions.marketing','label'=>'营销','desc'=>'投放、归因、实验与转化'],
    ['route'=>'solutions.creators','label'=>'创作者','desc'=>'个人品牌、内容与受众洞察'],
    ['route'=>'solutions.teams','label'=>'团队','desc'=>'工作区、角色、配额与审计'],
    ['route'=>'solutions.qr-campaigns','label'=>'QR 营销活动','desc'=>'连接线下触点与数字旅程'],
  ];
  $resources = [
    ['route'=>'developers','label'=>'开发者 API'],
    ['route'=>'api-docs','label'=>'API 文档'],
    ['route'=>'changelog','label'=>'更新日志'],
    ['route'=>'status','label'=>'服务状态'],
    ['route'=>'contact','label'=>'联系我们'],
    ['route'=>'faq','label'=>'常见问题'],
  ];
@endphp
<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="bg-[#f4faf7]">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <meta name="description" content="{{ $meta['description'] }}">
  @if(filled($meta['keywords']))<meta name="keywords" content="{{ $meta['keywords'] }}">@endif
  <meta name="robots" content="{{ $meta['robots'] }}">
  <meta property="og:title" content="{{ $meta['title'] }}">
  <meta property="og:description" content="{{ $meta['description'] }}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{{ $meta['canonical'] }}">
  @if($meta['og_image'])<meta property="og:image" content="{{ $meta['og_image'] }}">@endif
  <link rel="canonical" href="{{ $meta['canonical'] }}">
  <link rel="icon" href="{{ $meta['favicon'] }}">
  <meta name="theme-color" content="{{ $meta['brand_color'] }}">
  <title>{{ $meta['title'] }}</title>
  @vite(['resources/css/app.css', 'resources/js/app.js'])
  <link rel="stylesheet" href="{{ asset('assets/gojet-v4.css') }}?v=4.0.0">
  <style>:root{--mint:{{ $branding['brand_color'] ?? '#10b981' }};--cyan:{{ $branding['accent_color'] ?? '#22d3ee' }}}.btn-brand{background:linear-gradient(135deg,var(--mint),var(--cyan))!important}.brand-mark{background:linear-gradient(135deg,#0f172a,var(--mint))!important}.marketing-orb{--brand-glow:var(--mint)}</style>
</head>
<body class="min-h-screen bg-[#f4faf7] text-[#0d1728] antialiased" x-data="{ menu: null, mobile: false }" @keydown.escape.window="menu=null;mobile=false">
  <header class="site-header">
    <nav class="site-nav" @mouseleave="menu=null">
      <a href="{{ route('home') }}" class="brand-lockup" aria-label="{{ $identity['site_name'] ?? config('app.name') }}">
        @if($logo)
          <img src="{{ $logo }}" alt="{{ $identity['site_name'] ?? config('app.name') }}" class="h-9 max-w-[150px] object-contain">
        @else
          <span class="brand-mark">@if($logoMark)<img src="{{ $logoMark }}" alt="" class="h-full w-full object-contain">@else<span>✦</span>@endif</span>
          <span>{{ $identity['site_short_name'] ?? config('app.name', 'GoJet') }}</span>
        @endif
      </a>

      <div class="hidden items-stretch lg:flex">
        <div class="nav-menu-wrap">
          <button type="button" class="nav-item" @mouseenter="menu='products'" @focus="menu='products'">产品 <span :class="menu==='products'?'rotate-180':''">⌄</span></button>
          <div x-cloak x-show="menu==='products'" x-transition class="mega-menu mega-menu-products" @mouseenter="menu='products'">
            <div class="mega-menu-grid">
              @foreach($products as $item)
                <a href="{{ route($item['route']) }}" class="mega-link">
                  <span class="mega-icon">{{ $item['icon'] }}</span>
                  <span><strong>{{ $item['label'] }}</strong><small>{{ $item['desc'] }}</small></span>
                </a>
              @endforeach
            </div>
            <div class="mega-promo"><span class="badge-mint">产品演示</span><strong>把创建、分发和分析放在同一个平台</strong><a href="{{ route('product') }}">查看完整产品能力 →</a></div>
          </div>
        </div>
        <div class="nav-menu-wrap">
          <button type="button" class="nav-item" @mouseenter="menu='solutions'" @focus="menu='solutions'">解决方案 <span :class="menu==='solutions'?'rotate-180':''">⌄</span></button>
          <div x-cloak x-show="menu==='solutions'" x-transition class="mega-menu mega-menu-compact" @mouseenter="menu='solutions'">
            @foreach($solutions as $item)<a href="{{ route($item['route']) }}" class="menu-row"><span><strong>{{ $item['label'] }}</strong><small>{{ $item['desc'] }}</small></span><b>→</b></a>@endforeach
          </div>
        </div>
        <a class="nav-item" href="{{ route('pricing') }}">价格</a>
        <div class="nav-menu-wrap">
          <button type="button" class="nav-item" @mouseenter="menu='resources'" @focus="menu='resources'">资源 <span :class="menu==='resources'?'rotate-180':''">⌄</span></button>
          <div x-cloak x-show="menu==='resources'" x-transition class="mega-menu mega-menu-resources" @mouseenter="menu='resources'">
            @foreach($resources as $item)<a href="{{ route($item['route']) }}" class="resource-link">{{ $item['label'] }} <span>→</span></a>@endforeach
          </div>
        </div>
        <a class="nav-item" href="{{ route('about') }}">关于</a>
      </div>

      <div class="flex items-center gap-2">
        <a class="language-pill hidden sm:grid" href="{{ route('locale.switch', app()->getLocale()==='zh_CN'?'en':'zh_CN') }}">{{ app()->getLocale()==='zh_CN'?'中':'EN' }}</a>
        @auth
          <a class="nav-login hidden sm:inline-flex" href="{{ route('dashboard') }}">控制台</a>
          @can('admin')<a class="nav-register hidden sm:inline-flex" href="{{ route('admin.index') }}">管理后台</a>@endcan
        @else
          <a class="nav-login hidden sm:inline-flex" href="{{ route('login') }}">登录</a>
          @if(config('gojet.allow_registration'))<a class="nav-register hidden sm:inline-flex" href="{{ route('register') }}">注册</a>@endif
        @endauth
        <button class="mobile-menu-button lg:hidden" type="button" @click="mobile=true" aria-label="打开菜单">☰</button>
      </div>
    </nav>
  </header>

  <div x-cloak x-show="mobile" class="mobile-drawer" role="dialog" aria-modal="true">
    <div class="mobile-backdrop" @click="mobile=false"></div>
    <aside class="mobile-panel" x-transition:enter="transition duration-200" x-transition:enter-start="translate-x-full" x-transition:enter-end="translate-x-0">
      <div class="mobile-panel-head"><strong>{{ $identity['site_name'] ?? config('app.name') }}</strong><button @click="mobile=false">×</button></div>
      <nav class="mobile-panel-body">
        <p>产品</p>
        @foreach($products as $item)<a href="{{ route($item['route']) }}"><span>{{ $item['label'] }}</span><b>→</b></a>@endforeach
        <p>解决方案</p>
        @foreach($solutions as $item)<a href="{{ route($item['route']) }}"><span>{{ $item['label'] }}</span><b>→</b></a>@endforeach
        <a href="{{ route('pricing') }}"><span>价格</span><b>→</b></a>
        <a href="{{ route('about') }}"><span>关于</span><b>→</b></a>
      </nav>
      <div class="mobile-panel-actions">@guest<a href="{{ route('login') }}" class="btn-secondary">登录</a><a href="{{ route('register') }}" class="btn-primary">注册</a>@else<a href="{{ route('dashboard') }}" class="btn-primary">进入控制台</a>@endguest</div>
    </aside>
  </div>

  @if(session('status'))<div class="flash-wrap"><div class="flash-success">{{ session('status') }}</div></div>@endif
  @if(session('mail_error'))<div class="flash-wrap"><div class="flash-error"><strong>邮件未发送</strong><p>{{ session('mail_error') }}</p></div></div>@endif
  @if($errors->any())<div class="flash-wrap"><div class="flash-error"><strong>操作未完成</strong><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div></div>@endif

  <main>{{ $slot }}</main>

  <section class="footer-cta-wrap">
    <div class="footer-cta">
      <div><span class="badge-dark">准备开始？</span><h2>{{ $identity['tagline'] ?? '强大的链接管理，触手可及' }}</h2></div>
      <p>{{ $identity['description'] ?? '缩短、追踪和优化每一个链接。' }}</p>
      <a href="{{ auth()->check()?route('links.index'):route('register') }}">免费开始 →</a>
    </div>
  </section>

  <footer class="site-footer">
    <div class="site-footer-grid">
      <div class="footer-brand">
        <a href="{{ route('home') }}" class="brand-lockup">@if($logo)<img src="{{ $logo }}" alt="" class="h-9 max-w-[150px] object-contain">@else<span class="brand-mark">✦</span><span>{{ $identity['site_short_name'] ?? 'GoJet' }}</span>@endif</a>
        <p>{{ $identity['footer_text'] ?? $identity['description'] ?? '' }}</p>
        <div class="app-badges"><span>Web Console</span><span>Developer API</span></div>
      </div>
      <div><h3>产品</h3>@foreach(array_slice($products,0,6) as $item)<a href="{{ route($item['route']) }}">{{ $item['label'] }}</a>@endforeach</div>
      <div><h3>解决方案</h3>@foreach($solutions as $item)<a href="{{ route($item['route']) }}">{{ $item['label'] }}</a>@endforeach</div>
      <div><h3>开发者</h3><a href="{{ route('developers') }}">API 介绍</a><a href="{{ route('api-docs') }}">开发文档</a><a href="{{ route('status') }}">服务状态</a><a href="{{ route('changelog') }}">更新日志</a></div>
      <div><h3>公司</h3><a href="{{ route('about') }}">关于</a><a href="{{ route('contact') }}">联系我们</a><a href="{{ route('faq') }}">帮助</a><a href="{{ route('report.create') }}">滥用举报</a></div>
      <div><h3>法律</h3><a href="{{ route('privacy') }}">隐私政策</a><a href="{{ route('terms') }}">服务条款</a><a href="{{ route('acceptable-use') }}">可接受使用</a></div>
    </div>
    <div class="site-footer-bottom"><span>{{ $legal['copyright'] ?? '© '.date('Y').' '.($identity['site_name'] ?? config('app.name')).'.' }}</span><span>{{ $legal['company'] ?? '' }}</span><a href="mailto:{{ $identity['support_email'] ?? config('gojet.support_email') }}">{{ $identity['support_email'] ?? config('gojet.support_email') }}</a></div>
  </footer>
</body>
</html>
