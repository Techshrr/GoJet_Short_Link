<?php

namespace App\Services;

use App\Contracts\BillingProvider;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ManualBillingProvider implements BillingProvider
{
    public function __construct(private readonly CouponService $coupons) {}

    public function code(): string
    {
        return 'manual';
    }

    public function subscribe(
        Workspace $workspace,
        Plan $plan,
        string $interval,
        ?string $couponCode = null,
    ): array {
        return DB::transaction(function () use ($workspace, $plan, $interval, $couponCode): array {
            $coupon = $this->coupons->resolve($couponCode, $plan->code);
            $subtotal = (float) ($interval === 'yearly' ? $plan->yearly_price : $plan->monthly_price);
            $discount = $coupon?->discount($subtotal) ?? 0.0;
            $total = max(0.0, $subtotal - $discount);
            $isPaid = $total <= 0.0;

            $subscription = $workspace->subscriptions()->create([
                'plan_id' => $plan->id,
                'provider' => $this->code(),
                'status' => $isPaid ? 'active' : 'pending',
                'interval' => $interval,
                'current_period_start' => $isPaid ? now() : null,
                'current_period_end' => $isPaid
                    ? ($interval === 'yearly' ? now()->addYear() : now()->addMonth())
                    : null,
                'metadata' => ['requested_at' => now()->toIso8601String()],
            ]);

            $invoice = Invoice::create([
                'workspace_id' => $workspace->id,
                'subscription_id' => $subscription->id,
                'number' => 'GJ-'.now()->format('Ymd').'-'.Str::upper(Str::random(10)),
                'status' => $isPaid ? 'paid' : 'open',
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'currency' => $plan->currency,
                'issued_at' => now(),
                'due_at' => $isPaid ? now() : now()->addDays(7),
                'paid_at' => $isPaid ? now() : null,
                'metadata' => ['provider' => $this->code(), 'interval' => $interval],
            ]);

            if ($coupon) {
                $this->coupons->redeem($coupon, $workspace, $subscription->load('plan'), $discount);
            }

            if ($isPaid) {
                $workspace->update(['plan_code' => $plan->code]);
            }

            return ['subscription' => $subscription->fresh(['coupon']), 'invoice' => $invoice, 'checkout_url' => null];
        });
    }

    public function approve(Subscription $subscription): void
    {
        DB::transaction(function () use ($subscription): void {
            $subscription->update([
                'status' => 'active',
                'current_period_start' => now(),
                'current_period_end' => $subscription->interval === 'yearly' ? now()->addYear() : now()->addMonth(),
                'grace_ends_at' => null,
            ]);
            $subscription->workspace->update(['plan_code' => $subscription->plan->code]);
            Invoice::query()->where('subscription_id', $subscription->id)->where('status', 'open')->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);
        });
    }

    public function cancel(Subscription $subscription): void
    {
        $subscription->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'grace_ends_at' => $subscription->current_period_end?->isFuture()
                ? $subscription->current_period_end
                : now()->addDays(7),
        ]);
    }
}
