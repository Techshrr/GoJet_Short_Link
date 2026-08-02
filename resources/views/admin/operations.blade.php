<x-layouts.admin title="运营管理" eyebrow="Platform Operations">
  @php
    $sections = [
      'users'=>['label'=>'用户','icon'=>'人','description'=>'账户状态、管理员权限与会话处置'],
      'workspaces'=>['label'=>'工作区','icon'=>'◇','description'=>'团队、套餐与资源状态'],
      'links'=>['label'=>'短链接','icon'=>'↗','description'=>'链接目标与隔离处置'],
      'texts'=>['label'=>'文本分享','icon'=>'¶','description'=>'公开文本内容审核'],
      'files'=>['label'=>'文件分享','icon'=>'⇩','description'=>'文件扫描与封禁状态'],
      'profiles'=>['label'=>'个人主页','icon'=>'◫','description'=>'主页发布与下架'],
      'subscriptions'=>['label'=>'订阅','icon'=>'◌','description'=>'待审核与生效套餐'],
      'webhooks'=>['label'=>'Webhook','icon'=>'⇄','description'=>'投递状态与响应诊断'],
    ];
    $active = $sections[$section];
  @endphp
  <div class="operations-page">
    <header class="page-header-pro">
      <div><span class="page-kicker">Operations Center</span><h1>运营管理</h1><p>处理用户、工作区、资源审核和交付状态。所有管理动作写入审计日志。</p></div>
      <div class="page-header-actions"><a class="btn-secondary" href="{{ route('admin.diagnostics') }}">系统诊断</a><a class="btn-primary" href="{{ route('admin.settings.index') }}">系统设置</a></div>
    </header>

    <section class="operations-kpi-grid">
      @foreach($sections as $key => $item)
        <a class="operation-kpi {{ $section === $key ? 'active' : '' }}" href="{{ route('admin.operations', ['section'=>$key]) }}">
          <span>{{ $item['icon'] }}</span><div><small>{{ $item['label'] }}</small><strong>{{ number_format($totals[$key] ?? 0) }}</strong></div><b>→</b>
        </a>
      @endforeach
    </section>

    <section class="operations-shell">
      <aside class="operations-nav">
        <div class="operations-nav-head"><span>管理范围</span><small>8 个模块</small></div>
        @foreach($sections as $key => $item)
          <a class="{{ $section === $key ? 'active' : '' }}" href="{{ route('admin.operations', ['section'=>$key]) }}"><i>{{ $item['icon'] }}</i><span><strong>{{ $item['label'] }}</strong><small>{{ $item['description'] }}</small></span><b>{{ number_format($totals[$key] ?? 0) }}</b></a>
        @endforeach
      </aside>

      <div class="operations-content">
        <div class="operations-toolbar">
          <div><span class="eyebrow-label">{{ strtoupper($section) }}</span><h2>{{ $active['label'] }}</h2><p>{{ $active['description'] }}</p></div>
          <form method="get"><input type="hidden" name="section" value="{{ $section }}"><div class="search-field"><span>⌕</span><input name="q" value="{{ request('q') }}" placeholder="搜索{{ $active['label'] }}"><button>搜索</button></div></form>
        </div>

        <div class="operations-table-wrap">
          @if($section === 'users')
            <table class="operations-table"><thead><tr><th>用户</th><th>账户状态</th><th>资源</th><th>工作区</th><th>权限与处置</th></tr></thead><tbody>
            @foreach($records as $user)<tr><td><div class="table-identity"><span>{{ mb_substr($user->name,0,1) }}</span><div><strong>{{ $user->name }}</strong><small>{{ $user->email }}</small></div></div></td><td><span class="status-pill {{ $user->status==='active'?'success':'danger' }}">{{ $user->status==='active'?'正常':'已暂停' }}</span></td><td><b>{{ $user->links_count }}</b><small> 个链接</small></td><td><b>{{ $user->owned_workspaces_count }}</b><small> 个工作区</small></td><td><form class="operation-inline-form" method="post" action="{{ route('admin.users.update',$user) }}">@csrf @method('patch')<select class="input compact" name="status"><option value="active" @selected($user->status==='active')>正常</option><option value="suspended" @selected($user->status==='suspended')>暂停</option></select><label class="check-option"><input type="checkbox" name="is_admin" value="1" @checked($user->is_admin)>管理员</label><button class="text-action">保存</button></form></td></tr>@endforeach
            </tbody></table>
          @elseif($section === 'workspaces')
            <table class="operations-table"><thead><tr><th>工作区</th><th>所有者</th><th>规模</th><th>状态</th><th>套餐与处置</th></tr></thead><tbody>
            @foreach($records as $workspace)<tr><td><div class="table-primary"><strong>{{ $workspace->name }}</strong><small>{{ $workspace->slug }}</small></div></td><td>{{ $workspace->owner?->email ?: '—' }}</td><td><b>{{ $workspace->members_count }}</b><small> 成员 · {{ $workspace->links_count }} 链接 · {{ $workspace->domains_count }} 域名</small></td><td><span class="status-pill {{ $workspace->status==='active'?'success':'danger' }}">{{ $workspace->status==='active'?'正常':'已暂停' }}</span></td><td><form class="operation-inline-form" method="post" action="{{ route('admin.workspaces.update',$workspace) }}">@csrf @method('patch')<select class="input compact" name="status"><option value="active" @selected($workspace->status==='active')>正常</option><option value="suspended" @selected($workspace->status==='suspended')>暂停</option></select><input class="input compact" name="plan_code" value="{{ $workspace->plan_code }}"><button class="text-action">保存</button></form></td></tr>@endforeach
            </tbody></table>
          @elseif($section === 'links')
            <table class="operations-table"><thead><tr><th>短链接</th><th>目标地址</th><th>归属</th><th>状态</th><th>处置</th></tr></thead><tbody>
            @foreach($records as $link)<tr><td><div class="table-primary"><strong>{{ $link->title ?: $link->slug }}</strong><small>{{ $link->host }}/{{ $link->slug }}</small></div></td><td><div class="truncate-cell" title="{{ $link->target_url }}">{{ $link->target_url }}</div></td><td><div class="table-primary"><strong>{{ $link->workspace?->name ?: '—' }}</strong><small>{{ $link->user?->email }}</small></div></td><td><span class="status-pill {{ $link->status==='active'?'success':'danger' }}">{{ $link->status==='active'?'可访问':'已隔离' }}</span></td><td><form method="post" action="{{ route('admin.operations.links.quarantine',$link) }}">@csrf @method('patch')<button class="{{ $link->status==='active'?'danger-button':'restore-button' }}">{{ $link->status==='active'?'隔离链接':'恢复链接' }}</button></form></td></tr>@endforeach
            </tbody></table>
          @elseif($section === 'texts')
            <table class="operations-table"><thead><tr><th>文本</th><th>归属</th><th>格式</th><th>状态</th><th>处置</th></tr></thead><tbody>
            @foreach($records as $record)<tr><td><div class="table-primary"><strong>{{ $record->title ?: $record->slug }}</strong><small>{{ $record->slug }}</small></div></td><td>{{ $record->user?->email ?: '—' }}</td><td>{{ $record->format }} · {{ $record->visibility }}</td><td><span class="status-pill {{ $record->trashed()?'danger':'success' }}">{{ $record->trashed()?'已隔离':'正常' }}</span></td><td><form method="post" action="{{ route('admin.operations.texts.quarantine',$record->id) }}">@csrf @method('patch')<button class="{{ $record->trashed()?'restore-button':'danger-button' }}">{{ $record->trashed()?'恢复':'隔离' }}</button></form></td></tr>@endforeach
            </tbody></table>
          @elseif($section === 'files')
            <table class="operations-table"><thead><tr><th>文件</th><th>大小</th><th>归属</th><th>扫描状态</th><th>处置</th></tr></thead><tbody>
            @foreach($records as $record)<tr><td><div class="table-primary"><strong>{{ $record->original_name }}</strong><small>{{ $record->slug }}</small></div></td><td>{{ \Illuminate\Support\Number::fileSize($record->size_bytes) }}</td><td>{{ $record->user?->email ?: '—' }}</td><td><span class="status-pill {{ $record->scan_status==='blocked'?'danger':'success' }}">{{ $record->scan_status==='blocked'?'已封禁':$record->scan_status }}</span></td><td><form method="post" action="{{ route('admin.operations.files.quarantine',$record->id) }}">@csrf @method('patch')<button class="{{ $record->scan_status==='blocked'?'restore-button':'danger-button' }}">{{ $record->scan_status==='blocked'?'解除封禁':'封禁文件' }}</button></form></td></tr>@endforeach
            </tbody></table>
          @elseif($section === 'profiles')
            <table class="operations-table"><thead><tr><th>主页</th><th>归属</th><th>状态</th><th>更新时间</th><th>处置</th></tr></thead><tbody>
            @foreach($records as $record)<tr><td><div class="table-primary"><strong>{{ $record->title }}</strong><small>/p/{{ $record->slug }}</small></div></td><td>{{ $record->user?->email ?: '—' }}</td><td><span class="status-pill {{ $record->status==='published'?'success':'neutral' }}">{{ $record->status==='published'?'已发布':'草稿' }}</span></td><td>{{ $record->updated_at?->format('Y-m-d H:i') }}</td><td><form method="post" action="{{ route('admin.operations.profiles.quarantine',$record->id) }}">@csrf @method('patch')<button class="{{ $record->status==='published'?'danger-button':'restore-button' }}">{{ $record->status==='published'?'下架':'发布' }}</button></form></td></tr>@endforeach
            </tbody></table>
          @elseif($section === 'subscriptions')
            <table class="operations-table"><thead><tr><th>工作区</th><th>套餐</th><th>周期</th><th>状态</th><th>操作</th></tr></thead><tbody>
            @foreach($records as $record)<tr><td>{{ $record->workspace?->name ?: '—' }}</td><td><strong>{{ $record->plan?->name ?: '—' }}</strong></td><td>{{ $record->interval }}</td><td><span class="status-pill {{ $record->status==='active'?'success':($record->status==='pending'?'warning':'neutral') }}">{{ $record->status }}</span></td><td>@if($record->status==='pending')<form method="post" action="{{ route('admin.subscriptions.approve',$record) }}">@csrf<button class="restore-button">审核通过</button></form>@else<span class="locked-action">无需操作</span>@endif</td></tr>@endforeach
            </tbody></table>
          @elseif($section === 'webhooks')
            <table class="operations-table"><thead><tr><th>事件</th><th>工作区</th><th>状态</th><th>HTTP</th><th>响应摘要</th></tr></thead><tbody>
            @foreach($records as $record)<tr><td><div class="table-primary"><strong>{{ $record->event_name }}</strong><small>{{ $record->event_id }}</small></div></td><td>{{ $record->webhook?->workspace?->name ?: '—' }}</td><td><span class="status-pill {{ $record->status==='delivered'?'success':($record->status==='failed'?'danger':'warning') }}">{{ $record->status }}</span></td><td>{{ $record->response_status ?: '—' }}</td><td><div class="truncate-cell">{{ $record->response_body ?: '—' }}</div></td></tr>@endforeach
            </tbody></table>
          @endif

          @if($records->isEmpty())<div class="operations-empty"><span>⌕</span><h3>没有找到记录</h3><p>调整关键词或切换管理范围后重试。</p></div>@endif
        </div>
        @if($records->hasPages())<div class="operations-pagination">{{ $records->links() }}</div>@endif
      </div>
    </section>
  </div>
</x-layouts.admin>
