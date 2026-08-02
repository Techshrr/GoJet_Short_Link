<x-layouts.marketing title="系统维护" description="GoJet 正在进行计划维护。">
  <section class="maintenance-page">
    <div class="maintenance-card">
      <span class="maintenance-icon">⌁</span>
      <p class="page-kicker">SERVICE MAINTENANCE</p>
      <h1>系统正在维护</h1>
      <p>{{ $maintenance['message'] ?? '系统正在进行计划维护，请稍后再试。' }}</p>
      <div class="maintenance-meta"><span>预计重试间隔</span><strong>{{ ceil(($maintenance['retry_after'] ?? 900)/60) }} 分钟</strong></div>
      @if($maintenance['allow_login'] ?? true)<a class="btn-primary" href="{{ route('login') }}">管理员或成员登录</a>@endif
    </div>
  </section>
</x-layouts.marketing>
