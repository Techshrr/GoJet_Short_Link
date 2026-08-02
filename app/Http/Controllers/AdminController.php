<?php

namespace App\Http\Controllers;

use App\Models\AbuseReport;
use App\Models\AnalyticsIngestFailure;
use App\Models\AuditLog;
use App\Models\BlockedTarget;
use App\Models\ClickEvent;
use App\Models\Domain;
use App\Models\EmailDeliveryLog;
use App\Models\Link;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\View\View;

class AdminController extends Controller
{
    public function index(): View
    {
        $today = now()->startOfDay();
        $queueFailed = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0;

        return view('admin', [
            'totals' => [
                'users' => User::count(),
                'workspaces' => Workspace::count(),
                'links' => Link::count(),
                'clicks' => (int) Link::sum('clicks_count'),
                'today_clicks' => ClickEvent::where('occurred_at', '>=', $today)->count(),
                'domains' => Domain::whereNotNull('verified_at')->count(),
                'reports' => AbuseReport::where('status', 'open')->count(),
                'mail_failures' => EmailDeliveryLog::where('status', 'failed')->where('created_at', '>=', now()->subDay())->count(),
            ],
            'health' => [
                'active_users' => User::where('status', 'active')->count(),
                'active_links' => Link::where('status', 'active')->whereNull('archived_at')->count(),
                'analytics_failures' => AnalyticsIngestFailure::whereNull('resolved_at')->count(),
                'queue_failures' => $queueFailed,
            ],
            'latestLinks' => Link::with(['user:id,email', 'workspace:id,name'])->latest()->limit(12)->get(),
            'reports' => AbuseReport::with(['link', 'resolver:id,name,email'])->where('status', 'open')->latest()->limit(8)->get(),
            'blockedTargets' => BlockedTarget::with('creator:id,name,email')->latest()->limit(10)->get(),
            'auditLogs' => AuditLog::with('actor:id,name,email')->latest('created_at')->limit(20)->get(),
            'trend' => ClickEvent::query()
                ->where('occurred_at', '>=', now()->subDays(13)->startOfDay())
                ->selectRaw('DATE(occurred_at) as date, COUNT(*) as clicks, SUM(CASE WHEN is_unique = 1 THEN 1 ELSE 0 END) as unique_clicks')
                ->groupBy('date')
                ->orderBy('date')
                ->get(),
        ]);
    }

    public function toggleLink(Request $request, Link $link, AuditLogger $audit): RedirectResponse
    {
        $link->update(['status' => $link->status === 'active' ? 'disabled' : 'active']);
        $audit->record('admin.link_status_changed', $link, ['status' => $link->status], $request);

        return back()->with('status', __('messages.admin_link_updated'));
    }
}
