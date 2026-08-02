<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClickEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'event_uuid', 'link_id', 'destination_id', 'occurred_at', 'ip_hash', 'country_code', 'region', 'city',
        'device_type', 'browser', 'platform', 'language', 'referrer_host', 'referrer_url', 'referrer_type',
        'source_channel', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'visit_type',
        'is_bot', 'is_unique', 'ingestion_source', 'response_ms', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'is_bot' => 'boolean',
            'is_unique' => 'boolean',
            'response_ms' => 'integer',
            'metadata' => 'array',
        ];
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
