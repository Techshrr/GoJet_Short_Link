<?php

namespace App\Http\Middleware;

use App\Services\SiteConfiguration;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceSiteMaintenance
{
    public function __construct(private readonly SiteConfiguration $configuration) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('gojet.installed') || $request->is('install/*') || $request->is('up') || $request->is('api/internal/*')) {
            return $next($request);
        }

        $maintenance = $this->configuration->group('maintenance.policy', config('gojet.maintenance', []));
        if (! ($maintenance['enabled'] ?? false)) {
            return $next($request);
        }

        $adminPath = trim((string) config('gojet.admin_path', 'manage'), '/');
        if (($maintenance['allow_admin'] ?? true) && ($request->user()?->is_admin || $request->is($adminPath.'*'))) {
            return $next($request);
        }
        if (($maintenance['allow_login'] ?? true) && $request->is('login', 'logout', 'forgot-password', 'reset-password/*')) {
            return $next($request);
        }

        $retryAfter = max(60, (int) ($maintenance['retry_after'] ?? 900));

        return response()
            ->view('pages.maintenance', ['maintenance' => $maintenance], 503)
            ->header('Retry-After', (string) $retryAfter)
            ->header('Cache-Control', 'no-store');
    }
}
