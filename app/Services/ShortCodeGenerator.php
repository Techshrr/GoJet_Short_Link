<?php

namespace App\Services;

use App\Models\Link;
use Illuminate\Support\Str;
use RuntimeException;

class ShortCodeGenerator
{
    private const ALPHABET = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

    public function generate(?int $domainId = null, ?int $length = null): string
    {
        $length ??= max(4, (int) config('gojet.short_code_length', 7));

        for ($attempt = 0; $attempt < 20; $attempt++) {
            $slug = collect(range(1, $length))
                ->map(fn () => self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)])
                ->implode('');

            $exists = Link::query()
                ->where('domain_id', $domainId)
                ->where('slug', $slug)
                ->exists();

            if (! $exists && ! in_array(Str::lower($slug), config('gojet.reserved_slugs', []), true)) {
                return $slug;
            }
        }

        throw new RuntimeException('Unable to allocate a unique short code.');
    }
}
