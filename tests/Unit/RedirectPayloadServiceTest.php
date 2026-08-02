<?php

namespace Tests\Unit;

use App\Models\Link;
use App\Services\RedirectPayloadService;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

class RedirectPayloadServiceTest extends TestCase
{
    public function test_forget_is_a_no_op_when_redirect_plane_is_disabled(): void
    {
        config()->set('gojet.redirect_plane.enabled', false);
        Redis::shouldReceive('del')->never();

        app(RedirectPayloadService::class)->forget($this->link());
    }

    public function test_forget_deletes_the_shared_redirect_payload_key(): void
    {
        config()->set('gojet.redirect_plane.enabled', true);
        Redis::shouldReceive('del')
            ->once()
            ->with('gojet:redirect:gojet.cc:abc123');

        app(RedirectPayloadService::class)->forget($this->link());
    }

    private function link(): Link
    {
        return new Link([
            'host' => 'GoJet.CC',
            'slug' => 'abc123',
            'target_url' => 'https://example.com',
        ]);
    }
}
