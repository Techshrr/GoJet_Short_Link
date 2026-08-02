<?php

namespace App\Http\Controllers;

use App\Jobs\DeliverWebhook;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use App\Services\UrlSafetyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use InvalidArgumentException;

class WebhookController extends Controller
{
    private const EVENTS = ['link.created', 'link.updated', 'link.deleted', 'link.clicked', 'text.created', 'file.created', 'profile.published', 'domain.verified', 'conversion.created'];

    public function index(Request $request): View
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $webhooks = Webhook::where('workspace_id', $workspace->id)->with(['deliveries' => fn ($query) => $query->latest()->limit(10)])->latest()->get();

        return view('webhooks.index', compact('workspace', 'webhooks'));
    }

    public function store(Request $request, UrlSafetyService $safety): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'url' => ['required', 'url:http,https', 'max:2048'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['string', Rule::in(array_merge(['*'], self::EVENTS))],
        ]);
        try {
            $data['url'] = $safety->normalizeAndValidate($data['url']);
        } catch (InvalidArgumentException $exception) {
            return back()->withErrors(['url' => $exception->getMessage()])->withInput();
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

        return back()->with('status', __('v3.webhook_created'))->with('webhook_secret', ['id' => $webhook->id, 'secret' => $secret]);
    }

    public function update(Request $request, Webhook $webhook, UrlSafetyService $safety): RedirectResponse
    {
        $this->authorizeWebhook($request, $webhook);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'url' => ['required', 'url:http,https', 'max:2048'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['string', Rule::in(array_merge(['*'], self::EVENTS))],
            'is_active' => ['nullable', 'boolean'],
            'rotate_secret' => ['nullable', 'boolean'],
        ]);
        try {
            $data['url'] = $safety->normalizeAndValidate($data['url']);
        } catch (InvalidArgumentException $exception) {
            return back()->withErrors(['url' => $exception->getMessage()])->withInput();
        }
        $webhook->update(['name' => $data['name'], 'url' => $data['url'], 'events' => array_values(array_unique($data['events'])), 'is_active' => $request->boolean('is_active')]);
        if ($request->boolean('rotate_secret')) {
            $secret = 'whsec_'.Str::random(48);
            $webhook->update(['secret_hash' => hash('sha256', $secret), 'secret_encrypted' => Crypt::encryptString($secret)]);

            return back()->with('status', __('v3.webhook_updated'))->with('webhook_secret', ['id' => $webhook->id, 'secret' => $secret]);
        }

        return back()->with('status', __('v3.webhook_updated'));
    }

    public function destroy(Request $request, Webhook $webhook): RedirectResponse
    {
        $this->authorizeWebhook($request, $webhook);
        $webhook->delete();

        return back()->with('status', __('v3.webhook_deleted'));
    }

    public function test(Request $request, Webhook $webhook): RedirectResponse
    {
        $this->authorizeWebhook($request, $webhook);
        $delivery = $webhook->deliveries()->create([
            'event_id' => (string) Str::uuid(),
            'event_name' => 'webhook.test',
            'payload' => ['event' => 'webhook.test', 'created_at' => now()->toIso8601String(), 'data' => ['workspace_id' => $webhook->workspace_id]],
            'attempt' => 0,
            'status' => 'pending',
        ]);
        DeliverWebhook::dispatch($delivery->id);

        return back()->with('status', __('v3.webhook_test_queued'));
    }

    public function retry(Request $request, WebhookDelivery $delivery): RedirectResponse
    {
        $delivery->load('webhook');
        $this->authorizeWebhook($request, $delivery->webhook);
        $delivery->update(['status' => 'pending', 'next_attempt_at' => null]);
        DeliverWebhook::dispatch($delivery->id);

        return back()->with('status', __('v3.webhook_retry_queued'));
    }

    private function authorizeWebhook(Request $request, Webhook $webhook): void
    {
        abort_unless($request->user()->is_admin || $request->user()->currentWorkspace()?->id === $webhook->workspace_id, 403);
    }
}
