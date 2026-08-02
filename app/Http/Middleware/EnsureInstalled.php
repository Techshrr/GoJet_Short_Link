<?php

namespace App\Http\Middleware;

use App\Services\InstallationState;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInstalled
{
    public function __construct(private readonly InstallationState $state) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($this->state->installed() || $request->routeIs('install.*', 'locale.switch') || $request->is('up')) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'message' => __('installer.not_installed'),
                'install_url' => route('install.welcome'),
            ], 503);
        }

        return redirect()->route('install.welcome');
    }
}
