<x-layouts.app :title="__('v3.texts.title')">
  <section class="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10" x-data="{ createOpen: false }">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="page-kicker">{{ $workspace->name }}</p>
        <h1 class="page-title mt-1">{{ __('v3.texts.title') }}</h1>
        <p class="page-description">{{ __('v3.texts.subtitle') }}</p>
      </div>
      <button class="btn-brand" type="button" @click="createOpen = ! createOpen">＋ {{ __('v3.texts.new') }}</button>
    </div>

    <div x-cloak x-show="createOpen" class="panel mt-6" x-transition>
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold">{{ __('v3.texts.new') }}</h2>
        <button class="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-xl" type="button" @click="createOpen = false">×</button>
      </div>

      <form class="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]" method="post" action="{{ route('texts.store') }}">
        @csrf
        <div class="space-y-4">
          <div>
            <label class="label" for="text-title">{{ __('v3.links.title_field') }}</label>
            <input class="input" id="text-title" name="title" value="{{ old('title') }}">
          </div>
          <div>
            <label class="label" for="text-content">{{ __('v3.texts.content') }}</label>
            <textarea class="input min-h-[360px] font-mono text-sm" id="text-content" name="content" required>{{ old('content') }}</textarea>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label" for="text-slug">{{ __('v3.links.slug') }}</label>
            <input class="input" id="text-slug" name="slug" value="{{ old('slug') }}" placeholder="{{ __('v3.common.optional') }}">
          </div>
          <div>
            <label class="label" for="text-format">{{ __('v3.texts.format') }}</label>
            <select class="input" id="text-format" name="format">
              <option value="plain" @selected(old('format') === 'plain')>Plain text</option>
              <option value="markdown" @selected(old('format') === 'markdown')>Markdown</option>
              <option value="code" @selected(old('format') === 'code')>Code</option>
            </select>
          </div>
          <div>
            <label class="label" for="syntax-language">{{ __('v3.texts.syntax') }}</label>
            <input class="input" id="syntax-language" name="syntax_language" value="{{ old('syntax_language') }}" placeholder="php, javascript, nginx">
          </div>
          <div>
            <label class="label" for="text-visibility">{{ __('v3.texts.visibility') }}</label>
            <select class="input" id="text-visibility" name="visibility">
              @foreach(['unlisted', 'public', 'private'] as $visibility)
                <option value="{{ $visibility }}" @selected(old('visibility', 'unlisted') === $visibility)>{{ __('v3.texts.'.$visibility) }}</option>
              @endforeach
            </select>
          </div>
          <div>
            <label class="label" for="text-password">{{ __('v3.texts.password') }}</label>
            <input class="input" id="text-password" type="password" name="password">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label" for="text-expires">{{ __('v3.texts.expires_at') }}</label>
              <input class="input" id="text-expires" type="datetime-local" name="expires_at" value="{{ old('expires_at') }}">
            </div>
            <div>
              <label class="label" for="text-max-views">{{ __('v3.texts.max_views') }}</label>
              <input class="input" id="text-max-views" type="number" min="1" name="max_views" value="{{ old('max_views') }}">
            </div>
          </div>
          <label class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input class="mt-1" type="checkbox" name="burn_after_read" value="1" @checked(old('burn_after_read'))>
            <span>{{ __('v3.texts.burn') }}</span>
          </label>
          <button class="btn-brand w-full py-3" type="submit">{{ __('v3.common.create') }}</button>
        </div>
      </form>
    </div>

    <form class="panel mt-6 flex flex-col gap-3 sm:flex-row" method="get">
      <input class="input flex-1" name="q" value="{{ request('q') }}" placeholder="{{ __('v3.common.search') }}">
      <button class="btn-primary" type="submit">{{ __('v3.common.search') }}</button>
      <a class="btn-secondary" href="{{ route('texts.index') }}">{{ __('v3.common.clear') }}</a>
    </form>

    <div class="mt-6 grid gap-4 lg:grid-cols-2">
      @forelse($shares as $share)
        <article class="card p-5">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2">
                <span class="badge-neutral">{{ $share->format }}</span>
                <span class="{{ $share->visibility === 'private' ? 'badge-danger' : ($share->visibility === 'public' ? 'badge-success' : 'badge-info') }}">{{ __('v3.texts.'.$share->visibility) }}</span>
                @if($share->password_hash)
                  <span class="badge-info">🔒</span>
                @endif
                @if($share->burn_after_read)
                  <span class="badge-warning">🔥</span>
                @endif
              </div>
              <h2 class="mt-3 truncate text-lg font-bold text-slate-950">{{ $share->title ?: $share->slug }}</h2>
              <a class="mt-1 block truncate text-sm font-semibold text-cyan-700" href="{{ route('texts.public', $share->slug) }}" target="_blank" rel="noopener">{{ route('texts.public', $share->slug) }}</a>
            </div>
            <div class="rounded-xl bg-slate-50 px-4 py-2 text-center">
              <strong class="text-xl text-slate-950">{{ number_format($share->views_count) }}</strong>
              <p class="text-[10px] uppercase text-slate-400">Views</p>
            </div>
          </div>

          <p class="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-500">{{ \Illuminate\Support\Str::limit($share->content, 260) }}</p>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span class="text-xs text-slate-400">
              {{ $share->created_at->diffForHumans() }}
              @if($share->expires_at)
                · {{ $share->expires_at->diffForHumans() }}
              @endif
            </span>
            <div class="flex gap-2">
              <a class="btn-secondary !px-3 !py-2" href="{{ route('texts.edit', $share) }}">{{ __('v3.common.edit') }}</a>
              <a class="btn-secondary !px-3 !py-2" href="{{ route('texts.public', $share->slug) }}" target="_blank" rel="noopener">↗</a>
              <form method="post" action="{{ route('texts.destroy', $share) }}" onsubmit="return confirm(@js(__('v3.common.confirm_delete'))) ">
                @csrf
                @method('delete')
                <button class="btn-danger !px-3 !py-2" type="submit">{{ __('v3.common.delete') }}</button>
              </form>
            </div>
          </div>
        </article>
      @empty
        <div class="empty-state lg:col-span-2">{{ __('v3.texts.empty') }}</div>
      @endforelse
    </div>

    @if($shares->hasPages())
      <div class="mt-6">{{ $shares->links() }}</div>
    @endif
  </section>
</x-layouts.app>
