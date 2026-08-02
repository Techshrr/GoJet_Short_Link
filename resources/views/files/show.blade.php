<x-layouts.marketing :title="$share->original_name">
  <section class="mx-auto grid min-h-[68vh] max-w-3xl place-items-center px-5 py-14 lg:px-8">
    <div class="panel w-full text-center">
      <div class="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-4xl text-white shadow-xl shadow-cyan-500/20">⇩</div>
      <h1 class="mt-6 break-all text-2xl font-black text-slate-950 sm:text-4xl">{{ $share->original_name }}</h1>
      <div class="mt-4 flex flex-wrap justify-center gap-2"><span class="badge-neutral">{{ Number::fileSize($share->size_bytes) }}</span><span class="badge-info">{{ $share->visibility }}</span><span class="{{ $share->scan_status==='blocked' ? 'badge-danger':'badge-success' }}">{{ $share->scan_status }}</span></div>
      @if($share->password_hash && !session('gojet.file_access.'.$share->id))
        <p class="mt-6 text-sm text-slate-500">{{ __('v3.texts.unlock') }}</p><form class="mx-auto mt-4 max-w-md space-y-3" method="post" action="{{ route('files.unlock',$share->slug) }}">@csrf<input class="input text-center" type="password" name="password" required autofocus><button class="btn-brand w-full py-3">{{ __('ui.auth.continue') }}</button></form>
      @else
        <dl class="mx-auto mt-7 grid max-w-lg gap-3 rounded-2xl bg-slate-50 p-5 text-left text-sm sm:grid-cols-2"><div><dt class="text-slate-400">{{ __('v3.files.downloads',['count'=>'']) }}</dt><dd class="mt-1 font-bold text-slate-900">{{ number_format($share->downloads_count) }}@if($share->max_downloads) / {{ number_format($share->max_downloads) }}@endif</dd></div><div><dt class="text-slate-400">{{ __('v3.files.expires_at') }}</dt><dd class="mt-1 font-bold text-slate-900">{{ $share->expires_at?->toDayDateTimeString() ?? __('v3.common.none') }}</dd></div></dl>
        <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><a class="btn-brand px-8 py-3" href="{{ route('files.download',$share->slug) }}">↓ {{ __('v3.files.download') }}</a>@if(str_starts_with((string)$share->mime_type,'image/') || $share->mime_type==='application/pdf' || str_starts_with((string)$share->mime_type,'text/'))<a class="btn-secondary px-8 py-3" href="{{ route('files.download',['slug'=>$share->slug,'inline'=>1]) }}" target="_blank">{{ __('v3.files.inline') }}</a>@endif</div>
      @endif
      <p class="mt-7 text-xs text-slate-400">SHA-256 · {{ substr($share->sha256,0,20) }}…</p>
    </div>
  </section>
</x-layouts.marketing>
