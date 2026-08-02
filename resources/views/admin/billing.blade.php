<x-layouts.admin :title="__('billing.title')">
  <section class="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="page-kicker">{{ __('v3.nav.admin') }}</p>
        <h1 class="page-title mt-1">{{ __('billing.title') }}</h1>
        <p class="page-description">{{ __('billing.subtitle') }}</p>
      </div>
      <a class="btn-secondary" href="{{ route('admin.index') }}">← {{ __('billing.back') }}</a>
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

    <div class="mt-7 grid gap-6 xl:grid-cols-[420px_1fr]">
      <section class="panel h-fit">
        <h2 class="text-xl font-black text-slate-950">{{ __('billing.new_coupon') }}</h2>
        <form class="mt-5 space-y-4" method="post" action="{{ route('admin.billing.coupons.store') }}">
          @csrf
          <div>
            <label class="label" for="coupon-code">{{ __('billing.coupon_code') }}</label>
            <input id="coupon-code" class="input" name="code" value="{{ old('code') }}" required maxlength="80" placeholder="LAUNCH25">
          </div>
          <div>
            <label class="label" for="coupon-name">{{ __('billing.coupon_name') }}</label>
            <input id="coupon-name" class="input" name="name" value="{{ old('name') }}" required maxlength="120">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label" for="discount-type">{{ __('billing.discount_type') }}</label>
              <select id="discount-type" class="input" name="discount_type" required>
                <option value="percent" @selected(old('discount_type') === 'percent')>{{ __('billing.percent') }}</option>
                <option value="fixed" @selected(old('discount_type') === 'fixed')>{{ __('billing.fixed') }}</option>
              </select>
            </div>
            <div>
              <label class="label" for="discount-value">{{ __('billing.discount_value') }}</label>
              <input id="discount-value" class="input" type="number" step="0.01" min="0.01" name="discount_value" value="{{ old('discount_value') }}" required>
            </div>
          </div>
          <div>
            <label class="label" for="plan-codes">{{ __('billing.plan_codes') }}</label>
            <input id="plan-codes" class="input" name="plan_codes" value="{{ old('plan_codes') }}" placeholder="pro, business">
            <p class="mt-1 text-xs text-slate-400">{{ __('billing.plan_codes_help') }}</p>
          </div>
          <div>
            <label class="label" for="max-redemptions">{{ __('billing.max_redemptions') }}</label>
            <input id="max-redemptions" class="input" type="number" min="1" name="max_redemptions" value="{{ old('max_redemptions') }}">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label" for="starts-at">{{ __('billing.starts_at') }}</label>
              <input id="starts-at" class="input" type="datetime-local" name="starts_at" value="{{ old('starts_at') }}">
            </div>
            <div>
              <label class="label" for="expires-at">{{ __('billing.expires_at') }}</label>
              <input id="expires-at" class="input" type="datetime-local" name="expires_at" value="{{ old('expires_at') }}">
            </div>
          </div>
          <button class="btn-brand w-full py-3">{{ __('v3.common.create') }}</button>
        </form>
      </section>

      <section class="panel overflow-hidden">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-xl font-black text-slate-950">{{ __('billing.coupons') }}</h2>
          <span class="badge-neutral">{{ $coupons->total() }}</span>
        </div>
        <div class="mt-5 space-y-4">
          @forelse($coupons as $coupon)
            <article class="rounded-2xl border border-slate-200 p-4">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <strong class="text-lg text-slate-950">{{ $coupon->code }}</strong>
                    <span class="{{ $coupon->is_active ? 'badge-success' : 'badge-neutral' }}">
                      {{ $coupon->is_active ? __('v3.common.active') : __('v3.common.disabled') }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-slate-500">{{ $coupon->name }}</p>
                  <p class="mt-2 text-xs text-slate-400">
                    {{ $coupon->discount_type === 'percent' ? number_format((float) $coupon->discount_value, 2).'%' : number_format((float) $coupon->discount_value, 2) }}
                    · {{ __('billing.redemptions') }} {{ $coupon->redemptions_count }}@if($coupon->max_redemptions) / {{ $coupon->max_redemptions }}@endif
                  </p>
                </div>
                <form method="post" action="{{ route('admin.billing.coupons.destroy', $coupon) }}" onsubmit="return confirm(@js(__('v3.common.confirm_delete'))) ">
                  @csrf
                  @method('delete')
                  <button class="btn-danger !px-3 !py-2">{{ __('v3.common.delete') }}</button>
                </form>
              </div>

              <form class="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 xl:grid-cols-4" method="post" action="{{ route('admin.billing.coupons.update', $coupon) }}">
                @csrf
                @method('patch')
                <input class="input" name="name" value="{{ $coupon->name }}" required>
                <select class="input" name="discount_type">
                  <option value="percent" @selected($coupon->discount_type === 'percent')>{{ __('billing.percent') }}</option>
                  <option value="fixed" @selected($coupon->discount_type === 'fixed')>{{ __('billing.fixed') }}</option>
                </select>
                <input class="input" type="number" step="0.01" min="0.01" name="discount_value" value="{{ $coupon->discount_value }}" required>
                <input class="input" name="plan_codes" value="{{ implode(', ', $coupon->plan_codes ?? []) }}" placeholder="pro, business">
                <input class="input" type="number" min="1" name="max_redemptions" value="{{ $coupon->max_redemptions }}" placeholder="{{ __('billing.max_redemptions') }}">
                <input class="input" type="datetime-local" name="starts_at" value="{{ $coupon->starts_at?->format('Y-m-d\TH:i') }}">
                <input class="input" type="datetime-local" name="expires_at" value="{{ $coupon->expires_at?->format('Y-m-d\TH:i') }}">
                <div class="flex items-center gap-3">
                  <label class="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <input type="checkbox" name="is_active" value="1" @checked($coupon->is_active)>
                    {{ __('v3.common.active') }}
                  </label>
                  <button class="btn-primary !px-4 !py-2">{{ __('v3.common.save') }}</button>
                </div>
              </form>
            </article>
          @empty
            <div class="empty-state">{{ __('billing.no_records') }}</div>
          @endforelse
        </div>
        @if($coupons->hasPages())
          <div class="mt-5">{{ $coupons->links() }}</div>
        @endif
      </section>
    </div>

    <section class="panel mt-7 overflow-hidden">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-xl font-black text-slate-950">{{ __('billing.subscriptions') }}</h2>
        <span class="badge-neutral">{{ $subscriptions->total() }}</span>
      </div>
      <div class="mt-5 overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-3 py-3">{{ __('billing.workspace') }}</th>
              <th class="px-3 py-3">{{ __('billing.plan') }}</th>
              <th class="px-3 py-3">{{ __('billing.provider') }}</th>
              <th class="px-3 py-3">{{ __('billing.coupon') }}</th>
              <th class="px-3 py-3">{{ __('v3.common.status') }}</th>
              <th class="px-3 py-3 text-right">{{ __('v3.common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @forelse($subscriptions as $subscription)
              <tr>
                <td class="px-3 py-4 font-semibold text-slate-950">{{ $subscription->workspace?->name }}</td>
                <td class="px-3 py-4">{{ $subscription->plan?->name }} · {{ $subscription->interval }}</td>
                <td class="px-3 py-4">{{ $subscription->provider }}</td>
                <td class="px-3 py-4">{{ $subscription->coupon?->code ?? '—' }}</td>
                <td class="px-3 py-4">
                  <span class="{{ $subscription->status === 'active' ? 'badge-success' : ($subscription->status === 'pending' ? 'badge-warning' : 'badge-neutral') }}">
                    {{ $subscription->status }}
                  </span>
                </td>
                <td class="px-3 py-4 text-right">
                  @if($subscription->status === 'pending')
                    <form method="post" action="{{ route('admin.subscriptions.approve', $subscription) }}">
                      @csrf
                      <button class="btn-primary !px-3 !py-2">{{ __('billing.approve') }}</button>
                    </form>
                  @else
                    —
                  @endif
                </td>
              </tr>
            @empty
              <tr><td class="px-3 py-10 text-center text-slate-400" colspan="6">{{ __('billing.no_records') }}</td></tr>
            @endforelse
          </tbody>
        </table>
      </div>
      @if($subscriptions->hasPages())
        <div class="mt-5">{{ $subscriptions->links() }}</div>
      @endif
    </section>

    <section class="panel mt-7 overflow-hidden">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-xl font-black text-slate-950">{{ __('billing.invoices') }}</h2>
        <span class="badge-neutral">{{ $invoices->total() }}</span>
      </div>
      <div class="mt-5 overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-3 py-3">{{ __('billing.invoice') }}</th>
              <th class="px-3 py-3">{{ __('billing.workspace') }}</th>
              <th class="px-3 py-3">{{ __('billing.amount') }}</th>
              <th class="px-3 py-3">{{ __('v3.common.status') }}</th>
              <th class="px-3 py-3 text-right">{{ __('v3.common.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @forelse($invoices as $invoice)
              <tr>
                <td class="px-3 py-4 font-semibold text-slate-950">{{ $invoice->number }}</td>
                <td class="px-3 py-4">{{ $invoice->workspace?->name }}</td>
                <td class="px-3 py-4">{{ $invoice->currency }} {{ number_format((float) $invoice->total, 2) }}</td>
                <td class="px-3 py-4">
                  <span class="{{ $invoice->status === 'paid' ? 'badge-success' : 'badge-warning' }}">{{ $invoice->status }}</span>
                </td>
                <td class="px-3 py-4">
                  <div class="flex justify-end gap-2">
                    <a class="btn-secondary !px-3 !py-2" href="{{ route('plans.invoice', $invoice) }}">{{ __('billing.open_invoice') }}</a>
                    @if($invoice->status === 'open')
                      <form method="post" action="{{ route('admin.billing.invoices.paid', $invoice) }}">
                        @csrf
                        <button class="btn-primary !px-3 !py-2">{{ __('billing.mark_paid') }}</button>
                      </form>
                    @endif
                  </div>
                </td>
              </tr>
            @empty
              <tr><td class="px-3 py-10 text-center text-slate-400" colspan="5">{{ __('billing.no_records') }}</td></tr>
            @endforelse
          </tbody>
        </table>
      </div>
      @if($invoices->hasPages())
        <div class="mt-5">{{ $invoices->links() }}</div>
      @endif
    </section>
  </section>
</x-layouts.admin>
