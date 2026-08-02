<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\Subscription;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CouponService
{
    public function resolve(?string $code, string $planCode): ?Coupon
    {
        $code = strtoupper(trim((string) $code));
        if ($code === '') {
            return null;
        }

        $coupon = Coupon::query()->where('code', $code)->lockForUpdate()->first();
        if (! $coupon || ! $coupon->isUsableFor($planCode)) {
            throw ValidationException::withMessages(['coupon_code' => __('billing.coupon_invalid')]);
        }

        return $coupon;
    }

    public function redeem(
        Coupon $coupon,
        Workspace $workspace,
        Subscription $subscription,
        float $discountAmount,
    ): void {
        DB::transaction(function () use ($coupon, $workspace, $subscription, $discountAmount): void {
            $locked = Coupon::query()->lockForUpdate()->findOrFail($coupon->id);
            if (! $locked->isUsableFor($subscription->plan->code)) {
                throw ValidationException::withMessages(['coupon_code' => __('billing.coupon_invalid')]);
            }
            if ($locked->redemptions()->where('workspace_id', $workspace->id)->exists()) {
                throw ValidationException::withMessages(['coupon_code' => __('billing.coupon_already_used')]);
            }

            $locked->redemptions()->create([
                'workspace_id' => $workspace->id,
                'subscription_id' => $subscription->id,
                'discount_amount' => $discountAmount,
                'redeemed_at' => now(),
            ]);
            $locked->increment('redemptions_count');
            $subscription->forceFill(['coupon_id' => $locked->id])->save();
        });
    }
}
