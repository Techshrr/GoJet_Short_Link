<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    protected $fillable = ['code', 'name', 'discount_type', 'discount_value', 'plan_codes', 'max_redemptions', 'redemptions_count', 'starts_at', 'expires_at', 'is_active'];

    protected function casts(): array
    {
        return ['discount_value' => 'decimal:2', 'plan_codes' => 'array', 'starts_at' => 'datetime', 'expires_at' => 'datetime', 'is_active' => 'boolean'];
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    public function isUsableFor(string $planCode): bool
    {
        return $this->is_active
            && (! $this->starts_at || $this->starts_at->isPast())
            && (! $this->expires_at || $this->expires_at->isFuture())
            && (! $this->max_redemptions || $this->redemptions_count < $this->max_redemptions)
            && (empty($this->plan_codes) || in_array($planCode, $this->plan_codes, true));
    }

    public function discount(float $amount): float
    {
        return round(min($amount, $this->discount_type === 'percent' ? $amount * ((float) $this->discount_value / 100) : (float) $this->discount_value), 2);
    }
}
