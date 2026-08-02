<x-layouts.app :title="__('ui.domains.title')">
  <section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div>
      <p class="page-kicker">{{ __('ui.domains.kicker') }}</p>
      <h1 class="page-title mt-1">{{ __('ui.domains.title') }}</h1>
      <p class="page-description">{{ __('ui.domains.description') }}</p>
    </div>

    <div class="mt-7 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form class="panel h-fit" method="post" action="{{ route('domains.store') }}">
        @csrf
        <div class="flex items-start gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-xl text-cyan-700">◎</span><div><h2 class="text-lg font-bold text-slate-950">{{ __('ui.domains.add_title') }}</h2><p class="mt-1 text-sm leading-6 text-slate-500">{{ __('ui.domains.dns_instruction') }}</p></div></div>
        <div class="mt-6"><label class="label" for="hostname">{{ __('ui.domains.hostname') }}</label><input class="input" id="hostname" name="hostname" value="{{ old('hostname') }}" placeholder="{{ __('ui.domains.hostname_placeholder') }}" required autocomplete="off"></div>
        <button class="btn-brand mt-4 w-full" type="submit">{{ __('ui.domains.add_button') }}</button>
      </form>

      <div class="space-y-4">
        @forelse($domains as $domain)
          <article class="card p-0">
            <div class="p-5 sm:p-6">
              <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2"><h2 class="truncate text-lg font-bold text-slate-950">{{ $domain->hostname }}</h2>@if($domain->is_default)<span class="badge-info">{{ __('ui.domains.default') }}</span>@endif</div>
                  <div class="mt-2">
                    @if(!$domain->verified_at)
                      <span class="badge-warning"><span class="h-1.5 w-1.5 rounded-full bg-current"></span>{{ __('ui.domains.waiting_dns') }}</span>
                    @elseif($domain->certificate_status === 'external')
                      <span class="badge-success">{{ __('ui.domains.external_certificate') }}</span>
                    @elseif($domain->certificate_status === 'active')
                      <span class="badge-success">{{ __('ui.domains.certificate_active') }}</span>
                    @elseif($domain->certificate_status === 'error')
                      <span class="badge-danger">{{ __('ui.domains.certificate_error') }}</span>
                    @else
                      <span class="badge-warning">{{ __('ui.domains.certificate_status', ['status' => $domain->certificate_status]) }}</span>
                    @endif
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  @if($domain->verified_at && !$domain->is_default && $domain->isUsable())
                    <form method="post" action="{{ route('domains.default', $domain) }}">@csrf @method('patch')<button class="btn-secondary !px-3 !py-2">{{ __('ui.domains.set_default') }}</button></form>
                  @endif
                  @if($domain->verified_at && filled($domain->cloudflare_hostname_id))
                    <form method="post" action="{{ route('domains.refresh', $domain) }}">@csrf<button class="btn-secondary !px-3 !py-2">{{ __('ui.domains.refresh_certificate') }}</button></form>
                  @endif
                  <form method="post" action="{{ route('domains.destroy', $domain) }}" onsubmit="return confirm(@js(__('ui.domains.delete_confirm')))">@csrf @method('delete')<button class="btn-danger !px-3 !py-2">{{ __('ui.common.delete') }}</button></form>
                </div>
              </div>

              @unless($domain->verified_at)
                <div class="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 text-sm">
                  <p class="font-medium text-cyan-900">{{ __('ui.domains.dns_instruction') }}</p>
                  <dl class="mt-4 grid gap-4 sm:grid-cols-2">
                    <div><dt class="text-xs font-semibold uppercase tracking-wide text-cyan-700">{{ __('ui.domains.record_name') }}</dt><dd class="mt-1 break-all rounded-xl border border-cyan-100 bg-white p-3 font-mono text-xs text-slate-800">{{ config('gojet.domain_verification_prefix') }}.{{ $domain->hostname }}</dd></div>
                    <div><dt class="text-xs font-semibold uppercase tracking-wide text-cyan-700">{{ __('ui.domains.record_value') }}</dt><dd class="mt-1 break-all rounded-xl border border-cyan-100 bg-white p-3 font-mono text-xs text-slate-800">{{ $domain->getRawOriginal('verification_token') }}</dd></div>
                  </dl>
                  <form class="mt-4" method="post" action="{{ route('domains.verify', $domain) }}">@csrf<button class="btn-primary">{{ __('ui.domains.verify_dns') }}</button></form>
                </div>
              @endunless

              @if($domain->provisioning_error)
                <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">{{ $domain->provisioning_error }}</div>
              @endif
            </div>
          </article>
        @empty
          <div class="empty-state"><div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">◎</div><p class="mt-4 font-semibold text-slate-700">{{ __('ui.domains.empty') }}</p></div>
        @endforelse
      </div>
    </div>
  </section>
</x-layouts.app>
