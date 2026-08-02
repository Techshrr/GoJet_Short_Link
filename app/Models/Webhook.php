<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Webhook extends Model
{
    use HasFactory;

    protected $fillable = ['workspace_id', 'name', 'url', 'secret_hash', 'secret_encrypted', 'events', 'is_active', 'last_success_at', 'last_failure_at'];

    protected $hidden = ['secret_hash', 'secret_encrypted'];

    protected function casts(): array
    {
        return ['events' => 'array', 'is_active' => 'boolean', 'last_success_at' => 'datetime', 'last_failure_at' => 'datetime'];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class);
    }
}
