<x-layouts.marketing :title="__('pages.about.title')">
  <section class="relative overflow-hidden py-16 sm:py-24">
    <div class="marketing-orb pointer-events-none absolute inset-0 opacity-45"></div>
    <div class="relative mx-auto max-w-6xl px-5 lg:px-8">
      <div class="max-w-3xl"><p class="text-sm font-bold text-cyan-700">{{ __('pages.about.title') }}</p><h1 class="mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-6xl">{{ __('pages.about.headline') }}</h1><p class="mt-6 text-lg leading-8 text-slate-600">{{ __('pages.about.intro') }}</p></div>
      <div class="mt-12 grid gap-5 md:grid-cols-2">
        @foreach([
          ['↗', 'bg-cyan-50 text-cyan-700', __('pages.about.ownership_title'), __('pages.about.ownership_text')],
          ['◉', 'bg-indigo-50 text-indigo-700', __('pages.about.privacy_title'), __('pages.about.privacy_text')],
          ['⊘', 'bg-rose-50 text-rose-700', __('pages.about.safety_title'), __('pages.about.safety_text')],
          ['◇', 'bg-emerald-50 text-emerald-700', __('pages.about.independent_title'), __('pages.about.independent_text')],
        ] as $item)
          <article class="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"><span class="grid h-12 w-12 place-items-center rounded-2xl text-xl {{ $item[1] }}">{{ $item[0] }}</span><h2 class="mt-5 text-xl font-bold text-slate-950">{{ $item[2] }}</h2><p class="mt-3 leading-7 text-slate-600">{{ $item[3] }}</p></article>
        @endforeach
      </div>
    </div>
  </section>
</x-layouts.marketing>
