<?php

namespace App\Http\Controllers;

use App\Models\ClickEvent;
use App\Models\Link;
use App\Services\AnalyticsRecorder;
use App\Services\RedirectPayloadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InternalRedirectController extends Controller
{
    public function show(Request $request, RedirectPayloadService $payloads): JsonResponse
    {
        $this->authorizeInternal($request);

        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'slug' => ['required', 'regex:/^[A-Za-z0-9_-]{3,64}$/'],
        ]);

        $link = Link::query()
            ->with('domain')
            ->where('host', strtolower($data['host']))
            ->where('slug', $data['slug'])
            ->first();

        if (! $link || ($link->domain_id && ! $link->domain?->isUsable())) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json($payloads->payload($link));
    }

    public function click(Request $request, AnalyticsRecorder $recorder): JsonResponse
    {
        $this->authorizeInternal($request);

        $data = $request->validate([
            'event_uuid' => ['required', 'uuid'],
            'link_id' => ['required', 'integer', 'min:1'],
            'occurred_at' => ['required', 'date'],
            'ip' => ['nullable', 'ip'],
            'forwarded_for' => ['nullable', 'string', 'max:1000'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'region' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'language' => ['nullable', 'string', 'max:20'],
            'user_agent' => ['nullable', 'string', 'max:1000'],
            'referrer' => ['nullable', 'string', 'max:2048'],
            'request_id' => ['nullable', 'string', 'max:120'],
            'query' => ['nullable', 'array'],
            'query.*' => ['nullable', 'string', 'max:500'],
        ]);

        if (ClickEvent::query()->where('event_uuid', $data['event_uuid'])->exists()) {
            return response()->json(['status' => 'duplicate'], 409);
        }

        $link = Link::query()->find($data['link_id']);
        if (! $link) {
            return response()->json(['message' => 'Link not found'], 404);
        }

        $event = $recorder->record($link, $data, 'go_spool');
        if (! $event) {
            return response()->json(['message' => 'Persistence failed'], 503);
        }

        return response()->json([
            'status' => 'persisted',
            'event_uuid' => $event->event_uuid,
        ], 201);
    }

    private function authorizeInternal(Request $request): void
    {
        $expected = (string) config('gojet.redirect_plane.internal_token');
        $provided = (string) $request->bearerToken();
        abort_unless($expected !== '' && hash_equals($expected, $provided), 403);
    }
}
