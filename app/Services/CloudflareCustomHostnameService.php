<?php

namespace App\Services;

use App\Models\Domain;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class CloudflareCustomHostnameService
{
    public function enabled(): bool
    {
        return (bool) config('gojet.cloudflare.enabled')
            && filled(config('gojet.cloudflare.api_token'))
            && filled(config('gojet.cloudflare.zone_id'));
    }

    public function provision(Domain $domain): void
    {
        if (! $this->enabled()) {
            $domain->forceFill([
                'certificate_status' => 'external',
                'provisioning_error' => null,
            ])->save();

            return;
        }

        $response = $this->client()->post($this->endpoint(), [
            'hostname' => $domain->hostname,
            'ssl' => [
                'method' => 'http',
                'type' => 'dv',
                'settings' => [
                    'min_tls_version' => '1.2',
                    'tls_1_3' => 'on',
                ],
                'wildcard' => false,
            ],
        ]);

        if (! $response->successful() || ! $response->json('success')) {
            throw new RuntimeException($this->errorMessage($response->json()));
        }

        $domain->forceFill([
            'cloudflare_hostname_id' => $response->json('result.id'),
            'certificate_status' => $response->json('result.ssl.status', 'pending_validation'),
            'provisioning_error' => null,
        ])->save();
    }

    public function refresh(Domain $domain): void
    {
        if (! $this->enabled() || blank($domain->cloudflare_hostname_id)) {
            return;
        }

        $response = $this->client()->get($this->endpoint('/'.$domain->cloudflare_hostname_id));

        if (! $response->successful() || ! $response->json('success')) {
            throw new RuntimeException($this->errorMessage($response->json()));
        }

        $domain->forceFill([
            'certificate_status' => $response->json('result.ssl.status', 'unknown'),
            'provisioning_error' => null,
        ])->save();
    }

    public function remove(Domain $domain): void
    {
        if (! $this->enabled() || blank($domain->cloudflare_hostname_id)) {
            return;
        }

        $response = $this->client()->delete($this->endpoint('/'.$domain->cloudflare_hostname_id));

        if (! $response->successful() || ! $response->json('success')) {
            throw new RuntimeException($this->errorMessage($response->json()));
        }
    }

    private function client(): PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->withToken((string) config('gojet.cloudflare.api_token'))
            ->timeout(15)
            ->retry(2, 250, throw: false);
    }

    private function endpoint(string $suffix = ''): string
    {
        return sprintf(
            'https://api.cloudflare.com/client/v4/zones/%s/custom_hostnames%s',
            config('gojet.cloudflare.zone_id'),
            $suffix,
        );
    }

    private function errorMessage(array $payload): string
    {
        $message = collect($payload['errors'] ?? [])
            ->pluck('message')
            ->filter()
            ->implode('; ');

        return $message !== '' ? $message : 'Cloudflare custom hostname request failed.';
    }
}
