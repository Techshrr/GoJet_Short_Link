<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'workspace_id', 'user_id', 'email', 'role', 'status', 'invitation_token_hash',
        'invited_at', 'accepted_at', 'invitation_expires_at', 'revoked_at',
        'last_sent_at', 'invitation_attempts',
    ];

    protected function casts(): array
    {
        return [
            'invited_at' => 'datetime',
            'accepted_at' => 'datetime',
            'invitation_expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'last_sent_at' => 'datetime',
            'invitation_attempts' => 'integer',
        ];
    }

    public function invitationExpired(): bool
    {
        return $this->invitation_expires_at?->isPast() ?? false;
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
