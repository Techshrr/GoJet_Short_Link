<x-layouts.marketing :title="$mode === 'forgot' ? __('ui.access.forgot_title') : ($mode === 'reset' ? __('ui.access.reset_title') : __('ui.access.verification_title'))">
  <section class="relative overflow-hidden py-16 sm:py-24">
    <div class="marketing-orb pointer-events-none absolute inset-0 opacity-60"></div>
    <div class="relative mx-auto max-w-lg px-5">
      <div class="rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl shadow-slate-200/60 sm:p-10">
        @if($mode === 'forgot')
          <p class="text-sm font-semibold text-cyan-700">{{ __('ui.access.recovery') }}</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950">{{ __('ui.access.forgot_title') }}</h1>
          <p class="mt-3 text-sm leading-6 text-slate-500">{{ __('ui.access.forgot_description') }}</p>
          <form class="mt-7 space-y-5" method="post" action="{{ route('password.email') }}">
            @csrf
            <div><label class="label" for="email">{{ __('ui.auth.email') }}</label><input class="input" id="email" type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="email"></div>
            <x-turnstile action="password-reset" />
            <button class="btn-brand w-full py-3">{{ __('ui.access.send_reset') }}</button>
          </form>
        @elseif($mode === 'reset')
          <p class="text-sm font-semibold text-cyan-700">{{ __('ui.access.recovery') }}</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950">{{ __('ui.access.reset_title') }}</h1>
          <form class="mt-7 space-y-5" method="post" action="{{ route('password.update') }}">
            @csrf
            <input type="hidden" name="token" value="{{ $token }}">
            <div><label class="label" for="email">{{ __('ui.auth.email') }}</label><input class="input" id="email" type="email" name="email" value="{{ old('email', $email) }}" required autocomplete="email"></div>
            <div><label class="label" for="password">{{ __('ui.access.new_password') }}</label><input class="input" id="password" type="password" name="password" required autocomplete="new-password"><p class="help">{{ __('ui.auth.password_hint') }}</p></div>
            <div><label class="label" for="password_confirmation">{{ __('ui.auth.password_confirmation') }}</label><input class="input" id="password_confirmation" type="password" name="password_confirmation" required autocomplete="new-password"></div>
            <button class="btn-brand w-full py-3">{{ __('ui.access.update_password') }}</button>
          </form>
        @else
          <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-2xl text-cyan-700">✉</div>
          <div class="text-center"><p class="mt-5 text-sm font-semibold text-cyan-700">{{ __('ui.access.verification_kicker') }}</p><h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950">{{ __('ui.access.verification_title') }}</h1><p class="mt-3 text-sm leading-6 text-slate-500">{{ __('ui.access.verification_description') }}</p></div>
          <form class="mt-7" method="post" action="{{ route('verification.send') }}">@csrf<button class="btn-secondary w-full py-3">{{ __('ui.access.resend_verification') }}</button></form>
        @endif
        <a class="mt-6 flex justify-center text-sm font-semibold text-slate-500 hover:text-slate-950" href="{{ route('login') }}">← {{ __('ui.auth.login_link') }}</a>
      </div>
    </div>
  </section>
</x-layouts.marketing>
