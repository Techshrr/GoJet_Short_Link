<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    use HasFactory;

    protected $fillable = ['workspace_id', 'plan_id', 'coupon_id', 'provider', 'provider_subscription_id', 'status', 'interval', 'current_period_start', 'current_period_end', 'grace_ends_at', 'cancelled_at', 'metadata'];

    protected function casts(): array
    {
        return ['current_period_start' => 'datetime', 'current_period_end' => 'datetime', 'grace_ends_at' => 'datetime', 'cancelled_at' => 'datetime', 'metadata' => 'array'];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function isUsable(): bool
    {
        return in_array($this->status, ['active', 'trialing'], true)
            || ($this->grace_ends_at && $this->grace_ends_at->isFuture());
    }
}
