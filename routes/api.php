<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\ConversionController;
use App\Http\Controllers\Api\DomainController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\LinkController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\RoutingController;
use App\Http\Controllers\Api\TextController;
use App\Http\Controllers\Api\WebhookController;
use App\Http\Controllers\InternalRedirectController;
use Illuminate\Support\Facades\Route;

Route::prefix('internal/v1')->middleware('throttle:1200,1')->group(function (): void {
    Route::post('/click', [InternalRedirectController::class, 'click']);
});

Route::prefix('v1')->middleware('throttle:240,1')->group(function (): void {
    Route::get('/links', [LinkController::class, 'index'])->middleware('api.token:links:read')->middleware('feature:links');
    Route::post('/links', [LinkController::class, 'store'])->middleware('api.token:links:write')->middleware('feature:links');
    Route::get('/links/{link}', [LinkController::class, 'show'])->middleware('api.token:links:read')->middleware('feature:links');
    Route::patch('/links/{link}', [LinkController::class, 'update'])->middleware('api.token:links:write')->middleware('feature:links');
    Route::delete('/links/{link}', [LinkController::class, 'destroy'])->middleware('api.token:links:write')->middleware('feature:links');

    Route::get('/links/{link}/routing', [RoutingController::class, 'index'])->middleware('api.token:links:read')->middleware('feature:smart_routing');
    Route::post('/links/{link}/destinations', [RoutingController::class, 'storeDestination'])->middleware('api.token:links:write')->middleware('feature:smart_routing');
    Route::patch('/links/{link}/destinations/{destination}', [RoutingController::class, 'updateDestination'])->middleware('api.token:links:write')->middleware('feature:smart_routing');
    Route::delete('/links/{link}/destinations/{destination}', [RoutingController::class, 'destroyDestination'])->middleware('api.token:links:write')->middleware('feature:smart_routing');
    Route::post('/links/{link}/rules', [RoutingController::class, 'storeRule'])->middleware('api.token:links:write')->middleware('feature:smart_routing');
    Route::patch('/links/{link}/rules/{rule}', [RoutingController::class, 'updateRule'])->middleware('api.token:links:write')->middleware('feature:smart_routing');
    Route::delete('/links/{link}/rules/{rule}', [RoutingController::class, 'destroyRule'])->middleware('api.token:links:write')->middleware('feature:smart_routing');

    Route::get('/analytics', [AnalyticsController::class, 'workspace'])->middleware('api.token:analytics:read')->middleware('feature:links');
    Route::get('/links/{link}/analytics', [AnalyticsController::class, 'link'])->middleware('api.token:analytics:read')->middleware('feature:links');
    Route::get('/links/{link}/conversions', [ConversionController::class, 'index'])->middleware('api.token:analytics:read')->middleware('feature:links');
    Route::post('/links/{link}/conversions', [ConversionController::class, 'store'])->middleware('api.token:conversions:write')->middleware('feature:links');

    Route::get('/domains', [DomainController::class, 'index'])->middleware('api.token:domains:read');
    Route::post('/domains', [DomainController::class, 'store'])->middleware('api.token:domains:write');
    Route::get('/domains/{domain}', [DomainController::class, 'show'])->middleware('api.token:domains:read');
    Route::post('/domains/{domain}/verify', [DomainController::class, 'verify'])->middleware('api.token:domains:write');
    Route::post('/domains/{domain}/refresh', [DomainController::class, 'refresh'])->middleware('api.token:domains:write');
    Route::patch('/domains/{domain}/default', [DomainController::class, 'setDefault'])->middleware('api.token:domains:write');
    Route::delete('/domains/{domain}', [DomainController::class, 'destroy'])->middleware('api.token:domains:write');

    Route::get('/texts', [TextController::class, 'index'])->middleware('api.token:texts:read')->middleware('feature:texts');
    Route::post('/texts', [TextController::class, 'store'])->middleware('api.token:texts:write')->middleware('feature:texts');
    Route::get('/texts/{textShare}', [TextController::class, 'show'])->middleware('api.token:texts:read')->middleware('feature:texts');
    Route::patch('/texts/{textShare}', [TextController::class, 'update'])->middleware('api.token:texts:write')->middleware('feature:texts');
    Route::delete('/texts/{textShare}', [TextController::class, 'destroy'])->middleware('api.token:texts:write')->middleware('feature:texts');

    Route::get('/files', [FileController::class, 'index'])->middleware('api.token:files:read')->middleware('feature:files');
    Route::post('/files', [FileController::class, 'store'])->middleware('api.token:files:write')->middleware('feature:files');
    Route::get('/files/{fileShare}', [FileController::class, 'show'])->middleware('api.token:files:read')->middleware('feature:files');
    Route::patch('/files/{fileShare}', [FileController::class, 'update'])->middleware('api.token:files:write')->middleware('feature:files');
    Route::delete('/files/{fileShare}', [FileController::class, 'destroy'])->middleware('api.token:files:write')->middleware('feature:files');

    Route::get('/profiles', [ProfileController::class, 'index'])->middleware('api.token:profiles:read')->middleware('feature:profiles');
    Route::post('/profiles', [ProfileController::class, 'store'])->middleware('api.token:profiles:write')->middleware('feature:profiles');
    Route::get('/profiles/{profilePage}', [ProfileController::class, 'show'])->middleware('api.token:profiles:read')->middleware('feature:profiles');
    Route::patch('/profiles/{profilePage}', [ProfileController::class, 'update'])->middleware('api.token:profiles:write')->middleware('feature:profiles');
    Route::delete('/profiles/{profilePage}', [ProfileController::class, 'destroy'])->middleware('api.token:profiles:write')->middleware('feature:profiles');
    Route::post('/profiles/{profilePage}/blocks', [ProfileController::class, 'storeBlock'])->middleware('api.token:profiles:write')->middleware('feature:profiles');
    Route::patch('/profiles/{profilePage}/blocks/{block}', [ProfileController::class, 'updateBlock'])->middleware('api.token:profiles:write')->middleware('feature:profiles');
    Route::delete('/profiles/{profilePage}/blocks/{block}', [ProfileController::class, 'destroyBlock'])->middleware('api.token:profiles:write')->middleware('feature:profiles');

    Route::get('/webhooks', [WebhookController::class, 'index'])->middleware('api.token:webhooks:read')->middleware('feature:webhooks');
    Route::post('/webhooks', [WebhookController::class, 'store'])->middleware('api.token:webhooks:write')->middleware('feature:webhooks');
    Route::get('/webhooks/{webhook}', [WebhookController::class, 'show'])->middleware('api.token:webhooks:read')->middleware('feature:webhooks');
    Route::patch('/webhooks/{webhook}', [WebhookController::class, 'update'])->middleware('api.token:webhooks:write')->middleware('feature:webhooks');
    Route::delete('/webhooks/{webhook}', [WebhookController::class, 'destroy'])->middleware('api.token:webhooks:write')->middleware('feature:webhooks');
    Route::post('/webhooks/{webhook}/test', [WebhookController::class, 'test'])->middleware('api.token:webhooks:write')->middleware('feature:webhooks');
    Route::post('/webhook-deliveries/{delivery}/retry', [WebhookController::class, 'retry'])->middleware('api.token:webhooks:write')->middleware('feature:webhooks');
});
