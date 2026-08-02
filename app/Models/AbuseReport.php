<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AbuseReport extends Model
{
    protected $fillable = [
        'link_id',
        'short_url',
        'reporter_email',
        'reason',
        'details',
        'status',
        'resolved_by_user_id',
        'resolution_notes',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function link(): BelongsTo
    {
        return $this->belongsTo(Link::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }
}
