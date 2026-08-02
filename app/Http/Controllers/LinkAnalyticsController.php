<?php

namespace App\Http\Controllers;

use App\Models\ClickEvent;
use App\Models\Link;
use App\Services\RealtimeCounterService;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LinkAnalyticsController extends Controller
{
    public function show(Request $request, Link $link, RealtimeCounterService $realtime): View
    {
        $this->authorizeViewer($request, $link);

        $days = $this->days($request);
        $from = now()->startOfDay()->subDays($days - 1);
        $events = $link->clickEvents()->where('occurred_at', '>=', $from);
        $pending = $realtime->pendingFor($link->id);

        $summary = [
            'clicks' => (clone $events)->count() + $pending,
            'human_clicks' => (clone $events)->where('is_bot', false)->count(),
            'unique_clicks' => (clone $events)->where('is_unique', true)->count(),
            'bot_clicks' => (clone $events)->where('is_bot', true)->count(),
            'qr_clicks' => (clone $events)->where('visit_type', 'qr')->count(),
            'all_time_clicks' => (int) $link->clicks_count + $pending,
            'pending_clicks' => $pending,
            'conversion_rate' => 0,
        ];

        $conversionCount = $link->conversionEvents()->where('occurred_at', '>=', $from)->count();
        if ($summary['human_clicks'] > 0) {
            $summary['conversion_rate'] = round(($conversionCount / $summary['human_clicks']) * 100, 2);
        }

        $trendRows = $link->dailyStats()
            ->where('date', '>=', $from->toDateString())
            ->orderBy('date')
            ->get()
            ->keyBy(fn ($row): string => $row->date->toDateString());

        $trend = collect(range(0, $days - 1))->map(function (int $offset) use ($from, $trendRows): array {
            $date = $from->copy()->addDays($offset)->toDateString();
            $row = $trendRows->get($date);

            return [
                'date' => $date,
                'clicks' => (int) ($row?->clicks ?? 0),
                'unique_clicks' => (int) ($row?->unique_clicks ?? 0),
            ];
        });

        $recentEvents = (clone $events)
            ->with('destination:id,name,target_url')
            ->latest('occurred_at')
            ->limit(50)
            ->get();

        return view('links.show', [
            'link' => $link->load(['domain', 'campaign', 'folder', 'tags', 'destinations']),
            'days' => $days,
            'summary' => $summary,
            'trend' => $trend,
            'recentEvents' => $recentEvents,
            'dimensions' => [
                'referrer_types' => $this->dimension($events, 'referrer_type'),
                'source_channels' => $this->dimension($events, 'source_channel'),
                'referrers' => $this->referrers($events),
                'devices' => $this->dimension($events, 'device_type'),
                'browsers' => $this->dimension($events, 'browser'),
                'platforms' => $this->dimension($events, 'platform'),
                'countries' => $this->dimension($events, 'country_code'),
                'regions' => $this->dimension($events, 'region'),
                'cities' => $this->dimension($events, 'city'),
                'languages' => $this->dimension($events, 'language'),
                'utm_sources' => $this->dimension($events, 'utm_source'),
                'destinations' => $this->destinationDimension($events),
            ],
            'shortUrl' => $link->shortUrl(),
            'canManage' => $request->user()->is_admin || in_array(
                (string) $request->attributes->get('workspace_role'),
                ['owner', 'admin', 'editor'],
                true,
            ),
        ]);
    }

    public function export(Request $request, Link $link): StreamedResponse
    {
        $this->authorizeViewer($request, $link);
        $days = $this->days($request);
        $from = now()->startOfDay()->subDays($days - 1);
        $filename = sprintf('gojet-%s-%s.csv', $link->slug, now()->format('Ymd-His'));

        return response()->streamDownload(function () use ($link, $from): void {
            $output = fopen('php://output', 'wb');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, [
                'event_uuid', 'occurred_at', 'visitor_hash', 'country_code', 'region', 'city', 'device_type',
                'browser', 'platform', 'language', 'referrer_type', 'source_channel', 'referrer_host',
                'referrer_url', 'utm_source', 'utm_medium', 'utm_campaign', 'visit_type', 'is_unique',
                'is_bot', 'ingestion_source', 'destination_id', 'response_ms',
            ]);

            $link->clickEvents()
                ->where('occurred_at', '>=', $from)
                ->orderBy('id')
                ->cursor()
                ->each(function (ClickEvent $event) use ($output): void {
                    fputcsv($output, [
                        $event->event_uuid, $event->occurred_at?->toIso8601String(), substr($event->ip_hash, 0, 16),
                        $event->country_code, $event->region, $event->city, $event->device_type,
                        $event->browser, $event->platform, $event->language, $event->referrer_type,
                        $event->source_channel, $event->referrer_host, $event->referrer_url,
                        $event->utm_source, $event->utm_medium, $event->utm_campaign, $event->visit_type,
                        $event->is_unique ? '1' : '0', $event->is_bot ? '1' : '0', $event->ingestion_source,
                        $event->destination_id, $event->response_ms,
                    ]);
                });

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function dimension(HasMany $events, string $column): array
    {
        return (clone $events)
            ->where('is_bot', false)
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->select($column, DB::raw('COUNT(*) as aggregate'))
            ->groupBy($column)
            ->orderByDesc('aggregate')
            ->limit(10)
            ->get()
            ->map(fn ($row): array => [
                'label' => (string) $row->{$column},
                'value' => (int) $row->aggregate,
            ])
            ->all();
    }

    private function destinationDimension(HasMany $events): array
    {
        return (clone $events)
            ->where('is_bot', false)
            ->leftJoin('link_destinations', 'click_events.destination_id', '=', 'link_destinations.id')
            ->selectRaw("COALESCE(link_destinations.name, '默认目标') as destination_label, COUNT(*) as aggregate")
            ->groupBy('destination_label')
            ->orderByDesc('aggregate')
            ->limit(10)
            ->get()
            ->map(fn ($row): array => ['label' => (string) $row->destination_label, 'value' => (int) $row->aggregate])
            ->all();
    }

    private function referrers(HasMany $events): array
    {
        $labels = [
            'direct' => '直接访问',
            'unknown' => '来源格式未知',
            'internal' => '站内跳转',
        ];
        $rows = [];
        foreach ($labels as $type => $label) {
            $value = (clone $events)->where('is_bot', false)->where('referrer_type', $type)->count();
            if ($value > 0) {
                $rows[] = ['label' => $label, 'value' => $value];
            }
        }

        foreach ($this->dimension($events, 'referrer_host') as $row) {
            $rows[] = $row;
        }

        usort($rows, fn (array $a, array $b): int => $b['value'] <=> $a['value']);

        return array_slice($rows, 0, 10);
    }

    private function days(Request $request): int
    {
        $days = (int) $request->integer('days', 30);

        return in_array($days, [1, 7, 30, 90, 365], true) ? $days : 30;
    }

    private function authorizeViewer(Request $request, Link $link): void
    {
        if ($request->user()->is_admin) {
            return;
        }

        $workspace = $request->attributes->get('workspace') ?? $request->user()->currentWorkspace();
        abort_unless($workspace && (int) $link->workspace_id === (int) $workspace->id, 404);
    }
}
