<?php

namespace App\Services;

use App\Models\Link;
use Illuminate\Support\Facades\Redis;
use Throwable;

class RedirectPayloadService
{
    public function payload(Link $link): array
    {
        $requiresApplication = filled($link->password_hash)
            || filled($link->max_clicks)
            || $link->destinations()->where('is_active', true)->exists()
            || $link->routingRules()->where('is_active', true)->exists();

        return [
            'id' => $link->id,
            'host' => $link->host,
            'slug' => $link->slug,
            'target_url' => $link->target_url,
            'redirect_type' => (int) $link->redirect_type,
            'status' => $link->status,
            'starts_at' => $link->starts_at?->toIso8601String(),
            'expires_at' => $link->expires_at?->toIso8601String(),
            'max_clicks' => $link->max_clicks,
            'clicks_count' => (int) $link->clicks_count,
            'password_protected' => filled($link->password_hash),
            'requires_application' => $requiresApplication,
            'analytics_enabled' => (bool) config('gojet.analytics.enabled', true),
            'utm_parameters' => $link->utm_parameters ?? [],
            'updated_at' => $link->updated_at?->toIso8601String(),
        ];
    }

    public function publish(Link $link): void
    {
        if (! config('gojet.redirect_plane.enabled', false)) {
            return;
        }

        try {
            Redis::setex(
                $link->cacheKey(),
                (int) config('gojet.link_cache_ttl', 3600),
                json_encode($this->payload($link), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            );
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    public function forget(Link $link): void
    {
        if (! config('gojet.redirect_plane.enabled', false)) {
            return;
        }

        try {
            Redis::del($link->cacheKey());
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
