<?php

namespace App\Services;

use App\Models\FileShare;
use App\Models\Plan;
use App\Models\ProfilePage;
use App\Models\TextShare;
use App\Models\Workspace;
use Illuminate\Validation\ValidationException;

class QuotaService
{
    public function plan(Workspace $workspace): ?Plan
    {
        $subscription = $workspace->subscriptions()->with('plan')->latest()->get()->first(fn ($item): bool => $item->isUsable());

        return $subscription?->plan ?? Plan::where('code', $workspace->plan_code)->where('is_active', true)->first();
    }

    public function limit(Workspace $workspace, string $resource): int
    {
        return (int) data_get($this->plan($workspace)?->limits, $resource, 0);
    }

    public function usage(Workspace $workspace, string $resource): int
    {
        return match ($resource) {
            'links' => $workspace->links()->withTrashed()->count(),
            'domains' => $workspace->domains()->count(),
            'texts' => $workspace->hasMany(TextShare::class)->withTrashed()->count(),
            'files' => $workspace->hasMany(FileShare::class)->withTrashed()->count(),
            'profiles' => $workspace->hasMany(ProfilePage::class)->withTrashed()->count(),
            'members' => $workspace->members()->whereIn('status', ['active', 'invited'])->count(),
            'storage_mb' => (int) ceil($workspace->hasMany(FileShare::class)->sum('size_bytes') / 1048576),
            default => 0,
        };
    }

    public function ensureCanCreate(Workspace $workspace, string $resource, int $amount = 1): void
    {
        $limit = $this->limit($workspace, $resource);
        if ($limit > 0 && $this->usage($workspace, $resource) + $amount > $limit) {
            throw ValidationException::withMessages([$resource => __('v3.quota_exceeded', ['resource' => __('v3.resource_'.$resource), 'limit' => $limit])]);
        }
    }

    public function summary(Workspace $workspace): array
    {
        $resources = ['links', 'domains', 'texts', 'files', 'storage_mb', 'profiles', 'members', 'api_requests_month'];

        return collect($resources)->mapWithKeys(fn (string $resource) => [$resource => [
            'used' => $resource === 'api_requests_month' ? 0 : $this->usage($workspace, $resource),
            'limit' => $this->limit($workspace, $resource),
        ]])->all();
    }
}
