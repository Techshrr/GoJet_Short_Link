<?php

namespace App\Services;

use App\Models\ProfileFeedSource;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use InvalidArgumentException;
use SimpleXMLElement;
use Throwable;

class ProfileFeedService
{
    public function __construct(private readonly UrlSafetyService $safety) {}

    public function refresh(ProfileFeedSource $source): array
    {
        try {
            $items = match ($source->adapter) {
                'rss' => $this->rss((string) $source->source_url),
                'github' => $this->github((string) data_get($source->configuration, 'username')),
                'mastodon' => $this->rss(rtrim((string) $source->source_url, '/').'.rss'),
                'youtube' => $this->rss('https://www.youtube.com/feeds/videos.xml?channel_id='.rawurlencode((string) data_get($source->configuration, 'channel_id'))),
                'json' => $this->jsonFeed((string) $source->source_url),
                default => throw new InvalidArgumentException('Unsupported profile feed adapter.'),
            };
            $source->update(['cached_items' => array_slice($items, 0, 12), 'status' => 'active', 'last_error' => null, 'last_refreshed_at' => now()]);

            return $items;
        } catch (Throwable $exception) {
            $source->update(['status' => 'error', 'last_error' => Str::limit($exception->getMessage(), 2000), 'last_refreshed_at' => now()]);
            throw $exception;
        }
    }

    private function rss(string $url): array
    {
        $body = $this->fetch($url, 'application/rss+xml, application/atom+xml, application/xml, text/xml');
        $xml = @simplexml_load_string($body, SimpleXMLElement::class, LIBXML_NONET | LIBXML_NOCDATA);
        if (! $xml) {
            throw new InvalidArgumentException('The feed response is not valid XML.');
        }

        $items = [];
        if (isset($xml->channel->item)) {
            foreach ($xml->channel->item as $entry) {
                $items[] = $this->item((string) $entry->title, (string) $entry->link, strip_tags((string) ($entry->description ?? '')), (string) ($entry->pubDate ?? ''), null);
            }
        } else {
            foreach ($xml->entry ?? [] as $entry) {
                $link = '';
                foreach ($entry->link as $candidate) {
                    $attributes = $candidate->attributes();
                    if ((string) ($attributes['rel'] ?? 'alternate') === 'alternate') {
                        $link = (string) ($attributes['href'] ?? $candidate);
                        break;
                    }
                }
                $items[] = $this->item((string) $entry->title, $link, strip_tags((string) ($entry->summary ?? $entry->content ?? '')), (string) ($entry->published ?? $entry->updated ?? ''), null);
            }
        }

        return array_values(array_filter($items, fn (array $item) => $item['title'] !== '' && $item['url'] !== ''));
    }

    private function github(string $username): array
    {
        if (! preg_match('/^[A-Za-z0-9-]{1,39}$/', $username)) {
            throw new InvalidArgumentException('A valid GitHub username is required.');
        }
        $response = Http::withoutRedirecting()->timeout(12)->withHeaders(['Accept' => 'application/vnd.github+json', 'User-Agent' => 'GoJet-Profile-Feeds/1.0'])->get('https://api.github.com/users/'.$username.'/repos', ['sort' => 'updated', 'per_page' => 12]);
        $response->throw();

        return collect($response->json())->map(fn (array $repo) => $this->item(
            (string) ($repo['name'] ?? ''),
            (string) ($repo['html_url'] ?? ''),
            (string) ($repo['description'] ?? ''),
            (string) ($repo['pushed_at'] ?? ''),
            null,
        ))->all();
    }

    private function jsonFeed(string $url): array
    {
        $payload = json_decode($this->fetch($url, 'application/feed+json, application/json'), true, flags: JSON_THROW_ON_ERROR);

        return collect($payload['items'] ?? [])->take(12)->map(fn (array $entry) => $this->item(
            (string) ($entry['title'] ?? ''),
            (string) ($entry['url'] ?? $entry['external_url'] ?? ''),
            strip_tags((string) ($entry['summary'] ?? $entry['content_text'] ?? $entry['content_html'] ?? '')),
            (string) ($entry['date_published'] ?? $entry['date_modified'] ?? ''),
            (string) ($entry['image'] ?? $entry['banner_image'] ?? ''),
        ))->all();
    }

    private function fetch(string $url, string $accept): string
    {
        $url = $this->safety->normalizeAndValidate($url);
        $response = Http::withoutRedirecting()->connectTimeout(5)->timeout(12)->withHeaders(['Accept' => $accept, 'User-Agent' => 'GoJet-Profile-Feeds/1.0'])->get($url);
        $response->throw();

        return mb_substr($response->body(), 0, 1048576);
    }

    private function item(string $title, string $url, string $summary, string $publishedAt, ?string $image): array
    {
        return [
            'title' => Str::limit(trim($title), 240, ''),
            'url' => trim($url),
            'summary' => Str::limit(trim($summary), 600, ''),
            'published_at' => $publishedAt,
            'image' => $image ?: null,
        ];
    }
}
