<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoutingRule extends Model
{
    use HasFactory;

    protected $fillable = ['link_id', 'destination_id', 'type', 'operator', 'values', 'priority', 'is_active'];

    protected function casts(): array
    {
        return ['values' => 'array', 'priority' => 'integer', 'is_active' => 'boolean'];
    }

    public function link(): BelongsTo
    {
        return $this->belongsTo(Link::class);
    }

    public function destination(): BelongsTo
    {
        return $this->belongsTo(LinkDestination::class, 'destination_id');
    }
}
