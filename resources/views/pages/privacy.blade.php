<x-layouts.marketing :title="__('pages.privacy.title')">
  <section class="py-16 sm:py-24">
    <div class="mx-auto max-w-4xl px-5 lg:px-8">
      <div><p class="text-sm font-bold text-cyan-700">{{ __('pages.privacy.title') }}</p><h1 class="mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">{{ __('pages.privacy.headline') }}</h1><p class="mt-6 text-lg leading-8 text-slate-600">{{ __('pages.privacy.intro') }}</p></div>
      <div class="prose-page mt-12 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        @foreach([
          ['information', __('pages.privacy.information_title'), __('pages.privacy.information_text')],
          ['ip', __('pages.privacy.ip_title'), __('pages.privacy.ip_text')],
          ['purpose', __('pages.privacy.purpose_title'), __('pages.privacy.purpose_text')],
          ['sharing', __('pages.privacy.sharing_title'), __('pages.privacy.sharing_text')],
          ['rights', __('pages.privacy.rights_title'), __('pages.privacy.rights_text')],
          ['security', __('pages.privacy.security_title'), __('pages.privacy.security_text')],
        ] as $section)
          <section id="{{ $section[0] }}"><h2>{{ $section[1] }}</h2><p>{{ $section[2] }}</p></section>
        @endforeach
      </div>
    </div>
  </section>
</x-layouts.marketing>
