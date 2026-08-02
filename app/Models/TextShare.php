<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TextShare extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['user_id', 'workspace_id', 'slug', 'title', 'content', 'format', 'syntax_language', 'visibility', 'password_hash', 'expires_at', 'burn_after_read', 'views_count', 'max_views', 'last_viewed_at'];

    protected $hidden = ['password_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'burn_after_read' => 'boolean', 'views_count' => 'integer', 'max_views' => 'integer', 'last_viewed_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(TextRevision::class);
    }

    public function isAvailable(): bool
    {
        return (! $this->expires_at || $this->expires_at->isFuture())
            && (! $this->max_views || $this->views_count < $this->max_views);
    }
}
