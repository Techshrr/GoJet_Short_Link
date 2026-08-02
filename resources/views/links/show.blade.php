<x-layouts.app :title="($link->title ?: $link->slug).' · '.__('ui.link.analytics_title')">
  <section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10" x-data="clipboard">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <a class="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950" href="{{ route('dashboard') }}">← {{ __('ui.link.back_dashboard') }}</a>
        <div class="mt-5 flex flex-wrap items-center gap-2">
          <span class="{{ $link->status === 'active' ? 'badge-success' : 'badge-danger' }}"><span class="h-1.5 w-1.5 rounded-full bg-current"></span>{{ $link->status === 'active' ? __('ui.link.active') : __('ui.link.disabled') }}</span>
          @if($link->password_hash)<span class="badge-info">🔒 {{ __('ui.link.password_protected') }}</span>@endif
          @if($link->expires_at)<span class="badge-warning">◷ {{ __('ui.link.has_expiry') }}</span>@endif
          <span class="badge-neutral">HTTP {{ $link->redirect_type }}</span>
        </div>
        <h1 class="page-title mt-3 truncate">{{ $link->title ?: $link->slug }}</h1>
        <div class="mt-3 flex min-w-0 items-center gap-2"><button class="max-w-full truncate text-left font-semibold text-cyan-700 hover:text-cyan-900" type="button" @click="copy(@js($shortUrl))">{{ $shortUrl }}</button><span class="shrink-0 text-xs text-slate-400" x-text="copied ? @js(__('ui.common.copied')) : @js(__('ui.common.copy'))"></span></div>
        <p class="mt-2 max-w-3xl truncate text-sm text-slate-500">{{ __('ui.link.destination') }} · {{ $link->target_url }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        @foreach([7, 30, 90] as $value)
          <a class="{{ $days === $value ? 'btn-primary' : 'btn-secondary' }}" href="{{ route('links.show', ['link' => $link, 'days' => $value]) }}">{{ __('ui.link.days', ['count' => $value]) }}</a>
        @endforeach
        <a class="btn-secondary" href="{{ route('links.export', ['link' => $link, 'days' => $days]) }}">↓ {{ __('ui.link.export_csv') }}</a>
      </div>
    </div>

    @if($summary['pending_clicks'] > 0)<div class="analytics-pending"><span>↻</span><div><strong>{{ number_format($summary['pending_clicks']) }} 个事件正在等待持久化</strong><p>Go 跳转面已经把事件写入耐久磁盘队列；控制面恢复后会自动重试，当前总数已包含这些事件。</p></div></div>@endif

    <div class="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      @foreach([
        [__('ui.link.period_clicks'), number_format($summary['clicks']), '↗', 'bg-cyan-50 text-cyan-700'],
        [__('ui.link.unique_visitors'), number_format($summary['unique_clicks']), '◉', 'bg-indigo-50 text-indigo-700'],
        [__('ui.link.bot_visits'), number_format($summary['bot_clicks']), '⌁', 'bg-amber-50 text-amber-700'],
        ['二维码访问', number_format($summary['qr_clicks']), '▦', 'bg-violet-50 text-violet-700'],
        [__('ui.link.all_time_clicks'), number_format($summary['all_time_clicks']), 'Σ', 'bg-emerald-50 text-emerald-700'],
      ] as $stat)
        <div class="stat-card flex items-center gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl {{ $stat[3] }}">{{ $stat[2] }}</span><div><p class="text-sm font-medium text-slate-500">{{ $stat[0] }}</p><p class="mt-1 text-3xl font-bold text-slate-950">{{ $stat[1] }}</p></div></div>
      @endforeach
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_340px]">
      <div class="card" x-data="trendChart(@js($trend->values()), { clicks: @js(__('ui.link.clicks')), unique: @js(__('ui.link.unique')) })">
        <div><h2 class="font-bold text-slate-950">{{ __('ui.link.trend') }}</h2><p class="mt-1 text-sm text-slate-500">{{ __('ui.link.trend_legend') }}</p></div>
        <div class="mt-3 h-80 w-full" x-ref="chart"></div>
      </div>

      <div class="card text-center" x-data="qrCode(@js($shortUrl))">
        <div class="text-left"><h2 class="font-bold text-slate-950">{{ __('ui.link.qr_title') }}</h2><p class="mt-1 text-sm leading-6 text-slate-500">{{ __('ui.link.qr_description') }}</p></div>
        <div class="mt-5 inline-flex rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><canvas x-ref="canvas"></canvas></div>
        <button class="btn-secondary mt-5 w-full" type="button" @click="download(@js('gojet-'.$link->slug.'.png'))">↓ {{ __('ui.link.download_png') }}</button>
      </div>
    </div>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      @foreach([
        'source_channels' => '渠道',
        'referrers' => __('ui.link.referrers'),
        'devices' => __('ui.link.devices'),
        'browsers' => __('ui.link.browsers'),
        'platforms' => __('ui.link.platforms'),
        'countries' => __('ui.link.countries'),
      ] as $key => $title)
        <div class="card">
          <h2 class="font-bold text-slate-950">{{ $title }}</h2>
          <div class="mt-4 space-y-3">
            @forelse($dimensions[$key] as $row)
              <div class="flex items-center justify-between gap-3 text-sm"><span class="truncate text-slate-500">{{ $row['label'] }}</span><strong class="text-slate-900">{{ number_format($row['value']) }}</strong></div>
            @empty
              <p class="py-5 text-center text-sm text-slate-400">{{ __('ui.link.no_data') }}</p>
            @endforelse
          </div>
        </div>
      @endforeach
    </div>



    <div class="analytics-detail-grid">
      <section class="analytics-events-card">
        <div class="analytics-section-head"><div><span>实时访问事件</span><h2>最近 50 次访问</h2><p>来源类型、渠道、终端、地域和持久化入口均来自真实事件。</p></div><a href="{{ route('links.export',['link'=>$link,'days'=>$days]) }}">导出完整 CSV →</a></div>
        <div class="data-table-wrap"><table class="data-table analytics-events-table"><thead><tr><th>时间</th><th>访客</th><th>来源</th><th>终端</th><th>地域</th><th>入口</th></tr></thead><tbody>
          @forelse($recentEvents as $event)
            <tr><td>{{ $event->occurred_at?->format('m-d H:i:s') }}</td><td><span class="{{ $event->is_bot?'badge-warning':($event->is_unique?'badge-success':'badge-neutral') }}">{{ $event->is_bot?'机器人':($event->is_unique?'新访客':'回访') }}</span></td><td><strong>{{ $event->source_channel ?: 'unknown' }}</strong><small>{{ $event->referrer_host ?: ($event->referrer_type==='direct'?'直接访问':'未提供') }}</small></td><td><strong>{{ $event->device_type ?: 'unknown' }}</strong><small>{{ $event->browser }} · {{ $event->platform }}</small></td><td><strong>{{ $event->country_code ?: '—' }}</strong><small>{{ collect([$event->region,$event->city])->filter()->join(' / ') ?: '未提供地域' }}</small></td><td><strong>{{ $event->ingestion_source }}</strong><small>{{ $event->destination?->name ?: '默认目标' }}</small></td></tr>
          @empty<tr><td colspan="6" class="empty-cell">该时间范围内还没有访问事件。访问短链接后，事件会在这里实时出现。</td></tr>@endforelse
        </tbody></table></div>
      </section>
      <aside class="analytics-breakdown-card"><div class="analytics-section-head"><div><span>更多维度</span><h2>地域与活动</h2></div></div>@foreach(['regions'=>'地区','cities'=>'城市','languages'=>'语言','utm_sources'=>'UTM 来源','destinations'=>'目标分流'] as $key=>$label)<div class="mini-dimension"><strong>{{ $label }}</strong>@forelse($dimensions[$key] as $row)<p><span>{{ $row['label'] }}</span><b>{{ number_format($row['value']) }}</b></p>@empty<small>暂无数据</small>@endforelse</div>@endforeach</aside>
    </div>

    <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form class="panel" method="post" action="{{ route('links.update', $link) }}">
        @csrf @method('patch')
        <div class="flex items-center gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">✎</span><h2 class="text-lg font-bold text-slate-950">{{ __('ui.link.edit_title') }}</h2></div>
        <div class="mt-6 space-y-4">
          <div><label class="label" for="target_url">{{ __('ui.link.target_url') }}</label><input class="input" id="target_url" type="url" name="target_url" value="{{ old('target_url', $link->target_url) }}" required></div>
          <div><label class="label" for="title">{{ __('ui.link.internal_title') }}</label><input class="input" id="title" name="title" value="{{ old('title', $link->title) }}"></div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label class="label" for="status">{{ __('ui.link.status') }}</label><select class="input" id="status" name="status"><option value="active" @selected($link->status === 'active')>{{ __('ui.common.active') }}</option><option value="disabled" @selected($link->status === 'disabled')>{{ __('ui.common.disabled') }}</option></select></div>
            <div><label class="label" for="redirect_type">{{ __('ui.link.redirect_type') }}</label><select class="input" id="redirect_type" name="redirect_type">@foreach([302, 307, 301, 308] as $type)<option value="{{ $type }}" @selected($link->redirect_type === $type)>HTTP {{ $type }}</option>@endforeach</select></div>
            <div><label class="label" for="max_clicks">{{ __('ui.link.click_limit') }}</label><input class="input" id="max_clicks" type="number" min="1" name="max_clicks" value="{{ old('max_clicks', $link->max_clicks) }}"></div>
            <div><label class="label" for="expires_at">{{ __('ui.link.expires_at') }}</label><input class="input" id="expires_at" type="datetime-local" name="expires_at" value="{{ old('expires_at', $link->expires_at?->format('Y-m-d\TH:i')) }}"></div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label class="label" for="password">{{ __('ui.link.new_password') }}</label><input class="input" id="password" type="password" name="password" autocomplete="new-password" placeholder="{{ __('ui.link.password_unchanged') }}"></div>
            <label class="mt-7 flex items-center gap-2 text-sm font-medium text-slate-600"><input class="h-4 w-4 rounded border-slate-300" type="checkbox" name="remove_password" value="1"> {{ __('ui.link.remove_password') }}</label>
          </div>
          <button class="btn-brand" type="submit">{{ __('ui.link.save') }}</button>
        </div>
      </form>

      <div class="card h-fit">
        <h2 class="font-bold text-slate-950">{{ __('ui.link.info') }}</h2>
        <dl class="mt-5 space-y-4 text-sm">
          <div class="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt class="text-slate-500">{{ __('ui.link.slug') }}</dt><dd class="font-mono font-semibold text-slate-900">{{ $link->slug }}</dd></div>
          <div class="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt class="text-slate-500">{{ __('ui.link.domain') }}</dt><dd class="truncate font-semibold text-slate-900">{{ $link->host }}</dd></div>
          <div class="flex justify-between gap-4 border-b border-slate-100 pb-3"><dt class="text-slate-500">{{ __('ui.link.created_at') }}</dt><dd class="text-right text-slate-700">{{ $link->created_at->format('Y-m-d H:i') }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-slate-500">{{ __('ui.link.expiry') }}</dt><dd class="text-right text-slate-700">{{ $link->expires_at?->format('Y-m-d H:i') ?? __('ui.link.no_expiry') }}</dd></div>
        </dl>
        <form class="mt-6 border-t border-slate-100 pt-5" method="post" action="{{ route('links.destroy', $link) }}" onsubmit="return confirm(@js(__('ui.link.delete_confirm')))">@csrf @method('delete')<button class="btn-danger w-full">{{ __('ui.link.delete') }}</button></form>
      </div>
    </div>
  </section>
</x-layouts.app>
