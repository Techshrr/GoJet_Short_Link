<?php

namespace App\Services;

use App\Models\Link;
use App\Models\LinkDestination;
use App\Models\RoutingRule;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class SmartRoutingService
{
    public function choose(Link $link, Request $request): ?LinkDestination
    {
        $link->loadMissing(['destinations.rules', 'routingRules.destination']);
        $active = $link->destinations->where('is_active', true)->values();

        if ($active->isEmpty()) {
            return null;
        }

        $context = $this->context($request);
        foreach ($link->routingRules->where('is_active', true)->sortBy('priority') as $rule) {
            if ($rule->destination?->is_active && $this->matches($rule, $context)) {
                return $rule->destination;
            }
        }

        $weighted = $active->where('weight', '>', 0)->values();
        if ($weighted->isNotEmpty()) {
            $total = max(1, (int) $weighted->sum('weight'));
            $seed = crc32($link->id.'|'.($request->ip() ?? '').'|'.Str::limit((string) $request->userAgent(), 160, ''));
            $position = abs($seed) % $total;
            $cursor = 0;
            foreach ($weighted as $destination) {
                $cursor += max(1, (int) $destination->weight);
                if ($position < $cursor) {
                    return $destination;
                }
            }
        }

        return $active->firstWhere('is_fallback', true) ?? $active->first();
    }

    public function context(Request $request): array
    {
        $ua = (string) $request->userAgent();
        $language = Str::lower(Str::before((string) $request->header('Accept-Language', ''), ','));

        return [
            'country' => Str::upper((string) $request->header('CF-IPCountry', '')),
            'region' => (string) $request->header('CF-Region', $request->header('X-GoJet-Region', '')),
            'city' => (string) $request->header('CF-IPCity', $request->header('X-GoJet-City', '')),
            'device' => preg_match('/mobile|android|iphone|ipad/i', $ua) ? 'mobile' : 'desktop',
            'platform' => match (true) {
                str_contains($ua, 'Windows') => 'windows',
                str_contains($ua, 'Android') => 'android',
                str_contains($ua, 'iPhone') || str_contains($ua, 'iPad') => 'ios',
                str_contains($ua, 'Macintosh') => 'macos',
                str_contains($ua, 'Linux') => 'linux',
                default => 'other',
            },
            'browser' => match (true) {
                str_contains($ua, 'Edg/') => 'edge',
                str_contains($ua, 'Firefox/') => 'firefox',
                str_contains($ua, 'Chrome/') => 'chrome',
                str_contains($ua, 'Safari/') => 'safari',
                default => 'other',
            },
            'language' => Str::before($language, '-'),
            'referrer' => Str::lower((string) parse_url((string) $request->header('referer', ''), PHP_URL_HOST)),
            'query' => $request->query(),
            'now' => now(),
        ];
    }

    public function matches(RoutingRule $rule, array $context): bool
    {
        $values = Arr::wrap($rule->values);
        $actual = $context[$rule->type] ?? null;

        if ($rule->type === 'query') {
            $key = (string) ($rule->values['key'] ?? '');
            $actual = data_get($context, 'query.'.$key);
            $values = Arr::wrap($rule->values['values'] ?? []);
        }

        if ($rule->type === 'schedule') {
            return $this->matchesSchedule((array) $rule->values, $context['now']);
        }

        $normalizedActual = Str::lower(trim((string) $actual));
        $normalizedValues = collect($values)->map(fn ($value) => Str::lower(trim((string) $value)))->filter()->values();

        return match ($rule->operator) {
            'not_in' => ! $normalizedValues->contains($normalizedActual),
            'equals' => $normalizedValues->first() === $normalizedActual,
            'contains' => $normalizedValues->contains(fn ($value) => $value !== '' && str_contains($normalizedActual, $value)),
            'exists' => $normalizedActual !== '',
            'missing' => $normalizedActual === '',
            default => $normalizedValues->contains($normalizedActual),
        };
    }

    private function matchesSchedule(array $values, Carbon $now): bool
    {
        $timezone = (string) ($values['timezone'] ?? config('app.timezone'));
        $local = $now->copy()->timezone($timezone);

        if (($values['starts_at'] ?? null) && $local->lt(Carbon::parse($values['starts_at'], $timezone))) {
            return false;
        }
        if (($values['ends_at'] ?? null) && $local->gt(Carbon::parse($values['ends_at'], $timezone))) {
            return false;
        }
        if (($values['days'] ?? []) !== [] && ! in_array($local->dayOfWeekIso, array_map('intval', $values['days']), true)) {
            return false;
        }
        if (($values['time_start'] ?? null) && $local->format('H:i') < $values['time_start']) {
            return false;
        }
        if (($values['time_end'] ?? null) && $local->format('H:i') > $values['time_end']) {
            return false;
        }

        return true;
    }
}
