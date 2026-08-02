<x-layouts.admin title="服务与诊断" eyebrow="系统运行">
  <section class="admin-page diagnostics-page">
    <div class="page-header-pro">
      <div><span class="page-kicker">运行状态</span><h1>服务与诊断</h1><p>所有关键依赖都必须可测试、可解释、可恢复。这里不再混放网站配置。</p></div>
      <a href="{{ route('admin.settings.index') }}" class="btn-secondary">打开系统设置 →</a>
    </div>

    @if(session('error'))<div class="flash-error">{{ session('error') }}</div>@endif

    <div class="diagnostic-grid">
      @foreach($health as $key => $item)
        <article class="diagnostic-card {{ $item['status'] ? 'healthy' : 'unhealthy' }}">
          <div><span class="health-state"><i></i>{{ $item['status'] ? '正常' : '异常' }}</span><h2>{{ ['php'=>'PHP 运行时','database'=>'数据库','redis'=>'Redis','cache'=>'应用缓存','storage'=>'文件存储','queue'=>'任务队列','scheduler'=>'计划任务','mail'=>'邮件系统','redirect_plane'=>'Go 跳转面','cloudflare'=>'Cloudflare'][$key] ?? Str::headline($key) }}</h2></div>
          <p>{{ $item['detail'] }}</p>
          @if(in_array($key, ['database','redis','storage','mail','redirect_plane','cloudflare'], true))
            <form method="post" action="{{ route('admin.diagnostics.test', $key) }}">@csrf<button class="btn-secondary">立即测试</button></form>
          @endif
        </article>
      @endforeach
    </div>

    <div class="pipeline-summary">
      <article><span>待处理任务</span><strong>{{ number_format($pipeline['queue_pending']) }}</strong><small>Queue pending</small></article>
      <article class="{{ $pipeline['queue_failed'] ? 'danger' : '' }}"><span>失败任务</span><strong>{{ number_format($pipeline['queue_failed']) }}</strong><small>需要人工检查</small></article>
      <article class="{{ $pipeline['email_failed_24h'] ? 'danger' : '' }}"><span>24 小时邮件失败</span><strong>{{ number_format($pipeline['email_failed_24h']) }}</strong><small>已记录失败原因</small></article>
      <article class="{{ $pipeline['analytics_failed_24h'] ? 'danger' : '' }}"><span>24 小时统计失败</span><strong>{{ number_format($pipeline['analytics_failed_24h']) }}</strong><small>可补偿事件</small></article>
    </div>

    <div class="diagnostic-columns">
      <section class="settings-card">
        <div class="settings-card-title"><div><span>邮件投递</span><h2>最近发送记录</h2></div><a href="{{ route('admin.settings.index', ['section'=>'mail']) }}">邮件设置 →</a></div>
        <div class="diagnostic-log-list">
          @forelse($recentMail as $log)
            <article><span class="{{ $log->status === 'sent' ? 'badge-success' : 'badge-danger' }}">{{ $log->status === 'sent' ? '已发送' : '失败' }}</span><div><strong>{{ $log->subject ?: $log->message_type }}</strong><small>{{ $log->recipient }} · {{ $log->created_at?->format('m-d H:i:s') }}</small>@if($log->error_message)<p>{{ Str::limit($log->error_message, 180) }}</p>@endif</div></article>
          @empty<div class="empty-compact">暂无邮件投递记录。</div>@endforelse
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card-title"><div><span>分析管道</span><h2>最近写入失败</h2></div><span class="status-note">失败事件保留用于排查</span></div>
        <div class="diagnostic-log-list">
          @forelse($recentAnalyticsFailures as $failure)
            <article><span class="badge-danger">失败</span><div><strong>Link #{{ $failure->link_id }} · {{ $failure->source }}</strong><small>{{ $failure->event_uuid }} · {{ $failure->created_at?->format('m-d H:i:s') }}</small><p>{{ Str::limit($failure->error_message, 180) }}</p></div></article>
          @empty<div class="empty-compact">暂无分析写入失败记录。</div>@endforelse
        </div>
      </section>
    </div>
  </section>
</x-layouts.admin>
