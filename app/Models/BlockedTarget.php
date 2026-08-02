<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlockedTarget extends Model
{
    protected $fillable = [
        'match_type',
        'value',
        'value_hash',
        'reason',
        'is_active',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public static function normalize(string $matchType, string $value): string
    {
        $value = trim($value);

        return $matchType === 'host'
            ? strtolower(rtrim($value, '.'))
            : $value;
    }

    public static function fingerprint(string $value): string
    {
        return hash('sha256', $value);
    }
}
