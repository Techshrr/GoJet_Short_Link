<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhookDelivery extends Model
{
    protected $fillable = ['webhook_id', 'event_id', 'event_name', 'payload', 'attempt', 'response_status', 'response_body', 'status', 'next_attempt_at', 'delivered_at'];

    protected function casts(): array
    {
        return ['payload' => 'array', 'attempt' => 'integer', 'response_status' => 'integer', 'next_attempt_at' => 'datetime', 'delivered_at' => 'datetime'];
    }

    public function webhook(): BelongsTo
    {
        return $this->belongsTo(Webhook::class);
    }
}
