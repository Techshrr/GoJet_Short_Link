<?php

namespace App\Jobs;

use App\Models\ProfileFeedSource;
use App\Services\ProfileFeedService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RefreshProfileFeed implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [120, 600];

    public function __construct(public int $sourceId) {}

    public function handle(ProfileFeedService $feeds): void
    {
        $source = ProfileFeedSource::find($this->sourceId);
        if ($source?->is_active) {
            $feeds->refresh($source);
        }
    }
}
