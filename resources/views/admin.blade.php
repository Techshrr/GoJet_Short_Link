<x-layouts.admin title="平台概览" eyebrow="运营总览">
  <section class="admin-page admin-dashboard">
    <div class="page-header-pro">
      <div><span class="page-kicker">GOJET OPERATIONS</span><h1>平台概览</h1><p>用户、链接、访问、风险与基础设施状态集中在一个真正可运营的后台中。</p></div>
      <div class="page-header-actions"><a class="btn-secondary" href="{{ route('admin.diagnostics') }}">服务诊断</a><a class="btn-primary" href="{{ route('admin.settings.index') }}">系统设置</a></div>
    </div>

    <div class="admin-kpi-grid">
      @foreach([
        ['用户总数',$totals['users'],'♙','全部注册账户'],
        ['工作区',$totals['workspaces'],'◫','品牌与团队空间'],
        ['链接总数',$totals['links'],'↗','包含停用与归档'],
        ['累计点击',$totals['clicks'],'⌁','已持久化核心计数'],
        ['今日访问',$totals['today_clicks'],'◉','从今日 00:00 起'],
        ['已验证域名',$totals['domains'],'◎','可用于品牌短链'],
        ['待处理举报',$totals['reports'],'!','需要运营处理'],
        ['邮件失败',$totals['mail_failures'],'✉','最近 24 小时'],
      ] as $item)
        <article><div class="kpi-icon">{{ $item[2] }}</div><span>{{ $item[0] }}</span><strong>{{ number_format($item[1]) }}</strong><small>{{ $item[3] }}</small></article>
      @endforeach
    </div>

    <div class="admin-overview-grid">
      <section class="admin-chart-card" x-data="trendChart(@js($trend), {clicks:'访问', unique:'独立访客'})">
        <div class="analytics-section-head"><div><span>访问趋势</span><h2>最近 14 天真实事件</h2><p>图表只读取 click_events 和日聚合记录。</p></div><a href="{{ route('admin.operations',['section'=>'links']) }}">查看链接 →</a></div>
        <div class="admin-chart" x-ref="chart"></div>
      </section>
      <aside class="system-pulse-card">
        <div class="analytics-section-head"><div><span>系统脉搏</span><h2>运营健康状态</h2></div><a href="{{ route('admin.diagnostics') }}">完整诊断 →</a></div>
        @foreach([
          ['活跃用户',$health['active_users'],$health['active_users']>0],
          ['活跃链接',$health['active_links'],$health['active_links']>0],
          ['统计写入失败',$health['analytics_failures'],$health['analytics_failures']===0],
          ['失败队列任务',$health['queue_failures'],$health['queue_failures']===0],
        ] as $row)<div class="pulse-row"><i class="{{ $row[2]?'ok':'warn' }}"></i><span>{{ $row[0] }}</span><strong>{{ number_format($row[1]) }}</strong></div>@endforeach
      </aside>
    </div>

    <div class="admin-content-grid">
      <section class="admin-table-card">
        <div class="analytics-section-head"><div><span>链接资产</span><h2>最近创建的链接</h2></div><a href="{{ route('admin.operations',['section'=>'links']) }}">全部链接 →</a></div>
        <div class="data-table-wrap"><table class="data-table"><thead><tr><th>链接</th><th>工作区 / 用户</th><th>点击</th><th>状态</th><th>操作</th></tr></thead><tbody>
          @forelse($latestLinks as $link)<tr><td><a class="table-primary" href="{{ route('links.show',$link) }}">{{ $link->title ?: $link->slug }}</a><small>{{ $link->host }}/{{ $link->slug }}</small></td><td><strong>{{ $link->workspace?->name ?: '个人空间' }}</strong><small>{{ $link->user?->email }}</small></td><td>{{ number_format($link->clicks_count) }}</td><td><span class="{{ $link->status==='active'?'badge-success':'badge-danger' }}">{{ $link->status==='active'?'运行中':'已停用' }}</span></td><td><form method="post" action="{{ route('admin.links.toggle',$link) }}">@csrf @method('patch')<button class="text-action">{{ $link->status==='active'?'停用':'恢复' }}</button></form></td></tr>
          @empty<tr><td colspan="5" class="empty-cell">暂无链接。</td></tr>@endforelse
        </tbody></table></div>
      </section>

      <section class="admin-side-card">
        <div class="analytics-section-head"><div><span>风险治理</span><h2>待处理举报</h2></div><a href="{{ route('admin.operations',['section'=>'links']) }}">运营中心 →</a></div>
        <div class="report-list">@forelse($reports as $report)<article><div><span class="badge-danger">{{ strtoupper($report->reason) }}</span><small>{{ $report->created_at?->diffForHumans() }}</small></div><strong>{{ $report->short_url }}</strong><p>{{ Str::limit($report->details,120) }}</p><a href="{{ route('admin.index') }}#reports">处理举报 →</a></article>@empty<div class="empty-compact">当前没有待处理举报。</div>@endforelse</div>
      </section>
    </div>

    <div class="admin-content-grid lower">
      <section class="admin-table-card" id="reports">
        <div class="analytics-section-head"><div><span>审计</span><h2>最近操作记录</h2></div></div>
        <div class="audit-stream">@forelse($auditLogs as $log)<article><i></i><div><strong>{{ $log->action }}</strong><p>{{ $log->actor?->email ?? '系统任务' }} · {{ class_basename((string)$log->subject_type) }} #{{ $log->subject_id }}</p></div><time>{{ $log->created_at?->format('m-d H:i:s') }}</time></article>@empty<div class="empty-compact">暂无审计记录。</div>@endforelse</div>
      </section>
      <section class="admin-side-card">
        <div class="analytics-section-head"><div><span>目标治理</span><h2>最近黑名单规则</h2></div></div>
        <div class="blocked-list">@forelse($blockedTargets as $blocked)<article><span class="{{ $blocked->is_active?'badge-danger':'badge-neutral' }}">{{ $blocked->is_active?'生效中':'已暂停' }}</span><div><strong>{{ $blocked->value }}</strong><small>{{ $blocked->match_type }} · {{ $blocked->reason ?: '未填写原因' }}</small></div></article>@empty<div class="empty-compact">暂无目标黑名单。</div>@endforelse</div>
      </section>
    </div>
  </section>
</x-layouts.admin>
