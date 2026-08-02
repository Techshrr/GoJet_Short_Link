<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailDeliveryLog extends Model
{
    protected $fillable = [
        'user_id', 'message_type', 'recipient', 'subject', 'transport', 'status', 'attempts',
        'error_class', 'error_message', 'context', 'sent_at', 'last_attempt_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'last_attempt_at' => 'datetime',
            'attempts' => 'integer',
            'context' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
