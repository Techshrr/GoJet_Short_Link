<?php

use App\Http\Middleware\AuthenticateApiToken;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\EnsureFeatureEnabled;
use App\Http\Middleware\EnsureInstalled;
use App\Http\Middleware\EnsureWorkspaceAccess;
use App\Http\Middleware\EnforceSiteMaintenance;
use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->web(append: [SetLocale::class, EnsureInstalled::class, EnforceSiteMaintenance::class]);
        $middleware->api(prepend: [EnsureInstalled::class]);
        $middleware->alias([
            'api.token' => AuthenticateApiToken::class,
            'admin' => EnsureAdmin::class,
            'feature' => EnsureFeatureEnabled::class,
            'workspace.access' => EnsureWorkspaceAccess::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Centralized exception reporting hooks belong here.
    })->create();
