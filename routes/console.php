<?php

use App\Models\ClickEvent;
use Illuminate\Support\Facades\Schedule;

Schedule::command('queue:prune-failed --hours=168')->daily();
Schedule::call(function (): void {
    ClickEvent::query()
        ->where('occurred_at', '<', now()->subDays((int) config('gojet.click_retention_days')))
        ->delete();
})->dailyAt('03:30')->name('prune-click-events')->withoutOverlapping();

Schedule::command('gojet:analytics:reconcile')
    ->dailyAt('04:00')
    ->when(fn (): bool => (bool) config('gojet.analytics.reconciliation_enabled', true))
    ->name('reconcile-analytics')
    ->withoutOverlapping();
