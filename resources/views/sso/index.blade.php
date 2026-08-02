<x-layouts.app :title="__('v3.sso_title')">
  <section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <p class="page-kicker">{{ $workspace->name }}</p>
    <h1 class="page-title mt-1">{{ __('v3.sso_title') }}</h1>
    <p class="page-description">{{ __('v3.sso_subtitle') }}</p>

    <div class="mt-7 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form class="panel h-fit" method="post" action="{{ route('sso.store') }}">
        @csrf
        <h2 class="text-lg font-bold text-slate-950">{{ __('v3.sso_new') }}</h2>
        <div class="mt-5 space-y-4">
          <div>
            <label class="label" for="sso-name">{{ __('v3.sso_name') }}</label>
            <input class="input" id="sso-name" name="name" value="{{ old('name') }}" required>
          </div>
          <input type="hidden" name="provider" value="oidc">
          <div>
            <label class="label" for="sso-issuer">{{ __('v3.sso_issuer') }}</label>
            <input class="input" id="sso-issuer" type="url" name="issuer" value="{{ old('issuer') }}" placeholder="https://id.example.com" required>
          </div>
          <div>
            <label class="label" for="sso-client-id">{{ __('v3.sso_client_id') }}</label>
            <input class="input" id="sso-client-id" name="client_id" value="{{ old('client_id') }}" required>
          </div>
          <div>
            <label class="label" for="sso-client-secret">{{ __('v3.sso_client_secret') }}</label>
            <input class="input" id="sso-client-secret" type="password" name="client_secret" required autocomplete="new-password">
          </div>
          <div>
            <label class="label" for="sso-scopes">{{ __('v3.sso_scopes') }}</label>
            <input class="input" id="sso-scopes" name="scopes" value="{{ old('scopes', 'openid profile email') }}">
          </div>
          <div>
            <label class="label" for="sso-domains">{{ __('v3.sso_domains') }}</label>
            <textarea class="input min-h-24" id="sso-domains" name="domains" placeholder="example.com, company.com">{{ old('domains') }}</textarea>
          </div>
          <label class="flex items-center gap-3 text-sm text-slate-600">
            <input type="checkbox" name="enforce_for_members" value="1" @checked(old('enforce_for_members'))>
            {{ __('v3.sso_enforce') }}
          </label>
          <button class="btn-brand w-full" type="submit">{{ __('v3.common.create') }}</button>
        </div>
      </form>

      <div class="space-y-4">
        @forelse($connections as $connection)
          @php($configuration = $connection->configuration())
          <article class="card">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="{{ $connection->is_enabled ? 'badge-success' : 'badge-neutral' }}">{{ $connection->is_enabled ? __('v3.common.active') : __('v3.common.disabled') }}</span>
                  <span class="badge-info">OIDC + PKCE</span>
                </div>
                <h2 class="mt-3 text-lg font-bold text-slate-950">{{ $connection->name }}</h2>
                <p class="mt-1 break-all text-sm text-slate-500">{{ $configuration['issuer'] ?? '' }}</p>
                <p class="mt-2 text-xs text-slate-400">{{ implode(', ', $connection->domains ?? []) ?: __('v3.sso_all_domains') }}</p>
              </div>
              <a class="btn-secondary" href="{{ route('sso.redirect', $connection) }}">{{ __('v3.sso_test_login') }} ↗</a>
            </div>

            <form class="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2" method="post" action="{{ route('sso.update', $connection) }}">
              @csrf
              @method('patch')
              <input class="input" name="name" value="{{ $connection->name }}" required>
              <input class="input" type="url" name="issuer" value="{{ $configuration['issuer'] ?? '' }}" required>
              <input class="input" name="client_id" value="{{ $configuration['client_id'] ?? '' }}" required>
              <input class="input" type="password" name="client_secret" placeholder="{{ __('v3.sso_secret_unchanged') }}">
              <input class="input" name="scopes" value="{{ implode(' ', $configuration['scopes'] ?? []) }}">
              <input class="input" name="domains" value="{{ implode(', ', $connection->domains ?? []) }}">
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_enabled" value="1" @checked($connection->is_enabled)> {{ __('v3.common.active') }}</label>
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="enforce_for_members" value="1" @checked($connection->enforce_for_members)> {{ __('v3.sso_enforce') }}</label>
              <button class="btn-primary sm:col-span-2" type="submit">{{ __('v3.common.save') }}</button>
            </form>

            <form class="mt-3" method="post" action="{{ route('sso.destroy', $connection) }}" onsubmit="return confirm(@js(__('v3.common.confirm_delete'))) ">
              @csrf
              @method('delete')
              <button class="btn-danger" type="submit">{{ __('v3.common.delete') }}</button>
            </form>
          </article>
        @empty
          <div class="empty-state">{{ __('v3.sso_empty') }}</div>
        @endforelse
      </div>
    </div>
  </section>
</x-layouts.app>
