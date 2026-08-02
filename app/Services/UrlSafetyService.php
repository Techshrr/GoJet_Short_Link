<?php

namespace App\Services;

use App\Models\BlockedTarget;
use App\Models\Domain;
use Illuminate\Support\Str;
use InvalidArgumentException;

class UrlSafetyService
{
    public function normalizeAndValidate(string $value): string
    {
        $value = trim($value);

        if ($value === '' || preg_match('/[\x00-\x1F\x7F]/', $value)) {
            throw new InvalidArgumentException('The destination URL is invalid.');
        }

        $parts = parse_url($value);
        $scheme = Str::lower((string) ($parts['scheme'] ?? ''));
        $host = $this->normalizeHost((string) ($parts['host'] ?? ''));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new InvalidArgumentException('Only absolute HTTP and HTTPS URLs are allowed.');
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('URLs containing embedded credentials are not allowed.');
        }

        if (config('gojet.links.safety_check', true)
            && config('gojet.block_private_targets')
            && $this->isPrivateHost($host)) {
            throw new InvalidArgumentException('Private, local, and reserved destinations are not allowed.');
        }

        if ($this->isGoJetHost($host)) {
            throw new InvalidArgumentException('A short link cannot redirect back to a GoJet host.');
        }

        if (config('gojet.links.safety_check', true) && $this->isBlocked($host, $value)) {
            throw new InvalidArgumentException('This destination is blocked by the platform safety policy.');
        }

        return $this->replaceHost($value, $host);
    }

    private function normalizeHost(string $host): string
    {
        $host = Str::lower(rtrim($host, '.'));

        if ($host !== '' && function_exists('idn_to_ascii')) {
            $ascii = idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
            if (is_string($ascii)) {
                $host = Str::lower($ascii);
            }
        }

        return $host;
    }

    private function replaceHost(string $url, string $host): string
    {
        $originalHost = (string) parse_url($url, PHP_URL_HOST);

        return $originalHost === '' ? $url : preg_replace(
            '/(?<=:\/\/)(?:\[[^]]+\]|[^\/:?#]+)/',
            $host,
            $url,
            1,
        ) ?? $url;
    }

    private function isBlocked(string $host, string $url): bool
    {
        $hostCandidates = [$host];
        $labels = explode('.', $host);

        while (count($labels) > 2) {
            array_shift($labels);
            $hostCandidates[] = implode('.', $labels);
        }

        $hostHashes = collect($hostCandidates)
            ->map(fn (string $candidate): string => BlockedTarget::fingerprint($candidate));

        return BlockedTarget::query()
            ->where('is_active', true)
            ->where(function ($query) use ($hostHashes, $url): void {
                $query->where(function ($hostQuery) use ($hostHashes): void {
                    $hostQuery->where('match_type', 'host')
                        ->whereIn('value_hash', $hostHashes);
                })->orWhere(function ($urlQuery) use ($url): void {
                    $urlQuery->where('match_type', 'url')
                        ->where('value_hash', BlockedTarget::fingerprint($url));
                });
            })
            ->exists();
    }

    private function isGoJetHost(string $host): bool
    {
        $appHost = Str::lower((string) parse_url((string) config('app.url'), PHP_URL_HOST));
        $defaultHost = Str::lower((string) config('gojet.default_host'));

        return in_array($host, array_filter([$appHost, $defaultHost]), true)
            || Domain::query()->where('hostname', $host)->whereNotNull('verified_at')->exists();
    }

    private function isPrivateHost(string $host): bool
    {
        if (in_array($host, ['localhost', 'localhost.localdomain'], true)
            || Str::endsWith($host, ['.local', '.localhost', '.internal'])) {
            return true;
        }

        if (! filter_var($host, FILTER_VALIDATE_IP)) {
            return false;
        }

        return ! filter_var(
            $host,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        );
    }
}
