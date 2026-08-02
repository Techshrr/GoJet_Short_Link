@props(['title' => null, 'eyebrow' => null])
@php
  $configuration = app(\App\Services\SiteConfiguration::class);
  $identity = config('gojet.site.identity', $siteConfig['identity'] ?? []);
  $branding = config('gojet.site.branding', $siteConfig['branding'] ?? []);
  $logo = $configuration->assetUrl($branding['logo'] ?? null);
  $logoMark = $configuration->assetUrl($branding['logo_mark'] ?? null);
  $workspace = auth()->user()?->currentWorkspace();
  $navigation = [
    ['label'=>'工作台','items'=>[
      ['route'=>'dashboard','active'=>['dashboard'],'label'=>'总览','icon'=>'⌂'],
      ['route'=>'links.index','active'=>['links.index','links.show','links.routing'],'label'=>'链接管理','icon'=>'↗'],
      ['route'=>'links.organization','active'=>['links.organization','campaigns.*','folders.*','tags.*'],'label'=>'活动与分类','icon'=>'▦'],
    ]],
    ['label'=>'内容与品牌','items'=>[
      ['route'=>'profiles.index','active'=>['profiles.*'],'label'=>'个人主页','icon'=>'◫'],
      ['route'=>'texts.index','active'=>['texts.*'],'label'=>'文本分享','icon'=>'¶'],
      ['route'=>'files.index','active'=>['files.*'],'label'=>'文件分享','icon'=>'⇩'],
      ['route'=>'domains.index','active'=>['domains.*'],'label'=>'自定义域名','icon'=>'◎'],
    ]],
    ['label'=>'自动化','items'=>[
      ['route'=>'tokens.index','active'=>['tokens.*'],'label'=>'API Token','icon'=>'⌘'],
      ['route'=>'webhooks.index','active'=>['webhooks.*'],'label'=>'Webhook','icon'=>'⇄'],
    ]],
    ['label'=>'团队与账户','items'=>[
      ['route'=>'workspaces.index','active'=>['workspaces.*'],'label'=>'工作区与成员','icon'=>'◇'],
      ['route'=>'plans.index','active'=>['plans.*','subscriptions.*'],'label'=>'套餐与账单','icon'=>'◌'],
    ]],
  ];
  $featureByRoute = [
    'links.index'=>'links', 'links.organization'=>'links',
    'profiles.index'=>'profiles', 'texts.index'=>'texts', 'files.index'=>'files',
    'webhooks.index'=>'webhooks', 'workspaces.index'=>'teams',
  ];
  $navigation = collect($navigation)->map(function (array $group) use ($featureByRoute): array {
    $group['items'] = collect($group['items'])->filter(function (array $item) use ($featureByRoute): bool {
      $feature = $featureByRoute[$item['route']] ?? null;
      return $feature === null || (bool) data_get(config('gojet.features', []), $feature, false);
    })->values()->all();
    return $group;
  })->filter(fn (array $group): bool => $group['items'] !== [])->values()->all();
@endphp
<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="bg-[#f5f7f6]">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <meta name="robots" content="noindex,nofollow">
  <title>{{ $title ? $title.' · ' : '' }}{{ $identity['site_name'] ?? config('app.name', 'GoJet') }}</title>
  @vite(['resources/css/app.css', 'resources/js/app.js'])
  <link rel="stylesheet" href="{{ asset('assets/gojet-v4.css') }}?v=4.0.0">
  <style>:root{--mint:{{ $branding['brand_color'] ?? '#10b981' }};--cyan:{{ $branding['accent_color'] ?? '#22d3ee' }}}.btn-brand{background:linear-gradient(135deg,var(--mint),var(--cyan))!important}.brand-mark{background:linear-gradient(135deg,#0f172a,var(--mint))!important}.marketing-orb{--brand-glow:var(--mint)}</style>
</head>
<body class="console-body" x-data="{ mobileNavigation:false, command:false, commandQuery: '' }" @keydown.escape.window="mobileNavigation=false;command=false">
  <div class="console-shell">
    <aside class="console-sidebar">
      <div class="console-brand-row">
        <a href="{{ route('dashboard') }}" class="brand-lockup">@if($logo)<img src="{{ $logo }}" alt="" class="h-9 max-w-[150px] object-contain">@else<span class="brand-mark">@if($logoMark)<img src="{{ $logoMark }}" alt="">@else✦@endif</span><span>{{ $identity['site_short_name'] ?? 'GoJet' }}</span>@endif</a>
      </div>
      <a href="{{ config('gojet.features.teams') ? route('workspaces.index') : route('dashboard') }}" class="workspace-switcher"><span class="workspace-avatar">{{ mb_substr($workspace?->name ?? 'G',0,1) }}</span><span><small>当前工作区</small><strong>{{ $workspace?->name ?? '个人工作区' }}</strong></span><b>⌄</b></a>
      <nav class="console-nav">
        @foreach($navigation as $group)
          <div class="console-nav-group"><p>{{ $group['label'] }}</p>@foreach($group['items'] as $item)<a href="{{ route($item['route']) }}" class="{{ request()->routeIs(...$item['active'])?'active':'' }}"><i>{{ $item['icon'] }}</i><span>{{ $item['label'] }}</span></a>@endforeach</div>
        @endforeach
      </nav>
      <div class="console-sidebar-bottom">
        @can('admin')<a href="{{ route('admin.index') }}" class="admin-entry"><i>⚑</i><span><strong>平台管理后台</strong><small>用户、运营、系统设置</small></span><b>→</b></a>@endcan
        <div class="console-user-card"><div class="user-avatar">{{ mb_substr(auth()->user()?->name ?? 'U',0,1) }}</div><div><strong>{{ auth()->user()?->name }}</strong><small>{{ auth()->user()?->email }}</small></div><form method="post" action="{{ route('logout') }}">@csrf<button title="退出">↪</button></form></div>
        <a href="{{ route('home') }}" class="back-website">← 返回网站</a>
      </div>
    </aside>

    <div class="console-main">
      <header class="console-topbar">
        <button class="console-mobile-button" @click="mobileNavigation=true">☰</button>
        <div class="console-page-context"><small>{{ $eyebrow ?? 'GoJet 工作台' }}</small><strong>{{ $title ?? '总览' }}</strong></div>
        <button class="command-search" @click="command=true"><span>⌕</span><em>搜索链接、文件或页面</em><kbd>⌘ K</kbd></button>
        <div class="console-top-actions">@if(config('gojet.features.links'))<a href="{{ route('links.index') }}#create" class="create-button">＋ 创建链接</a>@endif<a class="icon-button" title="最近活动" href="{{ route('dashboard') }}#activity">♢</a><a href="{{ config('gojet.features.teams') ? route('workspaces.index') : route('dashboard') }}" class="top-avatar">{{ mb_substr(auth()->user()?->name ?? 'U',0,1) }}</a></div>
      </header>

      @if(session('status'))<div class="console-flash"><div class="flash-success">{{ session('status') }}</div></div>@endif
      @if(session('mail_error'))<div class="console-flash"><div class="flash-error"><strong>邮件未发送</strong><p>{{ session('mail_error') }}</p></div></div>@endif
      @if($errors->any())<div class="console-flash"><div class="flash-error"><strong>操作未完成</strong><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div></div>@endif
      @if(session('import_errors'))<div class="console-flash"><div class="flash-warning"><ul>@foreach(session('import_errors') as $error)<li>{{ $error }}</li>@endforeach</ul></div></div>@endif

      <main class="console-content">{{ $slot }}</main>
    </div>
  </div>

  <div x-cloak x-show="mobileNavigation" class="mobile-drawer"><div class="mobile-backdrop" @click="mobileNavigation=false"></div><aside class="console-mobile-panel"><div class="mobile-panel-head"><strong>{{ $workspace?->name }}</strong><button @click="mobileNavigation=false">×</button></div><nav>@foreach($navigation as $group)<p>{{ $group['label'] }}</p>@foreach($group['items'] as $item)<a href="{{ route($item['route']) }}"><i>{{ $item['icon'] }}</i>{{ $item['label'] }}</a>@endforeach@endforeach</nav></aside></div>

  <div x-cloak x-show="command" class="command-overlay" @click.self="command=false"><div class="command-dialog"><div class="command-input"><span>⌕</span><input autofocus x-model="commandQuery" placeholder="输入关键词搜索……"><kbd>ESC</kbd></div><div class="command-results"><p>快速前往</p>@if(config('gojet.features.links'))<a x-show="commandQuery === '' || '链接管理 short link'.toLowerCase().includes(commandQuery.toLowerCase())" href="{{ route('links.index') }}"><span>↗</span>链接管理</a>@endif<a x-show="commandQuery === '' || '自定义域名 domain'.toLowerCase().includes(commandQuery.toLowerCase())" href="{{ route('domains.index') }}"><span>◎</span>自定义域名</a>@if(config('gojet.features.teams'))<a x-show="commandQuery === '' || '工作区成员 workspace team'.toLowerCase().includes(commandQuery.toLowerCase())" href="{{ route('workspaces.index') }}"><span>◇</span>工作区成员</a>@endif@can('admin')<a x-show="commandQuery === '' || '系统设置 settings'.toLowerCase().includes(commandQuery.toLowerCase())" href="{{ route('admin.settings.index') }}"><span>⚙</span>系统设置</a>@endcan</div></div></div>
</body>
</html>
