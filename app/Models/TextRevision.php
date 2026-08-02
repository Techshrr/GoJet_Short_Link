<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TextRevision extends Model
{
    public $timestamps = false;

    protected $fillable = ['text_share_id', 'editor_user_id', 'content', 'format', 'syntax_language', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function textShare(): BelongsTo
    {
        return $this->belongsTo(TextShare::class);
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_user_id');
    }
}
