<?php

namespace Tests\Unit;

use App\Services\UrlSafetyService;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class UrlSafetyServiceTest extends TestCase
{
    #[DataProvider('unsafeUrls')]
    public function test_rejects_unsafe_targets(string $url): void
    {
        $this->expectException(InvalidArgumentException::class);

        app(UrlSafetyService::class)->normalizeAndValidate($url);
    }

    public static function unsafeUrls(): array
    {
        return [
            ['javascript:alert(1)'],
            ['file:///etc/passwd'],
            ['http://127.0.0.1/admin'],
            ['http://169.254.169.254/latest/meta-data'],
            ['http://localhost/internal'],
        ];
    }
}
