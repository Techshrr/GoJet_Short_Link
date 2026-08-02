<x-layouts.marketing :title="__('pages.terms.title')">
  <section class="py-16 sm:py-24">
    <div class="mx-auto max-w-4xl px-5 lg:px-8">
      <div><p class="text-sm font-bold text-cyan-700">{{ __('pages.terms.title') }}</p><h1 class="mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">{{ __('pages.terms.headline') }}</h1><p class="mt-6 text-lg leading-8 text-slate-600">{{ __('pages.terms.intro') }}</p></div>
      <div class="prose-page mt-12 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        @foreach([
          ['account', __('pages.terms.account_title'), __('pages.terms.account_text')],
          ['prohibited', __('pages.terms.prohibited_title'), __('pages.terms.prohibited_text')],
          ['domains', __('pages.terms.domain_title'), __('pages.terms.domain_text')],
          ['enforcement', __('pages.terms.enforcement_title'), __('pages.terms.enforcement_text')],
          ['availability', __('pages.terms.availability_title'), __('pages.terms.availability_text')],
          ['liability', __('pages.terms.liability_title'), __('pages.terms.liability_text')],
        ] as $section)
          <section id="{{ $section[0] }}"><h2>{{ $section[1] }}</h2><p>{{ $section[2] }}</p></section>
        @endforeach
      </div>
    </div>
  </section>
</x-layouts.marketing>
