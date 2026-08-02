<?php

namespace App\Services;

use App\Contracts\BillingProvider;
use InvalidArgumentException;

class BillingManager
{
    /** @var array<string, BillingProvider> */
    private array $providers = [];

    public function extend(BillingProvider $provider): void
    {
        $this->providers[$provider->code()] = $provider;
    }

    public function provider(?string $code = null): BillingProvider
    {
        $code ??= (string) config('gojet.billing_provider', 'manual');
        if (! isset($this->providers[$code])) {
            throw new InvalidArgumentException("Billing provider [{$code}] is not registered.");
        }

        return $this->providers[$code];
    }

    /** @return list<string> */
    public function available(): array
    {
        return array_keys($this->providers);
    }
}
