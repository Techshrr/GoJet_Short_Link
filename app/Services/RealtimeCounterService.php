<?php

namespace App\Services;

use Illuminate\Support\Facades\Redis;
use Throwable;

class RealtimeCounterService
{
    public function pendingFor(int $linkId): int
    {
        try {
            $values = Redis::hmget('gojet:realtime:'.$linkId, 'ingested', 'persisted');
            $ingested = (int) ($values[0] ?? 0);
            $persisted = (int) ($values[1] ?? 0);

            return max(0, $ingested - $persisted);
        } catch (Throwable) {
            return 0;
        }
    }

    public function markPersisted(int $linkId): void
    {
        try {
            Redis::hincrby('gojet:realtime:'.$linkId, 'persisted', 1);
            Redis::expire('gojet:realtime:'.$linkId, 604800);
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
