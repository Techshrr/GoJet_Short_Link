<x-layouts.marketing :title="$mode === 'login' ? __('ui.auth.login_title') : __('ui.auth.register_title')">
  <section class="relative overflow-hidden py-16 sm:py-24">
    <div class="marketing-orb pointer-events-none absolute inset-0 opacity-70"></div>
    <div class="relative mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[1fr_440px] lg:px-8">
      <div class="hidden lg:block">
        <span class="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">{{ __('ui.auth.account') }}</span>
        <h1 class="mt-6 max-w-xl text-5xl font-bold tracking-[-0.045em] text-slate-950">{{ $mode === 'login' ? __('ui.auth.login_title') : __('ui.auth.register_title') }}</h1>
        <p class="mt-5 max-w-xl text-lg leading-8 text-slate-600">{{ $mode === 'login' ? __('ui.auth.login_description') : __('ui.auth.register_description') }}</p>
        <div class="mt-10 grid max-w-xl gap-4 sm:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm"><div class="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700">↗</div><p class="mt-4 font-semibold text-slate-900">{{ __('ui.home.feature_links') }}</p><p class="mt-2 text-sm leading-6 text-slate-500">{{ __('ui.home.feature_links_text') }}</p></div>
          <div class="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm"><div class="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">◎</div><p class="mt-4 font-semibold text-slate-900">{{ __('ui.home.feature_analytics') }}</p><p class="mt-2 text-sm leading-6 text-slate-500">{{ __('ui.home.feature_analytics_text') }}</p></div>
        </div>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/60 sm:p-9">
        <div class="lg:hidden"><p class="text-sm font-semibold text-cyan-700">{{ __('ui.auth.account') }}</p><h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950">{{ $mode === 'login' ? __('ui.auth.login_title') : __('ui.auth.register_title') }}</h1><p class="mt-2 text-sm leading-6 text-slate-500">{{ $mode === 'login' ? __('ui.auth.login_description') : __('ui.auth.register_description') }}</p></div>

        <form class="mt-7 space-y-5 lg:mt-0" method="post" action="{{ $mode === 'login' ? route('login') : route('register') }}">
          @csrf
          @if($mode === 'register')
            <div><label class="label" for="name">{{ __('ui.auth.name') }}</label><input class="input" id="name" name="name" value="{{ old('name') }}" required autocomplete="name" autofocus></div>
          @endif
          <div><label class="label" for="email">{{ __('ui.auth.email') }}</label><input class="input" id="email" type="email" name="email" value="{{ old('email') }}" required autocomplete="email" @if($mode === 'login') autofocus @endif></div>
          <div><label class="label" for="password">{{ __('ui.auth.password') }}</label><input class="input" id="password" type="password" name="password" required autocomplete="{{ $mode === 'login' ? 'current-password' : 'new-password' }}">@if($mode === 'register')<p class="help">{{ __('ui.auth.password_hint') }}</p>@endif</div>
          @if($mode === 'register')
            <div><label class="label" for="password_confirmation">{{ __('ui.auth.password_confirmation') }}</label><input class="input" id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password"></div>
          @endif
          @if($mode === 'login')
            <div class="flex items-center justify-between gap-4"><label class="flex items-center gap-2 text-sm text-slate-600"><input class="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400" type="checkbox" name="remember" value="1"> {{ __('ui.auth.remember') }}</label><a class="text-sm font-semibold text-cyan-700 hover:text-cyan-900" href="{{ route('password.request') }}">{{ __('ui.auth.forgot') }}</a></div>
          @endif
          <x-turnstile :action="$mode === 'login' ? 'login' : 'register'" />
          <button class="btn-brand w-full py-3" type="submit">{{ $mode === 'login' ? __('ui.auth.sign_in') : __('ui.auth.create_account') }}</button>
        </form>

        <div class="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
          @if($mode === 'login' && config('gojet.allow_registration'))
            {{ __('ui.auth.new_to_gojet') }} <a class="font-semibold text-slate-950 hover:text-cyan-700" href="{{ route('register') }}">{{ __('ui.auth.register_link') }}</a>
          @elseif($mode === 'register')
            {{ __('ui.auth.already_registered') }} <a class="font-semibold text-slate-950 hover:text-cyan-700" href="{{ route('login') }}">{{ __('ui.auth.login_link') }}</a>
          @endif
        </div>
      </div>
    </div>
  </section>
</x-layouts.marketing>
