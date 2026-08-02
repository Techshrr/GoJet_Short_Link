<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Domain extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'workspace_id', 'hostname', 'verification_token', 'verified_at', 'status',
        'is_default', 'certificate_status', 'cloudflare_hostname_id', 'provisioning_error',
    ];

    protected $hidden = ['verification_token'];

    protected function casts(): array
    {
        return ['verified_at' => 'datetime', 'is_default' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::saved(function (Domain $domain): void {
            if ($domain->wasChanged(['verified_at', 'status', 'certificate_status'])) {
                $domain->links()->select(['id', 'host', 'slug'])->chunkById(500, fn ($links) => $links->each->forgetRedirectCache());
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function links(): HasMany
    {
        return $this->hasMany(Link::class);
    }

    public function profilePages(): HasMany
    {
        return $this->hasMany(ProfilePage::class);
    }

    public function isUsable(): bool
    {
        return $this->status === 'active'
            && $this->verified_at !== null
            && in_array($this->certificate_status, ['active', 'external'], true);
    }
}
