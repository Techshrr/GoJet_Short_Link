<?php

namespace App\Services;

use App\Models\AnalyticsIngestFailure;
use App\Models\ClickEvent;
use App\Models\Link;
use App\Models\LinkDailyStat;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class AnalyticsRecorder
{
    public function __construct(private readonly RealtimeCounterService $realtime) {}

    public function record(Link $link, array $context, string $source = 'laravel'): ?ClickEvent
    {
        $eventUuid = (string) ($context['event_uuid'] ?? Str::uuid());
        $existing = ClickEvent::query()->where('event_uuid', $eventUuid)->first();
        if ($existing) {
            if ($source !== 'laravel') {
                $this->realtime->markPersisted($link->id);
            }

            return $existing;
        }

        try {
            $event = DB::transaction(function () use ($link, $context, $source, $eventUuid): ClickEvent {
                $lockedLink = Link::query()->lockForUpdate()->findOrFail($link->id);
                if ($lockedLink->max_clicks && $lockedLink->clicks_count >= $lockedLink->max_clicks) {
                    throw new RuntimeException('Link click limit has been reached.');
                }

                $occurredAt = isset($context['occurred_at'])
                    ? Carbon::parse($context['occurred_at'])
                    : now();
                $userAgent = (string) ($context['user_agent'] ?? '');
                $referrerUrl = Str::limit((string) ($context['referrer'] ?? ''), 2048, '');
                $referrerHost = parse_url($referrerUrl, PHP_URL_HOST);
                $referrerHost = $referrerHost ? Str::lower((string) $referrerHost) : null;
                $referrerType = $this->referrerType($referrerUrl, $referrerHost, $lockedLink->host);
                $sourceChannel = $this->sourceChannel($referrerHost, (array) ($context['query'] ?? []), $referrerType);
                $ipHash = hash_hmac(
                    'sha256',
                    (string) ($context['ip'] ?? ''),
                    (string) config('gojet.ip_hash_key'),
                );
                $isBot = $this->isBot($userAgent);
                $countryCode = strtoupper((string) ($context['country_code'] ?? ''));
                $countryCode = preg_match('/^[A-Z]{2}$/', $countryCode) === 1 && $countryCode !== 'XX'
                    ? $countryCode
                    : null;
                $query = (array) ($context['query'] ?? []);

                $eligibleForUnique = ! $isBot || ! config('gojet.analytics.exclude_bots_from_unique', true);
                $alreadySeen = $eligibleForUnique && ClickEvent::query()
                    ->where('link_id', $lockedLink->id)
                    ->whereBetween('occurred_at', [$occurredAt->copy()->startOfDay(), $occurredAt->copy()->endOfDay()])
                    ->where('ip_hash', $ipHash)
                    ->exists();
                $isUnique = $eligibleForUnique && ! $alreadySeen;

                $event = ClickEvent::query()->create([
                    'event_uuid' => $eventUuid,
                    'link_id' => $lockedLink->id,
                    'destination_id' => $context['destination_id'] ?? null,
                    'occurred_at' => $occurredAt,
                    'ip_hash' => $ipHash,
                    'country_code' => $countryCode,
                    'region' => config('gojet.analytics.store_city', true)
                        ? Str::limit((string) ($context['region'] ?? ''), 120, '') ?: null
                        : null,
                    'city' => config('gojet.analytics.store_city', true)
                        ? Str::limit((string) ($context['city'] ?? ''), 120, '') ?: null
                        : null,
                    'device_type' => $this->device($userAgent),
                    'browser' => $this->browser($userAgent),
                    'platform' => $this->platform($userAgent),
                    'language' => Str::limit((string) ($context['language'] ?? ''), 20, '') ?: null,
                    'referrer_host' => $referrerHost,
                    'referrer_url' => config('gojet.analytics.store_referrer_url', true) ? ($referrerUrl ?: null) : null,
                    'referrer_type' => $referrerType,
                    'source_channel' => $sourceChannel,
                    'utm_source' => Str::limit((string) ($query['utm_source'] ?? ''), 120, '') ?: null,
                    'utm_medium' => Str::limit((string) ($query['utm_medium'] ?? ''), 120, '') ?: null,
                    'utm_campaign' => Str::limit((string) ($query['utm_campaign'] ?? ''), 160, '') ?: null,
                    'utm_content' => Str::limit((string) ($query['utm_content'] ?? ''), 160, '') ?: null,
                    'utm_term' => Str::limit((string) ($query['utm_term'] ?? ''), 160, '') ?: null,
                    'visit_type' => ($query['gojet_source'] ?? null) === 'qr' ? 'qr' : 'link',
                    'is_bot' => $isBot,
                    'is_unique' => $isUnique,
                    'ingestion_source' => $source,
                    'response_ms' => isset($context['response_ms']) ? max(0, (int) $context['response_ms']) : null,
                    'metadata' => [
                        'request_id' => $context['request_id'] ?? null,
                        'forwarded_for_present' => filled($context['forwarded_for'] ?? null),
                    ],
                ]);

                $lockedLink->increment('clicks_count');

                $stat = LinkDailyStat::query()->firstOrCreate(
                    ['link_id' => $lockedLink->id, 'date' => $occurredAt->toDateString()],
                    ['clicks' => 0, 'unique_clicks' => 0],
                );
                $stat->increment('clicks');
                if ($isUnique) {
                    $stat->increment('unique_clicks');
                }

                return $event;
            }, 3);

            if ($source !== 'laravel') {
                $this->realtime->markPersisted($link->id);
            }
            $link->forgetRedirectCache();

            return $event;
        } catch (QueryException $exception) {
            if ($this->isDuplicateEvent($exception)) {
                $existing = ClickEvent::query()->where('event_uuid', $eventUuid)->first();
                if ($existing && $source !== 'laravel') {
                    $this->realtime->markPersisted($link->id);
                }

                return $existing;
            }

            $this->recordFailure($link, $eventUuid, $source, $context, $exception);

            return null;
        } catch (Throwable $exception) {
            $this->recordFailure($link, $eventUuid, $source, $context, $exception);

            return null;
        }
    }

    private function recordFailure(Link $link, string $eventUuid, string $source, array $context, Throwable $exception): void
    {
        try {
            AnalyticsIngestFailure::query()->create([
                'link_id' => $link->id,
                'event_uuid' => $eventUuid,
                'source' => $source,
                'payload' => $this->safePayload($context),
                'error_class' => $exception::class,
                'error_message' => Str::limit($exception->getMessage(), 10000, ''),
                'attempts' => 1,
                'last_attempt_at' => now(),
            ]);
        } catch (Throwable $loggingException) {
            report($loggingException);
        }

        report($exception);
    }

    private function isDuplicateEvent(QueryException $exception): bool
    {
        return in_array((string) ($exception->errorInfo[0] ?? ''), ['23000', '23505'], true)
            && str_contains(Str::lower($exception->getMessage()), 'event_uuid');
    }

    private function safePayload(array $context): array
    {
        unset($context['ip'], $context['forwarded_for']);

        return $context;
    }

    private function referrerType(string $url, ?string $host, string $linkHost): string
    {
        if ($url === '') {
            return 'direct';
        }
        if (! $host) {
            return 'unknown';
        }
        if (Str::lower($host) === Str::lower($linkHost)) {
            return 'internal';
        }

        return 'referral';
    }

    private function sourceChannel(?string $host, array $query, string $type): string
    {
        if (filled($query['utm_source'] ?? null)) {
            return 'campaign';
        }
        if (in_array($type, ['direct', 'unknown', 'internal'], true)) {
            return $type;
        }

        $host = Str::lower((string) $host);
        foreach (['google.', 'bing.', 'baidu.', 'yahoo.', 'duckduckgo.'] as $needle) {
            if (str_contains($host, $needle)) {
                return 'search';
            }
        }
        foreach (['facebook.', 'instagram.', 'x.com', 'twitter.', 'linkedin.', 'tiktok.', 'youtube.', 'weibo.', 'wechat.', 'douyin.'] as $needle) {
            if (str_contains($host, $needle)) {
                return 'social';
            }
        }

        return 'referral';
    }

    private function isBot(string $ua): bool
    {
        return preg_match('/bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|telegrambot|whatsapp|curl|wget/i', $ua) === 1;
    }

    private function device(string $ua): string
    {
        return match (true) {
            preg_match('/ipad|tablet/i', $ua) === 1 => 'tablet',
            preg_match('/mobile|android|iphone/i', $ua) === 1 => 'mobile',
            $ua === '' => 'unknown',
            default => 'desktop',
        };
    }

    private function browser(string $ua): string
    {
        return match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'OPR/') => 'Opera',
            str_contains($ua, 'Firefox/') => 'Firefox',
            str_contains($ua, 'Chrome/') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            $ua === '' => 'Unknown',
            default => 'Other',
        };
    }

    private function platform(string $ua): string
    {
        return match (true) {
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'iPhone') || str_contains($ua, 'iPad') => 'iOS',
            str_contains($ua, 'Macintosh') => 'macOS',
            str_contains($ua, 'Linux') => 'Linux',
            $ua === '' => 'Unknown',
            default => 'Other',
        };
    }
}
