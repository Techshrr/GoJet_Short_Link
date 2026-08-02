<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileBlock extends Model
{
    use HasFactory;

    protected $fillable = ['profile_page_id', 'type', 'content', 'settings', 'position', 'is_active', 'starts_at', 'ends_at', 'clicks_count'];

    protected function casts(): array
    {
        return ['content' => 'array', 'settings' => 'array', 'position' => 'integer', 'is_active' => 'boolean', 'starts_at' => 'datetime', 'ends_at' => 'datetime', 'clicks_count' => 'integer'];
    }

    public function profilePage(): BelongsTo
    {
        return $this->belongsTo(ProfilePage::class);
    }

    public function isVisible(): bool
    {
        return $this->is_active
            && (! $this->starts_at || $this->starts_at->isPast())
            && (! $this->ends_at || $this->ends_at->isFuture());
    }
}
