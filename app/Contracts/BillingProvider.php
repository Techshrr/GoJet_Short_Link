<?php

namespace App\Contracts;

use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Workspace;

interface BillingProvider
{
    public function code(): string;

    /**
     * Create a provider checkout or a safe pending/manual subscription.
     *
     * @return array{subscription: Subscription, invoice: Invoice, checkout_url: ?string}
     */
    public function subscribe(
        Workspace $workspace,
        Plan $plan,
        string $interval,
        ?string $couponCode = null,
    ): array;

    public function approve(Subscription $subscription): void;

    public function cancel(Subscription $subscription): void;
}
