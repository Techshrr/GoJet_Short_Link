<?php

namespace App\Services;

use App\Jobs\DeliverWebhook;
use App\Models\Webhook;
use Illuminate\Support\Str;

class WebhookDispatcher
{
    public function dispatch(int $workspaceId, string $event, array $payload): void
    {
        Webhook::where('workspace_id', $workspaceId)
            ->where('is_active', true)
            ->get()
            ->filter(fn (Webhook $webhook): bool => in_array('*', $webhook->events ?? [], true) || in_array($event, $webhook->events ?? [], true))
            ->each(function (Webhook $webhook) use ($event, $payload): void {
                $delivery = $webhook->deliveries()->create([
                    'event_id' => (string) Str::uuid(),
                    'event_name' => $event,
                    'payload' => ['event' => $event, 'created_at' => now()->toIso8601String(), 'data' => $payload],
                    'attempt' => 0,
                    'status' => 'pending',
                ]);
                DeliverWebhook::dispatch($delivery->id)->onQueue('default');
            });
    }
}
