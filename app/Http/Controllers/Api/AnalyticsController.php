<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClickEvent;
use App\Models\Link;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function workspace(Request $request): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $days = min(365, max(1, $request->integer('days', 30)));
        $from = now()->subDays($days - 1)->startOfDay();
        $linkIds = Link::where('workspace_id', $workspace->id)->pluck('id');
        $events = ClickEvent::whereIn('link_id', $linkIds)->where('occurred_at', '>=', $from);

        return response()->json([
            'data' => [
                'period_days' => $days,
                'clicks' => (clone $events)->count(),
                'human_clicks' => (clone $events)->where('is_bot', false)->count(),
                'unique_visitors' => (clone $events)->where('is_bot', false)->distinct('ip_hash')->count('ip_hash'),
                'qr_scans' => (clone $events)->where('visit_type', 'qr')->count(),
                'links' => $linkIds->count(),
                'trend' => (clone $events)->selectRaw('DATE(occurred_at) date, COUNT(*) clicks, COUNT(DISTINCT CASE WHEN is_bot = 0 THEN ip_hash END) unique_visitors')->groupByRaw('DATE(occurred_at)')->orderBy('date')->get(),
                'countries' => $this->dimension(clone $events, 'country_code'),
                'devices' => $this->dimension(clone $events, 'device_type'),
                'browsers' => $this->dimension(clone $events, 'browser'),
                'referrers' => $this->dimension(clone $events, 'referrer_host'),
                'utm_sources' => $this->dimension(clone $events, 'utm_source'),
                'utm_campaigns' => $this->dimension(clone $events, 'utm_campaign'),
            ],
        ]);
    }

    public function link(Request $request, Link $link): JsonResponse
    {
        abort_unless($link->workspace_id === $request->attributes->get('workspace')?->id, 404);
        $days = min(365, max(1, $request->integer('days', 30)));
        $from = now()->subDays($days - 1)->startOfDay();
        $events = $link->clickEvents()->where('occurred_at', '>=', $from);

        return response()->json(['data' => [
            'link_id' => $link->id,
            'period_days' => $days,
            'clicks' => (clone $events)->count(),
            'unique_visitors' => (clone $events)->where('is_bot', false)->distinct('ip_hash')->count('ip_hash'),
            'bots' => (clone $events)->where('is_bot', true)->count(),
            'qr_scans' => (clone $events)->where('visit_type', 'qr')->count(),
            'destinations' => (clone $events)->select('destination_id', DB::raw('COUNT(*) aggregate'))->groupBy('destination_id')->orderByDesc('aggregate')->get(),
            'countries' => $this->dimension(clone $events, 'country_code'),
            'regions' => $this->dimension(clone $events, 'region'),
            'cities' => $this->dimension(clone $events, 'city'),
            'devices' => $this->dimension(clone $events, 'device_type'),
            'platforms' => $this->dimension(clone $events, 'platform'),
            'browsers' => $this->dimension(clone $events, 'browser'),
            'languages' => $this->dimension(clone $events, 'language'),
            'referrers' => $this->dimension(clone $events, 'referrer_host'),
        ]]);
    }

    private function dimension($query, string $column): array
    {
        return $query->where('is_bot', false)->whereNotNull($column)->where($column, '!=', '')
            ->select($column, DB::raw('COUNT(*) aggregate'))->groupBy($column)->orderByDesc('aggregate')->limit(25)->get()
            ->map(fn ($row) => ['label' => (string) $row->{$column}, 'value' => (int) $row->aggregate])->all();
    }
}
