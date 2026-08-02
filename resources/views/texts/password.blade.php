<x-layouts.marketing :title="__('v3.texts.unlock')">
  <section class="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-5 py-16">
    <div class="panel w-full text-center"><div class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-950 text-2xl text-white">🔒</div><h1 class="mt-5 text-2xl font-black text-slate-950">{{ __('v3.texts.unlock') }}</h1><p class="mt-2 text-sm text-slate-500">{{ $share->title ?: $share->slug }}</p><form class="mt-6 space-y-3" method="post" action="{{ route('texts.unlock',$share->slug) }}">@csrf<input class="input text-center" type="password" name="password" autocomplete="current-password" required autofocus><button class="btn-brand w-full py-3">{{ __('ui.auth.continue') }}</button></form></div>
  </section>
</x-layouts.marketing>
