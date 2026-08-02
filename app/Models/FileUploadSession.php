<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileUploadSession extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'user_id', 'disk', 'original_name', 'size_bytes', 'received_bytes', 'chunk_size', 'status', 'metadata', 'expires_at'];

    protected function casts(): array
    {
        return ['size_bytes' => 'integer', 'received_bytes' => 'integer', 'chunk_size' => 'integer', 'metadata' => 'array', 'expires_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
