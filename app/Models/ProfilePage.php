<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProfilePage extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['user_id', 'workspace_id', 'domain_id', 'slug', 'title', 'bio', 'avatar_path', 'theme', 'theme_settings', 'status', 'published_at', 'views_count'];

    protected function casts(): array
    {
        return ['theme_settings' => 'array', 'published_at' => 'datetime', 'views_count' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(ProfileBlock::class)->orderBy('position');
    }
}
