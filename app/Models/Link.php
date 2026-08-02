<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;

class Link extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id', 'workspace_id', 'domain_id', 'campaign_id', 'folder_id', 'host', 'slug',
        'target_url', 'title', 'description', 'notes', 'utm_parameters', 'qr_settings', 'status',
        'redirect_type', 'password_hash', 'starts_at', 'expires_at', 'max_clicks', 'clicks_count',
        'archived_at', 'health_status', 'health_http_status', 'health_error', 'last_health_checked_at',
        'preview_title', 'preview_description', 'preview_image_url', 'favicon_url',
    ];

    protected $hidden = ['password_hash'];

    protected function casts(): array
    {
        return [
            'utm_parameters' => 'array', 'qr_settings' => 'array', 'starts_at' => 'datetime',
            'expires_at' => 'datetime', 'archived_at' => 'datetime', 'last_health_checked_at' => 'datetime',
            'max_clicks' => 'integer', 'clicks_count' => 'integer', 'redirect_type' => 'integer',
            'health_http_status' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn (Link $link) => $link->forgetRedirectCache());
        static::deleted(fn (Link $link) => $link->forgetRedirectCache());
        static::restored(fn (Link $link) => $link->forgetRedirectCache());
    }

    public function scopeVisible(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function scopeAvailable(Builder $query): Builder
    {
        return $query->where('status', 'active')
            ->whereNull('archived_at')
            ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function folder(): BelongsTo
    {
        return $this->belongsTo(Folder::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    public function clickEvents(): HasMany
    {
        return $this->hasMany(ClickEvent::class);
    }

    public function dailyStats(): HasMany
    {
        return $this->hasMany(LinkDailyStat::class);
    }

    public function abuseReports(): HasMany
    {
        return $this->hasMany(AbuseReport::class);
    }

    public function destinations(): HasMany
    {
        return $this->hasMany(LinkDestination::class)->orderBy('position');
    }

    public function routingRules(): HasMany
    {
        return $this->hasMany(RoutingRule::class)->orderBy('priority');
    }

    public function conversionEvents(): HasMany
    {
        return $this->hasMany(ConversionEvent::class);
    }

    public function isAvailable(): bool
    {
        return $this->status === 'active'
            && ! $this->archived_at
            && (! $this->starts_at || $this->starts_at->isPast())
            && (! $this->expires_at || $this->expires_at->isFuture())
            && (! $this->max_clicks || $this->clicks_count < $this->max_clicks);
    }


    public function shortUrl(): string
    {
        $scheme = config('gojet.links.force_https', true)
            ? 'https'
            : (parse_url((string) config('app.url'), PHP_URL_SCHEME) ?: 'http');

        return $scheme.'://'.$this->host.'/'.$this->slug;
    }

    public function cacheKey(?string $host = null): string
    {
        return 'gojet:redirect:'.strtolower((string) ($host ?? $this->host)).':'.$this->slug;
    }

    public function forgetRedirectCache(): void
    {
        Cache::forget($this->cacheKey());

        app(\App\Services\RedirectPayloadService::class)->forget($this);
    }
}
