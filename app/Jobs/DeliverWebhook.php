<?php

namespace App\Jobs;

use App\Models\WebhookDelivery;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class DeliverWebhook implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public array $backoff = [30, 120, 600, 1800];

    public function __construct(public int $deliveryId) {}

    public function handle(): void
    {
        $delivery = WebhookDelivery::with('webhook')->find($this->deliveryId);
        if (! $delivery || ! $delivery->webhook?->is_active) {
            return;
        }

        $webhook = $delivery->webhook;
        $payload = json_encode($delivery->payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $secret = Crypt::decryptString($webhook->secret_encrypted);
        $timestamp = (string) now()->timestamp;
        $signature = hash_hmac('sha256', $timestamp.'.'.$payload, $secret);
        $attempt = $delivery->attempt + 1;
        $delivery->update(['attempt' => $attempt, 'status' => 'sending']);

        $response = Http::timeout(12)
            ->connectTimeout(5)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'User-Agent' => 'GoJet-Webhooks/1.0',
                'X-GoJet-Event' => $delivery->event_name,
                'X-GoJet-Event-ID' => $delivery->event_id,
                'X-GoJet-Timestamp' => $timestamp,
                'X-GoJet-Signature' => 'sha256='.$signature,
            ])
            ->withBody($payload, 'application/json')
            ->post($webhook->url);

        $delivery->update([
            'response_status' => $response->status(),
            'response_body' => mb_substr($response->body(), 0, 10000),
            'status' => $response->successful() ? 'delivered' : 'failed',
            'delivered_at' => $response->successful() ? now() : null,
            'next_attempt_at' => $response->successful() ? null : now()->addSeconds($this->backoff[min($attempt - 1, count($this->backoff) - 1)]),
        ]);

        if ($response->successful()) {
            $webhook->update(['last_success_at' => now()]);

            return;
        }

        $webhook->update(['last_failure_at' => now()]);
        throw new RuntimeException('Webhook endpoint returned HTTP '.$response->status());
    }

    public function failed(?Throwable $exception): void
    {
        WebhookDelivery::whereKey($this->deliveryId)->update(['status' => 'failed', 'next_attempt_at' => null]);
    }
}
