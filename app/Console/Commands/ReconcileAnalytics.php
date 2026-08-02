<?php

namespace App\Console\Commands;

use App\Models\AnalyticsIngestFailure;
use App\Models\ClickEvent;
use App\Models\Link;
use App\Models\LinkDailyStat;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReconcileAnalytics extends Command
{
    protected $signature = 'gojet:analytics:reconcile
        {--link= : Only reconcile one link ID}
        {--from= : Rebuild daily aggregates from this date; defaults to retention window}
        {--dry-run : Report differences without changing records}';

    protected $description = 'Reconcile persisted click events, link counters, daily aggregates, and resolved ingest failures.';

    public function handle(): int
    {
        $from = $this->option('from')
            ? Carbon::parse((string) $this->option('from'))->startOfDay()
            : now()->subDays((int) config('gojet.click_retention_days', 90))->startOfDay();
        $dryRun = (bool) $this->option('dry-run');
        $linkId = $this->option('link') ? (int) $this->option('link') : null;
        $changes = ['links' => 0, 'daily_stats' => 0, 'failures' => 0];

        $query = Link::withTrashed()->select(['id', 'clicks_count'])->orderBy('id');
        if ($linkId) {
            $query->whereKey($linkId);
        }

        $query->chunkById(200, function ($links) use ($from, $dryRun, &$changes): void {
            foreach ($links as $link) {
                $persisted = ClickEvent::query()->where('link_id', $link->id)->count();
                // Event retention may remove old details, so reconciliation never reduces the all-time counter.
                if ($persisted > (int) $link->clicks_count) {
                    $changes['links']++;
                    if (! $dryRun) {
                        Link::withTrashed()->whereKey($link->id)->update(['clicks_count' => $persisted]);
                    }
                }

                $daily = ClickEvent::query()
                    ->where('link_id', $link->id)
                    ->where('occurred_at', '>=', $from)
                    ->selectRaw('DATE(occurred_at) as event_date, COUNT(*) as clicks, SUM(CASE WHEN is_unique = 1 THEN 1 ELSE 0 END) as unique_clicks')
                    ->groupBy(DB::raw('DATE(occurred_at)'))
                    ->get();

                foreach ($daily as $row) {
                    $existing = LinkDailyStat::query()->where([
                        'link_id' => $link->id,
                        'date' => $row->event_date,
                    ])->first();
                    $expectedClicks = (int) $row->clicks;
                    $expectedUnique = (int) $row->unique_clicks;
                    if (! $existing || $existing->clicks !== $expectedClicks || $existing->unique_clicks !== $expectedUnique) {
                        $changes['daily_stats']++;
                        if (! $dryRun) {
                            LinkDailyStat::query()->updateOrCreate(
                                ['link_id' => $link->id, 'date' => $row->event_date],
                                ['clicks' => $expectedClicks, 'unique_clicks' => $expectedUnique],
                            );
                        }
                    }
                }
            }
        });

        $resolvedIds = AnalyticsIngestFailure::query()
            ->whereNull('resolved_at')
            ->whereNotNull('event_uuid')
            ->whereExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('click_events')
                    ->whereColumn('click_events.event_uuid', 'analytics_ingest_failures.event_uuid');
            })
            ->pluck('id');
        $changes['failures'] = $resolvedIds->count();
        if (! $dryRun && $resolvedIds->isNotEmpty()) {
            AnalyticsIngestFailure::query()->whereKey($resolvedIds)->update(['resolved_at' => now()]);
        }

        $mode = $dryRun ? 'DRY RUN' : 'APPLIED';
        $this->line(json_encode([
            'mode' => $mode,
            'from' => $from->toDateString(),
            'link_counters_adjusted' => $changes['links'],
            'daily_aggregates_adjusted' => $changes['daily_stats'],
            'ingest_failures_resolved' => $changes['failures'],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return self::SUCCESS;
    }
}
