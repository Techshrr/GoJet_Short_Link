<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConversionEvent;
use App\Models\Link;
use App\Models\LinkDestination;
use App\Services\WebhookDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ConversionController extends Controller
{
    public function store(Request $request, Link $link, WebhookDispatcher $webhooks): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        abort_unless($link->workspace_id === $workspace?->id, 404);
        $data = $request->validate([
            'event_name' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9._-]+$/'],
            'destination_id' => ['nullable', 'integer'],
            'visitor_key' => ['nullable', 'string', 'max:190'],
            'value' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'currency' => ['nullable', 'string', 'size:3'],
            'metadata' => ['nullable', 'array'],
            'occurred_at' => ['nullable', 'date'],
        ]);
        $destination = isset($data['destination_id']) ? LinkDestination::where('link_id', $link->id)->findOrFail($data['destination_id']) : null;
        $event = ConversionEvent::create([
            'link_id' => $link->id,
            'destination_id' => $destination?->id,
            'event_name' => $data['event_name'],
            'visitor_key' => filled($data['visitor_key'] ?? null) ? hash_hmac('sha256', $data['visitor_key'], (string) config('gojet.ip_hash_key')) : null,
            'value' => $data['value'] ?? null,
            'currency' => isset($data['currency']) ? Str::upper($data['currency']) : null,
            'metadata' => $data['metadata'] ?? null,
            'occurred_at' => $data['occurred_at'] ?? now(),
        ]);
        $webhooks->dispatch($workspace->id, 'conversion.created', [
            'id' => $event->id,
            'link_id' => $link->id,
            'destination_id' => $destination?->id,
            'event_name' => $event->event_name,
            'value' => $event->value,
            'currency' => $event->currency,
            'occurred_at' => $event->occurred_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $event], 201);
    }

    public function index(Request $request, Link $link): JsonResponse
    {
        abort_unless($link->workspace_id === $request->attributes->get('workspace')?->id, 404);

        return response()->json($link->conversionEvents()
            ->when($request->filled('event_name'), fn ($query) => $query->where('event_name', $request->string('event_name')))
            ->latest('occurred_at')
            ->paginate(min(100, max(1, $request->integer('per_page', 50)))));
    }
}
