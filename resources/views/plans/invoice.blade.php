<x-layouts.app :title="$invoice->number">
  <section class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
      <a class="btn-secondary" href="{{ route('plans.index') }}">← {{ __('billing.back') }}</a>
      <button class="btn-primary" type="button" onclick="window.print()">{{ __('billing.print') }}</button>
    </div>

    <article class="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:mt-0 print:border-0 print:shadow-none">
      <div class="flex flex-col gap-8 border-b border-slate-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="flex items-center gap-3 font-black text-slate-950">
            <span class="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white">G</span>
            <span class="text-2xl">{{ config('app.name', 'GoJet') }}</span>
          </div>
          <p class="mt-4 text-sm text-slate-500">{{ config('gojet.support_email') }}</p>
        </div>
        <div class="sm:text-right">
          <p class="text-xs font-bold uppercase tracking-[.18em] text-cyan-700">
            {{ $invoice->status === 'paid' ? __('billing.receipt') : __('billing.invoice') }}
          </p>
          <h1 class="mt-2 text-3xl font-black text-slate-950">{{ $invoice->number }}</h1>
          <span class="mt-3 inline-flex {{ $invoice->status === 'paid' ? 'badge-success' : 'badge-warning' }}">
            {{ strtoupper($invoice->status) }}
          </span>
        </div>
      </div>

      <div class="grid gap-8 py-8 sm:grid-cols-2">
        <div>
          <p class="text-xs font-bold uppercase tracking-[.14em] text-slate-400">{{ __('billing.billed_to') }}</p>
          <p class="mt-3 font-bold text-slate-950">{{ $invoice->workspace->name }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ __('billing.workspace') }} #{{ $invoice->workspace_id }}</p>
        </div>
        <dl class="space-y-2 text-sm sm:text-right">
          <div><dt class="inline text-slate-500">{{ __('billing.issued') }}：</dt><dd class="inline font-semibold">{{ $invoice->issued_at?->format('Y-m-d H:i') }}</dd></div>
          <div><dt class="inline text-slate-500">{{ __('billing.due') }}：</dt><dd class="inline font-semibold">{{ $invoice->due_at?->format('Y-m-d H:i') }}</dd></div>
          @if($invoice->paid_at)
            <div><dt class="inline text-slate-500">{{ __('billing.paid_at') }}：</dt><dd class="inline font-semibold">{{ $invoice->paid_at->format('Y-m-d H:i') }}</dd></div>
          @endif
        </dl>
      </div>

      <div class="overflow-hidden rounded-2xl border border-slate-200">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-5 py-4">{{ __('billing.item') }}</th>
              <th class="px-5 py-4 text-right">{{ __('billing.amount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-t border-slate-100">
              <td class="px-5 py-5">
                <strong>{{ $invoice->subscription?->plan?->name ?? __('billing.subscription') }}</strong>
                <p class="mt-1 text-xs text-slate-500">
                  {{ ucfirst($invoice->subscription?->interval ?? '') }} · {{ $invoice->subscription?->provider ?? 'manual' }}
                </p>
              </td>
              <td class="px-5 py-5 text-right font-semibold">
                {{ $invoice->currency }} {{ number_format((float) $invoice->subtotal, 2) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl class="ml-auto mt-6 max-w-sm space-y-3 text-sm">
        <div class="flex justify-between gap-6"><dt class="text-slate-500">{{ __('billing.subtotal') }}</dt><dd class="font-semibold">{{ $invoice->currency }} {{ number_format((float) $invoice->subtotal, 2) }}</dd></div>
        <div class="flex justify-between gap-6"><dt class="text-slate-500">{{ __('billing.discount') }}</dt><dd class="font-semibold">− {{ $invoice->currency }} {{ number_format((float) $invoice->discount, 2) }}</dd></div>
        <div class="flex justify-between gap-6 border-t border-slate-200 pt-4 text-lg"><dt class="font-black">{{ __('billing.total') }}</dt><dd class="font-black">{{ $invoice->currency }} {{ number_format((float) $invoice->total, 2) }}</dd></div>
      </dl>

      <p class="mt-10 border-t border-slate-100 pt-6 text-xs leading-6 text-slate-400">{{ __('billing.note') }}</p>
    </article>
  </section>
</x-layouts.app>
