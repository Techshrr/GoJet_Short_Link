<x-layouts.app title="工作区与成员" eyebrow="团队协作">
  @php
    $roleLabels = ['owner'=>'所有者','admin'=>'管理员','editor'=>'编辑者','analyst'=>'分析员','viewer'=>'只读成员'];
    $statusLabels = ['active'=>'已加入','invited'=>'待接受','expired'=>'已过期','revoked'=>'已撤销'];
  @endphp
  <div class="workspace-page">
    <header class="page-header-pro">
      <div>
        <span class="page-kicker">Workspace & Team</span>
        <h1>工作区与成员</h1>
        <p>集中管理工作区、套餐配额、成员角色和邀请生命周期。</p>
      </div>
      <button type="button" class="btn-brand" onclick="document.getElementById('create-workspace').showModal()">＋ 新建工作区</button>
    </header>

    <section class="workspace-switch-grid" aria-label="工作区切换">
      @foreach($workspaces as $workspace)
        <article class="workspace-switch-card {{ $workspace->id === $current->id ? 'is-current' : '' }}">
          <div class="workspace-switch-top">
            <span class="workspace-large-avatar">{{ mb_substr($workspace->name, 0, 1) }}</span>
            @if($workspace->id === $current->id)<span class="status-pill success">当前工作区</span>@else<span class="status-pill neutral">可访问</span>@endif
          </div>
          <h2>{{ $workspace->name }}</h2>
          <p>{{ $workspace->slug }} · {{ $workspace->members_count }} 位成员</p>
          @if($workspace->id !== $current->id)
            <form method="post" action="{{ route('workspaces.switch', $workspace) }}">@csrf<button class="btn-secondary w-full">切换到此工作区</button></form>
          @else
            <div class="current-workspace-mark">✓ 正在使用</div>
          @endif
        </article>
      @endforeach
    </section>

    <div class="workspace-main-grid">
      <div class="workspace-primary-column">
        <section class="console-card workspace-overview-card">
          <div class="workspace-overview-head">
            <div>
              <span class="eyebrow-label">当前工作区</span>
              <h2>{{ $current->name }}</h2>
              <p>{{ $plan?->name ?? strtoupper($current->plan_code) }} 套餐 · 状态：{{ $current->status === 'active' ? '正常' : '已暂停' }}</p>
            </div>
            @if($canAdminister)
              <details class="inline-editor">
                <summary class="btn-secondary">编辑信息</summary>
                <form method="post" action="{{ route('workspaces.update', $current) }}">
                  @csrf @method('patch')
                  <label>工作区名称<input class="input" name="name" value="{{ $current->name }}" required></label>
                  <label>状态<select class="input" name="status"><option value="active" @selected($current->status==='active')>正常</option><option value="suspended" @selected($current->status==='suspended')>暂停</option></select></label>
                  <button class="btn-primary">保存更改</button>
                </form>
              </details>
            @endif
          </div>

          <div class="quota-grid">
            @foreach($quotaSummary as $resource => $quota)
              @php $percent = $quota['limit'] ? min(100, round(($quota['used'] / max(1, $quota['limit'])) * 100)) : 0; @endphp
              <div class="quota-card">
                <div><span>{{ __('v3.resource_'.$resource) }}</span><strong>{{ number_format($quota['used']) }} <small>/ {{ $quota['limit'] ? number_format($quota['limit']) : '不限' }}</small></strong></div>
                <div class="quota-track"><i style="width:{{ $quota['limit'] ? $percent : 8 }}%"></i></div>
                <small>{{ $quota['limit'] ? $percent.'% 已使用' : '当前套餐未设置上限' }}</small>
              </div>
            @endforeach
          </div>
        </section>

        <section class="console-card member-card">
          <div class="card-section-head">
            <div><span class="eyebrow-label">Members</span><h2>成员与权限</h2><p>角色变更仅对已接受邀请的成员生效。</p></div>
            <span class="count-badge">{{ $current->members->count() }}</span>
          </div>

          @if($canAdminister)
            <form class="invite-bar" method="post" action="{{ route('workspaces.invite', $current) }}">
              @csrf
              <div><label>成员邮箱</label><input class="input" type="email" name="email" placeholder="name@example.com" required></div>
              <div><label>初始角色</label><select class="input" name="role">@foreach(['admin','editor','analyst','viewer'] as $role)<option value="{{ $role }}">{{ $roleLabels[$role] }}</option>@endforeach</select></div>
              <button class="btn-brand">发送邀请</button>
            </form>
          @endif

          <div class="member-table-wrap">
            <table class="member-table">
              <thead><tr><th>成员</th><th>角色</th><th>状态</th><th>邀请信息</th><th>操作</th></tr></thead>
              <tbody>
                @foreach($current->members as $member)
                  @php
                    $displayStatus = $member->status === 'invited' && $member->invitationExpired() ? 'expired' : $member->status;
                  @endphp
                  <tr>
                    <td><div class="member-person"><span>{{ mb_substr($member->user?->name ?: $member->email, 0, 1) }}</span><div><strong>{{ $member->user?->name ?: '待加入成员' }}</strong><small>{{ $member->email }}</small></div></div></td>
                    <td><span class="role-badge role-{{ $member->role }}">{{ $roleLabels[$member->role] ?? $member->role }}</span></td>
                    <td><span class="status-pill {{ $displayStatus === 'active' ? 'success' : ($displayStatus === 'invited' ? 'warning' : 'neutral') }}">{{ $statusLabels[$displayStatus] ?? $displayStatus }}</span></td>
                    <td><div class="invite-meta">@if($displayStatus === 'active')<span>加入于 {{ optional($member->accepted_at)->format('Y-m-d') ?: '—' }}</span>@else<span>发送 {{ $member->invitation_attempts }} 次</span><small>{{ $member->invitation_expires_at ? '有效至 '.$member->invitation_expires_at->format('Y-m-d H:i') : '—' }}</small>@endif</div></td>
                    <td>
                      @if($member->role === 'owner')
                        <span class="locked-action">所有者角色已锁定</span>
                      @elseif($canAdminister && $displayStatus === 'active')
                        <div class="member-actions">
                          <form method="post" action="{{ route('workspaces.members.update', [$current, $member]) }}">@csrf @method('patch')<select class="input compact" name="role">@foreach(['admin','editor','analyst','viewer'] as $role)<option value="{{ $role }}" @selected($member->role===$role)>{{ $roleLabels[$role] }}</option>@endforeach</select><button class="text-action">保存</button></form>
                          <form method="post" action="{{ route('workspaces.members.destroy', [$current, $member]) }}" onsubmit="return confirm('确定移除此成员？')">@csrf @method('delete')<button class="text-action danger">移除</button></form>
                        </div>
                      @elseif($canAdminister && in_array($displayStatus, ['invited','expired'], true))
                        <div class="member-actions invitation-actions">
                          <form method="post" action="{{ route('workspaces.invitations.resend', [$current, $member]) }}">@csrf<button class="text-action">重新发送</button></form>
                          <form method="post" action="{{ route('workspaces.invitations.revoke', [$current, $member]) }}" onsubmit="return confirm('确定撤销邀请？')">@csrf @method('delete')<button class="text-action danger">撤销</button></form>
                        </div>
                      @else<span class="locked-action">—</span>@endif
                    </td>
                  </tr>
                @endforeach
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside class="workspace-side-column">
        <section class="console-card permission-card">
          <span class="eyebrow-label">Role Matrix</span><h2>角色权限</h2>
          <div class="permission-list">
            <div><strong>所有者</strong><span>完整控制、套餐与成员管理</span></div>
            <div><strong>管理员</strong><span>资源和成员管理，不可转移所有权</span></div>
            <div><strong>编辑者</strong><span>创建、编辑和发布资源</span></div>
            <div><strong>分析员</strong><span>查看统计和导出数据</span></div>
            <div><strong>只读成员</strong><span>仅查看工作区内容</span></div>
          </div>
        </section>
        <section class="console-card lifecycle-card">
          <span class="eyebrow-label">Invitation Lifecycle</span><h2>邀请闭环</h2>
          <ol><li><b>1</b><span>发送邀请并记录邮件状态</span></li><li><b>2</b><span>7 天内由匹配邮箱接受</span></li><li><b>3</b><span>过期可重新发送，旧令牌失效</span></li><li><b>4</b><span>管理员可撤销，所有操作可追踪</span></li></ol>
        </section>
      </aside>
    </div>
  </div>

  <dialog id="create-workspace" class="console-dialog">
    <form method="post" action="{{ route('workspaces.store') }}">@csrf
      <div class="dialog-head"><div><span class="eyebrow-label">New Workspace</span><h2>创建工作区</h2></div><button type="button" onclick="this.closest('dialog').close()">×</button></div>
      <label>工作区名称<input class="input" name="name" placeholder="例如：GoJet 营销团队" required maxlength="120"></label>
      <p>创建后会自动切换到新工作区，并为你分配所有者角色。</p>
      <div class="dialog-actions"><button type="button" class="btn-secondary" onclick="this.closest('dialog').close()">取消</button><button class="btn-brand">创建并切换</button></div>
    </form>
  </dialog>
</x-layouts.app>
