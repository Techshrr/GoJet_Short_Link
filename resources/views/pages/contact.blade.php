<x-layouts.marketing :title="__('pages.contact.title')">
  <section class="relative overflow-hidden py-16 sm:py-24">
    <div class="marketing-orb pointer-events-none absolute inset-0 opacity-45"></div>
    <div class="relative mx-auto max-w-5xl px-5 lg:px-8">
      <div class="mx-auto max-w-3xl text-center"><p class="text-sm font-bold text-cyan-700">{{ __('pages.contact.title') }}</p><h1 class="mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">{{ __('pages.contact.headline') }}</h1><p class="mt-5 text-lg leading-8 text-slate-600">{{ __('pages.contact.intro') }}</p></div>
      <div class="mt-12 grid gap-6 md:grid-cols-2">
        <article class="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><span class="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-xl text-cyan-700">✉</span><h2 class="mt-5 text-xl font-bold text-slate-950">{{ __('pages.contact.support_title') }}</h2><p class="mt-3 leading-7 text-slate-600">{{ __('pages.contact.support_text') }}</p><div class="mt-5 rounded-2xl bg-slate-50 p-4"><p class="text-xs font-bold uppercase tracking-wide text-slate-400">{{ __('pages.contact.support_email') }}</p><a class="mt-2 block break-all font-semibold text-cyan-700 hover:text-cyan-900" href="mailto:{{ config('gojet.support_email') }}">{{ config('gojet.support_email') }}</a></div></article>
        <article class="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><span class="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-xl text-rose-700">⊘</span><h2 class="mt-5 text-xl font-bold text-slate-950">{{ __('pages.contact.safety_title') }}</h2><p class="mt-3 leading-7 text-slate-600">{{ __('pages.contact.safety_text') }}</p><a class="btn-danger mt-5" href="{{ route('report.create') }}">{{ __('pages.contact.report_button') }} →</a></article>
      </div>
    </div>
  </section>
</x-layouts.marketing>
