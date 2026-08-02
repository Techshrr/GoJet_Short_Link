<x-layouts.app :title="__('v3.plans.title')">
  <section class="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div>
      <p class="page-kicker">{{ $workspace->name }}</p>
      <h1 class="page-title mt-1">{{ __('v3.plans.title') }}</h1>
      <p class="page-description">{{ __('v3.plans.subtitle') }}</p>
    </div>

    @if(session('status'))
      <div class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
        {{ session('status') }}
      </div>
    @endif

    @if($errors->any())
      <div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
        <ul class="list-disc space-y-1 pl-5">
          @foreach($errors->all() as $error)
            <li>{{ $error }}</li>
          @endforeach
        </ul>
      </div>
    @endif

    <div class="mt-7 rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">{{ __('v3.plans.current') }}</p>
          <h2 class="mt-2 text-3xl font-black">{{ $currentPlan?->name ?? $workspace->plan_code }}</h2>
          <p class="mt-2 text-sm text-slate-400">{{ $currentPlan?->description }}</p>
        </div>
        <a class="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950" href="{{ route('pricing') }}" target="_blank">
          {{ __('v3.public.pricing') }} ↗
        </a>
      </div>
    </div>

    <div class="mt-7 grid gap-5 lg:grid-cols-3">
      @foreach($plans as $plan)
        <article class="card relative overflow-hidden p-6 {{ $currentPlan?->id === $plan->id ? 'border-cyan-300 ring-2 ring-cyan-100' : '' }}">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-black text-slate-950">{{ $plan->name }}</h2>
              <p class="mt-2 min-h-12 text-sm leading-6 text-slate-500">{{ $plan->description }}</p>
            </div>
            @if($currentPlan?->id === $plan->id)
              <span class="badge-success">{{ __('v3.plans.current') }}</span>
            @endif
          </div>

          <div class="mt-6 flex items-end gap-2">
            <strong class="text-4xl font-black text-slate-950">
              {{ $plan->monthly_price == 0 ? __('v3.plans.free') : $plan->currency.' '.$plan->monthly_price }}
            </strong>
            @if($plan->monthly_price > 0)
              <span class="pb-1 text-sm text-slate-400">/ {{ __('v3.plans.monthly') }}</span>
            @endif
          </div>

          <div class="mt-6 space-y-2 text-sm text-slate-600">
            @foreach(($plan->limits ?? []) as $key => $limit)
              <div class="flex justify-between gap-3">
                <span>{{ __('v3.resource_'.$key) }}</span>
                <strong>{{ number_format($limit) }}</strong>
              </div>
            @endforeach
          </div>

          @unless($currentPlan?->id === $plan->id)
            <form class="mt-6 space-y-3" method="post" action="{{ route('plans.request') }}">
              @csrf
              <input type="hidden" name="plan_id" value="{{ $plan->id }}">
              <select class="input" name="interval">
                <option value="monthly">{{ __('v3.plans.monthly') }} · {{ $plan->currency }} {{ $plan->monthly_price }}</option>
                <option value="yearly">{{ __('v3.plans.yearly') }} · {{ $plan->currency }} {{ $plan->yearly_price }}</option>
              </select>
              @if($plan->code !== 'free')
                <input class="input uppercase" name="coupon_code" maxlength="80" placeholder="{{ __('billing.coupon_code') }}">
              @endif
              <button class="btn-brand w-full">{{ __('v3.plans.request') }}</button>
            </form>
          @endunless
        </article>
      @endforeach
    </div>

    <section class="panel mt-7">
      <h2 class="text-xl font-bold text-slate-950">{{ __('v3.workspaces.usage') }}</h2>
      <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        @foreach($usage as $resource => $quota)
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="flex justify-between gap-3">
              <span class="text-sm font-semibold text-slate-600">{{ __('v3.resource_'.$resource) }}</span>
              <strong>{{ number_format($quota['used']) }} / {{ $quota['limit'] ?: '∞' }}</strong>
            </div>
            @if($quota['limit'])
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div class="h-full bg-gradient-to-r from-cyan-500 to-indigo-600" style="width:{{ min(100, ($quota['used'] / $quota['limit']) * 100) }}%"></div>
              </div>
            @endif
          </div>
        @endforeach
      </div>
    </section>

    <div class="mt-7 grid gap-6 xl:grid-cols-2">
      <section class="panel">
        <h2 class="text-xl font-bold text-slate-950">{{ __('billing.subscriptions') }}</h2>
        <div class="mt-5 space-y-3">
          @forelse($subscriptions as $subscription)
            <article class="rounded-2xl border border-slate-200 p-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <strong>{{ $subscription->plan->name }}</strong>
                  <p class="mt-1 text-xs text-slate-400">
                    {{ ucfirst($subscription->interval) }} · {{ $subscription->provider }}
                    @if($subscription->coupon)
                      · {{ __('billing.coupon') }} {{ $subscription->coupon->code }}
                    @endif
                  </p>
                </div>
                <span class="{{ $subscription->status === 'active' ? 'badge-success' : ($subscription->status === 'pending' ? 'badge-warning' : 'badge-neutral') }}">
                  {{ $subscription->status }}
                </span>
              </div>

              @if(in_array($subscription->status, ['active', 'pending'], true))
                <form class="mt-4" method="post" action="{{ route('subscriptions.cancel', $subscription) }}" onsubmit="return confirm(@js(__('v3.common.confirm_delete'))) ">
                  @csrf
                  <button class="btn-danger w-full">{{ __('v3.plans.cancel') }}</button>
                </form>
              @endif
            </article>
          @empty
            <div class="empty-state !py-10">{{ __('v3.common.none') }}</div>
          @endforelse
        </div>
      </section>

      <section class="panel">
        <h2 class="text-xl font-bold text-slate-950">{{ __('billing.invoices') }}</h2>
        <div class="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          @forelse($invoices as $invoice)
            <a class="flex flex-col gap-3 border-b border-slate-100 p-4 transition hover:bg-slate-50 last:border-0 sm:flex-row sm:items-center sm:justify-between" href="{{ route('plans.invoice', $invoice) }}">
              <div>
                <strong>{{ $invoice->number }}</strong>
                <p class="mt-1 text-xs text-slate-400">{{ $invoice->issued_at?->toDateString() }} · {{ $invoice->due_at?->toDateString() }}</p>
              </div>
              <div class="sm:text-right">
                <strong>{{ $invoice->currency }} {{ number_format((float) $invoice->total, 2) }}</strong>
                @if((float) $invoice->discount > 0)
                  <p class="mt-1 text-xs text-emerald-600">− {{ $invoice->currency }} {{ number_format((float) $invoice->discount, 2) }}</p>
                @endif
                <p class="mt-1">
                  <span class="{{ $invoice->status === 'paid' ? 'badge-success' : 'badge-warning' }}">{{ $invoice->status }}</span>
                </p>
              </div>
            </a>
          @empty
            <div class="empty-state !py-10">{{ __('v3.common.none') }}</div>
          @endforelse
        </div>
      </section>
    </div>
  </section>
</x-layouts.app>
