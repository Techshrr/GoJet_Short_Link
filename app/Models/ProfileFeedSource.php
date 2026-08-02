<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileFeedSource extends Model
{
    protected $fillable = ['profile_page_id', 'adapter', 'name', 'source_url', 'configuration', 'cached_items', 'status', 'last_error', 'last_refreshed_at', 'is_active'];

    protected function casts(): array
    {
        return ['configuration' => 'array', 'cached_items' => 'array', 'last_refreshed_at' => 'datetime', 'is_active' => 'boolean'];
    }

    public function profilePage(): BelongsTo
    {
        return $this->belongsTo(ProfilePage::class);
    }
}
