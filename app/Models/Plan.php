<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory;

    protected $fillable = ['code', 'name', 'description', 'monthly_price', 'yearly_price', 'currency', 'limits', 'features', 'is_public', 'is_active', 'position'];

    protected function casts(): array
    {
        return ['monthly_price' => 'decimal:2', 'yearly_price' => 'decimal:2', 'limits' => 'array', 'features' => 'array', 'is_public' => 'boolean', 'is_active' => 'boolean', 'position' => 'integer'];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function limit(string $key, int $default = 0): int
    {
        return (int) data_get($this->limits, $key, $default);
    }
}
