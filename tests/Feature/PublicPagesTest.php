<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PublicPagesTest extends TestCase
{
    use RefreshDatabase;

    #[DataProvider('publicPages')]
    public function test_public_pages_are_reachable(string $path, int $status = 200): void
    {
        $this->get($path)->assertStatus($status);
    }

    public static function publicPages(): array
    {
        return [
            ['/', 200],
            ['/product', 200],
            ['/features/url-shortener', 200],
            ['/features/analytics', 200],
            ['/features/qr-codes', 200],
            ['/features/ab-testing', 200],
            ['/features/custom-domains', 200],
            ['/features/smart-routing', 200],
            ['/features/link-in-bio', 200],
            ['/features/text-sharing', 200],
            ['/features/file-sharing', 200],
            ['/solutions/marketing', 200],
            ['/solutions/creators', 200],
            ['/solutions/teams', 200],
            ['/solutions/qr-campaigns', 200],
            ['/pricing', 200],
            ['/blog', 200],
            ['/browser-extension', 200],
            ['/apps', 200],
            ['/developers', 200],
            ['/api-docs', 200],
            ['/status', 200],
            ['/changelog', 200],
            ['/about', 200],
            ['/privacy', 200],
            ['/terms', 200],
            ['/acceptable-use', 200],
            ['/contact', 200],
            ['/login', 200],
            ['/register', 200],
            ['/forgot-password', 200],
        ];
    }

    public function test_locked_product_routes_redirect_to_canonical_pages(): void
    {
        $this->get('/products/url-shortener')->assertRedirect('/features/url-shortener');
        $this->get('/products/qr-code')->assertRedirect('/features/qr-codes');
        $this->get('/products/analytics')->assertRedirect('/features/analytics');
        $this->get('/products/custom-domain')->assertRedirect('/features/custom-domains');
        $this->get('/products/ab-testing')->assertRedirect('/features/ab-testing');
    }
}
