<x-layouts.marketing :title="__('ui.report.title')">
  <section class="relative overflow-hidden py-16 sm:py-24">
    <div class="marketing-orb pointer-events-none absolute inset-0 opacity-50"></div>
    <div class="relative mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_520px] lg:items-start lg:px-8">
      <div class="pt-4">
        <span class="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{{ __('ui.report.kicker') }}</span>
        <h1 class="mt-6 max-w-xl text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">{{ __('ui.report.title') }}</h1>
        <p class="mt-5 max-w-xl text-lg leading-8 text-slate-600">{{ __('ui.report.description') }}</p>
        <div class="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <p class="font-bold text-slate-900">GoJet Trust &amp; Safety</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">{{ __('ui.home.security_text') }}</p>
        </div>
      </div>

      <form class="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/60 sm:p-9" method="post" action="{{ route('report.store') }}">
        @csrf
        <div class="space-y-5">
          <div><label class="label" for="short_url">{{ __('ui.report.short_url') }}</label><input class="input" id="short_url" type="url" name="short_url" value="{{ old('short_url', $slug ? url('/'.$slug) : '') }}" placeholder="https://go.example/abc123" required></div>
          <div><label class="label" for="reporter_email">{{ __('ui.report.email') }}</label><input class="input" id="reporter_email" type="email" name="reporter_email" value="{{ old('reporter_email') }}" required autocomplete="email"></div>
          <div><label class="label" for="reason">{{ __('ui.report.reason') }}</label><select class="input" id="reason" name="reason" required>@foreach(['phishing', 'malware', 'spam', 'impersonation', 'illegal', 'other'] as $reason)<option value="{{ $reason }}" @selected(old('reason') === $reason)>{{ __('report.'.$reason) }}</option>@endforeach</select></div>
          <div><label class="label" for="details">{{ __('ui.report.details') }}</label><textarea class="input min-h-40 resize-y" id="details" name="details" minlength="20" maxlength="5000" required>{{ old('details') }}</textarea></div>
          <button class="btn-primary w-full py-3" type="submit">{{ __('ui.report.submit') }}</button>
        </div>
      </form>
    </div>
  </section>
</x-layouts.marketing>
