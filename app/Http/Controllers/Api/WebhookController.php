<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\DeliverWebhook;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use App\Services\UrlSafetyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class WebhookController extends Controller
{
    private const EVENTS = ['link.created', 'link.updated', 'link.deleted', 'link.clicked', 'text.created', 'file.created', 'profile.published', 'domain.verified', 'conversion.created'];

    public function index(Request $request): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');

        return response()->json(Webhook::where('workspace_id', $workspace->id)->withCount('deliveries')->latest()->paginate(min(100, max(1, $request->integer('per_page', 50)))));
    }

    public function store(Request $request, UrlSafetyService $safety): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'url' => ['required', 'url:http,https', 'max:2048'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['string', Rule::in(array_merge(['*'], self::EVENTS))],
        ]);
        try {
            $data['url'] = $safety->normalizeAndValidate($data['url']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        $secret = 'whsec_'.Str::random(48);
        $webhook = Webhook::create([
            'workspace_id' => $workspace->id,
            'name' => $data['name'],
            'url' => $data['url'],
            'secret_hash' => hash('sha256', $secret),
            'secret_encrypted' => Crypt::encryptString($secret),
            'events' => array_values(array_unique($data['events'])),
            'is_active' => true,
        ]);

        return response()->json(['data' => $webhook, 'secret' => $secret], 201);
    }

    public function show(Request $request, Webhook $webhook): JsonResponse
    {
        $this->authorize($request, $webhook);

        return response()->json(['data' => $webhook->load(['deliveries' => fn ($query) => $query->latest()->limit(50)])]);
    }

    public function update(Request $request, Webhook $webhook, UrlSafetyService $safety): JsonResponse
    {
        $this->authorize($request, $webhook);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'url' => ['sometimes', 'required', 'url:http,https', 'max:2048'],
            'events' => ['sometimes', 'array', 'min:1'],
            'events.*' => ['string', Rule::in(array_merge(['*'], self::EVENTS))],
            'is_active' => ['sometimes', 'boolean'],
            'rotate_secret' => ['nullable', 'boolean'],
        ]);
        if (isset($data['url'])) {
            try {
                $data['url'] = $safety->normalizeAndValidate($data['url']);
            } catch (InvalidArgumentException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }
        $rotate = (bool) ($data['rotate_secret'] ?? false);
        unset($data['rotate_secret']);
        $webhook->update($data);
        $secret = null;
        if ($rotate) {
            $secret = 'whsec_'.Str::random(48);
            $webhook->update(['secret_hash' => hash('sha256', $secret), 'secret_encrypted' => Crypt::encryptString($secret)]);
        }

        return response()->json(['data' => $webhook->fresh(), 'secret' => $secret]);
    }

    public function destroy(Request $request, Webhook $webhook): JsonResponse
    {
        $this->authorize($request, $webhook);
        $webhook->delete();

        return response()->json(status: 204);
    }

    public function test(Request $request, Webhook $webhook): JsonResponse
    {
        $this->authorize($request, $webhook);
        $delivery = $webhook->deliveries()->create([
            'event_id' => (string) Str::uuid(),
            'event_name' => 'webhook.test',
            'payload' => ['event' => 'webhook.test', 'created_at' => now()->toIso8601String(), 'data' => ['workspace_id' => $webhook->workspace_id]],
            'attempt' => 0,
            'status' => 'pending',
        ]);
        DeliverWebhook::dispatch($delivery->id);

        return response()->json(['data' => $delivery], 202);
    }

    public function retry(Request $request, WebhookDelivery $delivery): JsonResponse
    {
        $delivery->load('webhook');
        $this->authorize($request, $delivery->webhook);
        $delivery->update(['status' => 'pending', 'next_attempt_at' => null]);
        DeliverWebhook::dispatch($delivery->id);

        return response()->json(['data' => $delivery->fresh()], 202);
    }

    private function authorize(Request $request, Webhook $webhook): void
    {
        abort_unless($webhook->workspace_id === $request->attributes->get('workspace')?->id, 404);
    }
}
