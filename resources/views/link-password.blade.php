<x-layouts.marketing :title="__('shortlink.protected_title')">
  <section class="relative overflow-hidden py-16 sm:py-24">
    <div class="marketing-orb pointer-events-none absolute inset-0 opacity-55"></div>
    <div class="relative mx-auto max-w-md px-5">
      <div class="rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-2xl shadow-slate-200/60 sm:p-9">
        <div class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-indigo-50 text-2xl text-indigo-700">🔒</div>
        <h1 class="mt-6 text-2xl font-bold tracking-tight text-slate-950">{{ __('shortlink.protected_title') }}</h1>
        <p class="mt-3 text-sm leading-6 text-slate-500">{{ __('shortlink.protected_text') }}</p>
        <form class="mt-7" method="post" action="{{ route('links.unlock', $link->slug) }}">
          @csrf
          <label class="label text-left" for="password">{{ __('shortlink.password') }}</label>
          <input class="input text-center" id="password" type="password" name="password" required autofocus autocomplete="current-password">
          <button class="btn-brand mt-4 w-full py-3" type="submit">{{ __('shortlink.continue') }} →</button>
        </form>
      </div>
    </div>
  </section>
</x-layouts.marketing>
