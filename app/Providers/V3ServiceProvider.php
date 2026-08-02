<?php

namespace App\Providers;

use App\Contracts\BillingProvider;
use App\Contracts\MalwareScanner;
use App\Jobs\CheckLinkHealth;
use App\Jobs\ScanFileShare;
use App\Models\Domain;
use App\Models\FileShare;
use App\Models\Link;
use App\Models\ProfilePage;
use App\Models\TextShare;
use App\Services\BillingManager;
use App\Services\ClamAvMalwareScanner;
use App\Services\ManualBillingProvider;
use App\Services\NullMalwareScanner;
use App\Services\RedirectPayloadService;
use App\Services\SiteConfiguration;
use App\Services\WebhookDispatcher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Throwable;

class V3ServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(SiteConfiguration::class);

        $this->app->singleton(MalwareScanner::class, function (): MalwareScanner {
            if ((string) env('GOJET_MALWARE_SCANNER', 'none') === 'clamav') {
                return new ClamAvMalwareScanner(
                    (string) env('CLAMAV_HOST', '127.0.0.1'),
                    (int) env('CLAMAV_PORT', 3310),
                    (int) env('CLAMAV_TIMEOUT', 20),
                );
            }

            return new NullMalwareScanner;
        });

        $this->app->singleton(BillingManager::class, function ($app): BillingManager {
            $manager = new BillingManager;
            $manager->extend($app->make(ManualBillingProvider::class));

            return $manager;
        });
        $this->app->bind(BillingProvider::class, fn ($app): BillingProvider => $app->make(BillingManager::class)->provider());
    }

    public function boot(SiteConfiguration $configuration): void
    {
        $this->applyStoredSettings($configuration);

        View::composer('*', function ($view) use ($configuration): void {
            $view->with('siteConfig', config('gojet.site') ? [
                'identity' => config('gojet.site.identity', []),
                'branding' => config('gojet.site.branding', []),
                'seo' => config('gojet.site.seo', []),
                'legal' => config('gojet.site.legal', []),
            ] : $configuration->all());
        });

        Link::saved(function (Link $link): void {
            if ($link->wasRecentlyCreated || $link->wasChanged('target_url')) {
                CheckLinkHealth::dispatch($link->id)->afterCommit()->onQueue('default');
            }

            app(RedirectPayloadService::class)->publish($link);

            $event = $link->wasRecentlyCreated ? 'link.created' : 'link.updated';
            $this->afterCommitWebhook($link->workspace_id, $event, [
                'id' => $link->id,
                'host' => $link->host,
                'slug' => $link->slug,
                'target_url' => $link->target_url,
                'status' => $link->status,
            ]);
        });
        Link::deleted(function (Link $link): void {
            app(RedirectPayloadService::class)->forget($link);
            $this->afterCommitWebhook($link->workspace_id, 'link.deleted', [
                'id' => $link->id,
                'host' => $link->host,
                'slug' => $link->slug,
            ]);
        });

        TextShare::created(fn (TextShare $share) => $this->afterCommitWebhook($share->workspace_id, 'text.created', [
            'id' => $share->id,
            'slug' => $share->slug,
            'visibility' => $share->visibility,
        ]));
        FileShare::created(function (FileShare $share): void {
            if (config('gojet.storage.malware_scan', false)) {
                ScanFileShare::dispatch($share->id)->afterCommit()->onQueue('default');
            }
            $this->afterCommitWebhook($share->workspace_id, 'file.created', [
                'id' => $share->id,
                'slug' => $share->slug,
                'name' => $share->original_name,
                'size_bytes' => $share->size_bytes,
            ]);
        });
        ProfilePage::saved(function (ProfilePage $profile): void {
            if ($profile->wasChanged('status') && $profile->status === 'published') {
                $this->afterCommitWebhook($profile->workspace_id, 'profile.published', [
                    'id' => $profile->id,
                    'slug' => $profile->slug,
                    'title' => $profile->title,
                ]);
            }
        });
        Domain::saved(function (Domain $domain): void {
            if ($domain->wasChanged('verified_at') && $domain->verified_at) {
                $this->afterCommitWebhook($domain->workspace_id, 'domain.verified', [
                    'id' => $domain->id,
                    'hostname' => $domain->hostname,
                ]);
            }
        });
    }

    private function afterCommitWebhook(?int $workspaceId, string $event, array $payload): void
    {
        if (! $workspaceId) {
            return;
        }
        DB::afterCommit(fn () => app(WebhookDispatcher::class)->dispatch($workspaceId, $event, $payload));
    }

    private function applyStoredSettings(SiteConfiguration $configuration): void
    {
        if (! config('gojet.installed')) {
            return;
        }

        try {
            if (! Schema::hasTable('system_settings')) {
                return;
            }

            $configuration->apply();
        } catch (Throwable) {
            // Installation and migration commands must remain bootable before the settings table exists.
        }
    }
}
