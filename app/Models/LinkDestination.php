<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LinkDestination extends Model
{
    use HasFactory;

    protected $fillable = ['link_id', 'name', 'target_url', 'weight', 'position', 'is_fallback', 'is_active'];

    protected function casts(): array
    {
        return ['weight' => 'integer', 'position' => 'integer', 'is_fallback' => 'boolean', 'is_active' => 'boolean'];
    }

    public function link(): BelongsTo
    {
        return $this->belongsTo(Link::class);
    }

    public function rules(): HasMany
    {
        return $this->hasMany(RoutingRule::class, 'destination_id');
    }
}
