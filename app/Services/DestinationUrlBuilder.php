<?php

namespace App\Services;

class DestinationUrlBuilder
{
    /**
     * Build a destination URL without clobbering query parameters already set by the owner.
     * Destination query wins, then stored UTM values, then incoming visitor parameters.
     */
    public function build(string $targetUrl, array $utm = [], array $incoming = []): string
    {
        $stored = array_filter([
            'utm_source' => $utm['source'] ?? $utm['utm_source'] ?? null,
            'utm_medium' => $utm['medium'] ?? $utm['utm_medium'] ?? null,
            'utm_campaign' => $utm['campaign'] ?? $utm['utm_campaign'] ?? null,
            'utm_content' => $utm['content'] ?? $utm['utm_content'] ?? null,
            'utm_term' => $utm['term'] ?? $utm['utm_term'] ?? null,
        ], fn ($value): bool => is_scalar($value) && (string) $value !== '');

        $parts = parse_url($targetUrl);
        if ($parts === false || ! isset($parts['scheme'], $parts['host'])) {
            return $targetUrl;
        }

        parse_str($parts['query'] ?? '', $query);
        foreach ($stored as $key => $value) {
            if (! array_key_exists($key, $query)) {
                $query[$key] = (string) $value;
            }
        }
        foreach ($incoming as $key => $value) {
            if (! is_string($key) || $key === '' || array_key_exists($key, $query)) {
                continue;
            }
            if (is_scalar($value)) {
                $query[$key] = (string) $value;
            } elseif (is_array($value)) {
                $query[$key] = array_values(array_filter($value, 'is_scalar'));
            }
        }

        $authority = ($parts['user'] ?? '') !== ''
            ? ($parts['user'].(isset($parts['pass']) ? ':'.$parts['pass'] : '').'@')
            : '';
        $authority .= $parts['host'];
        if (isset($parts['port'])) {
            $authority .= ':'.$parts['port'];
        }

        return $parts['scheme'].'://'.$authority
            .($parts['path'] ?? '')
            .($query !== [] ? '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986) : '')
            .(isset($parts['fragment']) ? '#'.$parts['fragment'] : '');
    }
}
