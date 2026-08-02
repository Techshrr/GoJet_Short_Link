<x-layouts.marketing :title="__('v3.public.pricing')">
  <section class="overflow-hidden bg-gradient-to-b from-cyan-50 via-white to-white px-5 py-20 text-center lg:px-8 lg:py-28">
    <div class="mx-auto max-w-4xl">
      <p class="page-kicker">{{ __('v3.public.pricing') }}</p>
      <h1 class="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">{{ __('v3.plans.title') }}</h1>
      <p class="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">{{ __('v3.plans.subtitle') }}</p>
    </div>
  </section>

  <section class="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
    @if($plansUnavailable ?? false)
      <div class="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">套餐数据暂时无法读取。系统没有展示缓存价格或虚构价格，请稍后重试或联系支持。</div>
    @endif
    <div class="grid gap-6 lg:grid-cols-3">
      @forelse($plans as $plan)
        <article class="relative rounded-[2rem] border {{ $loop->iteration === 2 ? 'border-cyan-300 ring-4 ring-cyan-100' : 'border-slate-200' }} bg-white p-7 shadow-sm">
          <h2 class="text-2xl font-black text-slate-950">{{ $plan->name }}</h2>
          <p class="mt-3 min-h-14 text-sm leading-6 text-slate-500">{{ $plan->description }}</p>

          <div class="mt-7 flex items-end gap-2">
            <strong class="text-4xl font-black">
              {{ $plan->monthly_price == 0 ? __('v3.plans.free') : $plan->currency.' '.$plan->monthly_price }}
            </strong>
            @if($plan->monthly_price > 0)
              <span class="pb-1 text-slate-400">/ {{ __('v3.plans.monthly') }}</span>
            @endif
          </div>

          <p class="mt-2 text-sm text-slate-400">
            {{ $plan->yearly_price > 0 ? $plan->currency.' '.$plan->yearly_price.' / '.__('v3.plans.yearly') : '' }}
          </p>

          <a class="btn-brand mt-7 w-full py-3" href="{{ auth()->check() ? route('plans.index') : route('register') }}">{{ __('v3.public.start') }}</a>

          <div class="mt-7 space-y-3 border-t border-slate-100 pt-6">
            @foreach(($plan->limits ?? []) as $key => $limit)
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="text-slate-600">{{ __('v3.resource_'.$key) }}</span>
                <strong>{{ number_format($limit) }}</strong>
              </div>
            @endforeach

            @foreach(($plan->features ?? []) as $feature)
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <span class="text-emerald-500">✓</span>
                {{ str_replace('_', ' ', \Illuminate\Support\Str::headline($feature)) }}
              </div>
            @endforeach
          </div>
        </article>
      @empty
        @unless($plansUnavailable ?? false)
          <div class="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 lg:col-span-3">当前没有公开套餐。管理员可以在后台配置并发布套餐。</div>
        @endunless
      @endforelse
    </div>
  </section>
</x-layouts.marketing>
