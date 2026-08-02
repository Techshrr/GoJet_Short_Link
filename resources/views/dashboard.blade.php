<x-layouts.app title="总览" :eyebrow="$workspace->name">
  <div class="dashboard-page">
    <section class="dashboard-welcome">
      <div><span>{{ now()->translatedFormat('Y年n月j日 l') }}</span><h1>晚上好，{{ auth()->user()->name }}</h1><p>这里展示当前工作区的真实链接数据、最近访问与需要处理的事项。</p></div>
      <div class="dashboard-actions"><a href="{{ route('links.index') }}" class="btn-secondary">查看全部链接</a><a href="{{ route('links.index') }}#create" class="btn-primary">＋ 创建链接</a></div>
    </section>

    <section class="quick-create-panel" x-data="{advanced:false}">
      <div class="quick-create-head"><div><span>快速创建</span><h2>把长网址变成可管理的品牌链接</h2></div><button type="button" @click="advanced=!advanced" x-text="advanced?'收起选项':'更多选项'"></button></div>
      <form method="post" action="{{ route('links.store') }}">@csrf
        <div class="quick-create-main"><div class="url-prefix">↗</div><input type="url" name="target_url" placeholder="粘贴目标网址，例如 https://example.com/campaign" required><button>创建链接 →</button></div>
        <div x-cloak x-show="advanced" class="quick-create-advanced"><label><span>标题</span><input class="input" name="title" placeholder="内部名称，便于团队识别"></label><label><span>自定义短码</span><input class="input" name="slug" placeholder="launch-2026"></label><label><span>品牌域名</span><select class="input" name="domain_id"><option value="">{{ config('gojet.default_host') }}</option>@foreach($domains as $domain)<option value="{{ $domain->id }}">{{ $domain->hostname }}</option>@endforeach</select></label></div>
      </form>
    </section>

    <section class="dashboard-stats">
      @foreach([
        ['label'=>'总点击','value'=>$totals['clicks'],'delta'=>'全部链接累计','icon'=>'⌁'],
        ['label'=>'今日点击','value'=>$totals['today_clicks'],'delta'=>'从 00:00 至今','icon'=>'↗'],
        ['label'=>'今日独立访客','value'=>$totals['today_unique'],'delta'=>'机器人已排除','icon'=>'♙'],
        ['label'=>'活跃链接','value'=>$totals['active_links'],'delta'=>'共 '.$totals['links'].' 条链接','icon'=>'▦'],
        ['label'=>'已验证域名','value'=>$totals['domains'],'delta'=>'可用于品牌短链','icon'=>'◎'],
      ] as $stat)<article><div><span>{{ $stat['label'] }}</span><strong>{{ number_format($stat['value']) }}</strong><small>{{ $stat['delta'] }}</small></div><i>{{ $stat['icon'] }}</i></article>@endforeach
    </section>

    <section class="dashboard-grid-main">
      <article class="dashboard-card trend-card" x-data="trendChart(@js($trend), {clicks:'点击', unique:'独立访客'})">
        <div class="dashboard-card-head"><div><span>访问趋势</span><h2>最近 14 天</h2></div><a href="{{ route('links.index') }}">查看链接分析 →</a></div>
        <div class="trend-chart" x-ref="chart"></div>
      </article>
      <article class="dashboard-card top-links-card">
        <div class="dashboard-card-head"><div><span>表现排名</span><h2>热门链接</h2></div><a href="{{ route('links.index',['sort'=>'clicks_count']) }}">全部 →</a></div>
        <div class="top-link-list">@forelse($topLinks as $index=>$link)<a href="{{ route('links.show',$link) }}"><b>{{ $index+1 }}</b><span><strong>{{ $link->title ?: $link->slug }}</strong><small>{{ $link->host }}/{{ $link->slug }}</small></span><em>{{ number_format($link->clicks_count) }}</em></a>@empty<div class="empty-compact">还没有链接数据</div>@endforelse</div>
      </article>
    </section>

    <section class="dashboard-grid-bottom">
      <article class="dashboard-card recent-links-card">
        <div class="dashboard-card-head"><div><span>资产</span><h2>最近创建的链接</h2></div><a href="{{ route('links.index') }}">管理全部 →</a></div>
        <div class="responsive-table"><table class="data-table"><thead><tr><th>链接</th><th>目标</th><th>状态</th><th>点击</th><th>创建时间</th><th></th></tr></thead><tbody>@forelse($recentLinks as $link)<tr><td><a href="{{ route('links.show',$link) }}" class="link-title-cell"><strong>{{ $link->title ?: $link->slug }}</strong><small>https://{{ $link->host }}/{{ $link->slug }}</small></a></td><td class="target-cell">{{ Str::limit($link->target_url,45) }}</td><td><span class="{{ $link->status==='active'?'badge-success':'badge-neutral' }}">{{ $link->status==='active'?'运行中':'已停用' }}</span></td><td><strong>{{ number_format($link->clicks_count) }}</strong></td><td>{{ $link->created_at->diffForHumans() }}</td><td><a href="{{ route('links.show',$link) }}" class="row-action">→</a></td></tr>@empty<tr><td colspan="6" class="empty-cell">还没有链接，使用上方表单创建第一条。</td></tr>@endforelse</tbody></table></div>
      </article>
      <article class="dashboard-card activity-card">
        <div class="dashboard-card-head"><div><span>实时活动</span><h2>最近访问</h2></div><span class="live-dot"><i></i> LIVE</span></div>
        <div class="activity-list">@forelse($recentEvents as $event)<div><i class="{{ $event->is_bot?'bot':'' }}">{{ $event->is_bot?'B':'↗' }}</i><span><strong>{{ $event->link?->title ?: $event->link?->slug }}</strong><small>{{ $event->referrer_host ?: '直接访问' }} · {{ $event->country_code ?: '未知地区' }} · {{ $event->device_type ?: '未知设备' }}</small></span><time>{{ $event->occurred_at?->diffForHumans() }}</time></div>@empty<div class="empty-compact">暂无访问事件。创建并访问一个短链接后，这里会立即出现记录。</div>@endforelse</div>
      </article>
    </section>
  </div>
</x-layouts.app>
