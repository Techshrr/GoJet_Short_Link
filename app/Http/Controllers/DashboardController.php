<?php

namespace App\Http\Controllers;

use App\Models\ClickEvent;
use App\Models\Link;
use App\Services\RealtimeCounterService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(Request $request, RealtimeCounterService $realtime): View
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless($workspace, 409, __('v3.workspace_required'));

        $base = Link::query()->where('workspace_id', $workspace->id)->whereNull('deleted_at');
        $recentLinks = (clone $base)->with(['domain', 'campaign'])->latest()->limit(8)->get();
        $pendingClicks = $recentLinks->sum(fn (Link $link): int => $realtime->pendingFor($link->id));
        $linkIds = (clone $base)->pluck('id');
        $today = now()->startOfDay();

        $totals = [
            'links' => (clone $base)->count(),
            'active_links' => (clone $base)->where('status', 'active')->whereNull('archived_at')->count(),
            'clicks' => (int) (clone $base)->sum('clicks_count') + $pendingClicks,
            'today_clicks' => ClickEvent::query()->whereIn('link_id', $linkIds)->where('occurred_at', '>=', $today)->count() + $pendingClicks,
            'today_unique' => ClickEvent::query()->whereIn('link_id', $linkIds)->where('occurred_at', '>=', $today)->where('is_unique', true)->count(),
            'domains' => $workspace->domains()->whereNotNull('verified_at')->where('status', 'active')->count(),
        ];

        $from = now()->startOfDay()->subDays(13);
        $rows = DB::table('link_daily_stats')
            ->join('links', 'links.id', '=', 'link_daily_stats.link_id')
            ->where('links.workspace_id', $workspace->id)
            ->whereNull('links.deleted_at')
            ->where('link_daily_stats.date', '>=', $from->toDateString())
            ->select('link_daily_stats.date', DB::raw('SUM(link_daily_stats.clicks) as clicks'), DB::raw('SUM(link_daily_stats.unique_clicks) as unique_clicks'))
            ->groupBy('link_daily_stats.date')
            ->orderBy('link_daily_stats.date')
            ->get()
            ->keyBy('date');

        $trend = collect(range(0, 13))->map(function (int $offset) use ($from, $rows): array {
            $date = $from->copy()->addDays($offset)->toDateString();
            $row = $rows->get($date);

            return [
                'date' => $date,
                'clicks' => (int) ($row->clicks ?? 0),
                'unique_clicks' => (int) ($row->unique_clicks ?? 0),
            ];
        });

        $recentEvents = ClickEvent::query()
            ->with('link:id,title,slug,host')
            ->whereIn('link_id', $linkIds)
            ->latest('occurred_at')
            ->limit(10)
            ->get();

        $topLinks = (clone $base)->orderByDesc('clicks_count')->limit(6)->get();
        $domains = $workspace->domains()->whereNotNull('verified_at')->where('status', 'active')->orderByDesc('is_default')->orderBy('hostname')->get();

        return view('dashboard', compact('workspace', 'recentLinks', 'domains', 'totals', 'trend', 'recentEvents', 'topLinks'));
    }
}
