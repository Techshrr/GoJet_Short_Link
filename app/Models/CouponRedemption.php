<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CouponRedemption extends Model
{
    public $timestamps = false;

    protected $fillable = ['coupon_id', 'workspace_id', 'subscription_id', 'discount_amount', 'redeemed_at'];

    protected function casts(): array
    {
        return ['discount_amount' => 'decimal:2', 'redeemed_at' => 'datetime'];
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
