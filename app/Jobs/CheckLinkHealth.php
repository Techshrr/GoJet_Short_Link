<?php

namespace App\Jobs;

use App\Models\Link;
use App\Services\UrlSafetyService;
use DOMDocument;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class CheckLinkHealth implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [60, 300];

    public function __construct(public int $linkId) {}

    public function handle(UrlSafetyService $safety): void
    {
        $link = Link::withTrashed()->find($this->linkId);
        if (! $link || $link->trashed() || $link->archived_at) {
            return;
        }

        try {
            $url = $safety->normalizeAndValidate($link->target_url);
            $response = Http::withoutRedirecting()
                ->connectTimeout(5)
                ->timeout(12)
                ->withHeaders([
                    'User-Agent' => 'GoJet-Link-Health/1.0',
                    'Accept' => 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5',
                    'Range' => 'bytes=0-262143',
                ])
                ->get($url);

            $status = $response->status();
            $healthy = $status >= 200 && $status < 400;
            $metadata = $this->metadata($url, $response->header('Content-Type'), $response->body());
            $link->forceFill([
                'health_status' => $healthy ? 'healthy' : 'unhealthy',
                'health_http_status' => $status,
                'health_error' => $healthy ? null : 'HTTP '.$status,
                'last_health_checked_at' => now(),
                'preview_title' => $metadata['title'],
                'preview_description' => $metadata['description'],
                'preview_image_url' => $metadata['image'],
                'favicon_url' => $metadata['favicon'],
            ])->saveQuietly();
        } catch (InvalidArgumentException $exception) {
            $this->failedState($link, 'blocked', $exception->getMessage());
        } catch (Throwable $exception) {
            $this->failedState($link, 'error', Str::limit($exception->getMessage(), 2000));
            throw $exception;
        }
    }

    private function failedState(Link $link, string $status, string $error): void
    {
        $link->forceFill([
            'health_status' => $status,
            'health_http_status' => null,
            'health_error' => $error,
            'last_health_checked_at' => now(),
        ])->saveQuietly();
    }

    private function metadata(string $baseUrl, ?string $contentType, string $body): array
    {
        $empty = ['title' => null, 'description' => null, 'image' => null, 'favicon' => null];
        if (! is_string($contentType) || ! str_contains(strtolower($contentType), 'html')) {
            return $empty;
        }

        $body = mb_substr($body, 0, 262144);
        $dom = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        $loaded = $dom->loadHTML('<?xml encoding="utf-8" ?>'.$body, LIBXML_NONET | LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (! $loaded) {
            return $empty;
        }

        $title = trim((string) ($dom->getElementsByTagName('title')->item(0)?->textContent ?? ''));
        $description = null;
        $image = null;
        foreach ($dom->getElementsByTagName('meta') as $meta) {
            $name = strtolower((string) ($meta->getAttribute('name') ?: $meta->getAttribute('property')));
            $content = trim($meta->getAttribute('content'));
            if ($description === null && in_array($name, ['description', 'og:description', 'twitter:description'], true)) {
                $description = $content;
            }
            if ($image === null && in_array($name, ['og:image', 'twitter:image'], true)) {
                $image = $this->absoluteUrl($baseUrl, $content);
            }
            if ($title === '' && in_array($name, ['og:title', 'twitter:title'], true)) {
                $title = $content;
            }
        }

        $favicon = null;
        foreach ($dom->getElementsByTagName('link') as $link) {
            $rel = strtolower($link->getAttribute('rel'));
            if (str_contains($rel, 'icon')) {
                $favicon = $this->absoluteUrl($baseUrl, trim($link->getAttribute('href')));
                break;
            }
        }

        return [
            'title' => Str::limit($title, 255, ''),
            'description' => Str::limit((string) $description, 1000, '') ?: null,
            'image' => $image,
            'favicon' => $favicon ?: $this->absoluteUrl($baseUrl, '/favicon.ico'),
        ];
    }

    private function absoluteUrl(string $base, string $value): ?string
    {
        if ($value === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $value)) {
            return $value;
        }
        $parts = parse_url($base);
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }
        $origin = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
        if (str_starts_with($value, '//')) {
            return $parts['scheme'].':'.$value;
        }
        if (str_starts_with($value, '/')) {
            return $origin.$value;
        }
        $directory = isset($parts['path']) ? rtrim(str_replace('\\', '/', dirname($parts['path'])), '/') : '';

        return $origin.($directory !== '' && $directory !== '.' ? '/'.ltrim($directory, '/') : '').'/'.$value;
    }
}
