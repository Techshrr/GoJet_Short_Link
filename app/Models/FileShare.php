<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FileShare extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['user_id', 'workspace_id', 'slug', 'disk', 'path', 'original_name', 'mime_type', 'size_bytes', 'sha256', 'visibility', 'password_hash', 'expires_at', 'downloads_count', 'max_downloads', 'scan_status', 'scan_result'];

    protected $hidden = ['password_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'size_bytes' => 'integer', 'downloads_count' => 'integer', 'max_downloads' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function isAvailable(): bool
    {
        return $this->scan_status !== 'blocked'
            && (! $this->expires_at || $this->expires_at->isFuture())
            && (! $this->max_downloads || $this->downloads_count < $this->max_downloads);
    }
}
