<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversionEvent extends Model
{
    protected $fillable = ['link_id', 'destination_id', 'event_name', 'visitor_key', 'value', 'currency', 'metadata', 'occurred_at'];

    protected function casts(): array
    {
        return ['value' => 'decimal:4', 'metadata' => 'array', 'occurred_at' => 'datetime'];
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
