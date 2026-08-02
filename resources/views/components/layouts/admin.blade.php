@props(['title' => null, 'eyebrow' => '平台管理'])
@php
  $configuration = app(\App\Services\SiteConfiguration::class);
  $identity = config('gojet.site.identity', $siteConfig['identity'] ?? []);
  $branding = config('gojet.site.branding', $siteConfig['branding'] ?? []);
  $logo = $configuration->assetUrl($branding['logo'] ?? null);
  $navigation = [
    ['label'=>'平台','items'=>[
      ['route'=>'admin.index','active'=>['admin.index'],'label'=>'平台概览','icon'=>'⌂'],
      ['route'=>'admin.operations','active'=>['admin.operations','admin.users.*','admin.workspaces.*'],'label'=>'用户与工作区','icon'=>'♙'],
      ['route'=>'admin.operations','active'=>['admin.operations.links.*','admin.operations.texts.*','admin.operations.files.*','admin.operations.profiles.*'],'label'=>'内容与资源','icon'=>'▦'],
    ]],
    ['label'=>'运营与治理','items'=>[
      ['route'=>'admin.index','active'=>['admin.reports.*','admin.blocked-targets.*'],'label'=>'风险与举报','icon'=>'⚠'],
      ['route'=>'admin.billing.index','active'=>['admin.billing.*'],'label'=>'套餐与财务','icon'=>'◉'],
      ['route'=>'admin.diagnostics','active'=>['admin.diagnostics'],'label'=>'服务与诊断','icon'=>'⌁'],
    ]],
    ['label'=>'系统','items'=>[
      ['route'=>'admin.settings.index','active'=>['admin.settings.*'],'label'=>'系统设置','icon'=>'⚙'],
    ]],
  ];
@endphp
<!doctype html>
<html lang="zh-CN" class="bg-[#f3f5f4]">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <meta name="robots" content="noindex,nofollow">
  <title>{{ $title ? $title.' · ' : '' }}平台管理 · {{ $identity['site_name'] ?? config('app.name') }}</title>
  @vite(['resources/css/app.css', 'resources/js/app.js'])
  <link rel="stylesheet" href="{{ asset('assets/gojet-v4.css') }}?v=4.0.0">
  <style>:root{--mint:{{ $branding['brand_color'] ?? '#10b981' }};--cyan:{{ $branding['accent_color'] ?? '#22d3ee' }}}.btn-brand{background:linear-gradient(135deg,var(--mint),var(--cyan))!important}.brand-mark{background:linear-gradient(135deg,#0f172a,var(--mint))!important}.marketing-orb{--brand-glow:var(--mint)}</style>
</head>
<body class="admin-body" x-data="{ mobileNavigation:false }">
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-brand"><a href="{{ route('admin.index') }}">@if($logo)<img src="{{ $logo }}" alt="" class="h-8 max-w-[125px] object-contain">@else<span class="brand-mark">✦</span><strong>{{ $identity['site_short_name'] ?? 'GoJet' }}</strong>@endif</a><span>ADMIN</span></div>
      <div class="admin-environment"><i></i><span><small>当前环境</small><strong>{{ app()->environment() }}</strong></span></div>
      <nav class="admin-nav">@foreach($navigation as $group)<div><p>{{ $group['label'] }}</p>@foreach($group['items'] as $item)<a href="{{ route($item['route']) }}" class="{{ request()->routeIs(...$item['active'])?'active':'' }}"><i>{{ $item['icon'] }}</i><span>{{ $item['label'] }}</span></a>@endforeach</div>@endforeach</nav>
      <div class="admin-sidebar-foot"><a href="{{ route('dashboard') }}">← 返回用户控制台</a><div><span class="top-avatar">{{ mb_substr(auth()->user()?->name ?? 'A',0,1) }}</span><span><strong>{{ auth()->user()?->name }}</strong><small>超级管理员</small></span></div></div>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar"><button class="console-mobile-button" @click="mobileNavigation=true">☰</button><div><small>{{ $eyebrow }}</small><strong>{{ $title ?? '平台概览' }}</strong></div><div class="admin-top-actions"><a href="{{ route('home') }}" target="_blank">查看网站 ↗</a><a href="{{ route('admin.diagnostics') }}" class="status-online"><i></i> 系统状态</a><span class="top-avatar">{{ mb_substr(auth()->user()?->name ?? 'A',0,1) }}</span></div></header>
      @if(session('status'))<div class="console-flash"><div class="flash-success">{{ session('status') }}</div></div>@endif
      @if($errors->any())<div class="console-flash"><div class="flash-error"><strong>操作未完成</strong><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div></div>@endif
      <main class="admin-content">{{ $slot }}</main>
    </div>
  </div>
  <div x-cloak x-show="mobileNavigation" class="mobile-drawer"><div class="mobile-backdrop" @click="mobileNavigation=false"></div><aside class="console-mobile-panel"><div class="mobile-panel-head"><strong>平台管理</strong><button @click="mobileNavigation=false">×</button></div><nav>@foreach($navigation as $group)<p>{{ $group['label'] }}</p>@foreach($group['items'] as $item)<a href="{{ route($item['route']) }}"><i>{{ $item['icon'] }}</i>{{ $item['label'] }}</a>@endforeach@endforeach</nav></aside></div>
</body>
</html>
