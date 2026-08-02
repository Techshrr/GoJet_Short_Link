<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Models\Link;
use App\Models\Tag;
use App\Services\QuotaService;
use App\Services\ShortCodeGenerator;
use App\Services\UrlSafetyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class LinkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $links = Link::where('workspace_id', $workspace->id)
            ->with(['domain:id,hostname', 'campaign:id,name', 'folder:id,name', 'tags:id,name,color'])
            ->when($request->filled('q'), fn ($query) => $query->where(fn ($nested) => $nested->where('title', 'like', '%'.$request->string('q').'%')->orWhere('slug', 'like', '%'.$request->string('q').'%')->orWhere('target_url', 'like', '%'.$request->string('q').'%')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->latest()
            ->paginate(min(100, max(1, $request->integer('per_page', 50))));

        return response()->json($links);
    }

    public function store(Request $request, ShortCodeGenerator $codes, UrlSafetyService $safety, QuotaService $quotas): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $quotas->ensureCanCreate($workspace, 'links');
        $data = $request->validate([
            'target_url' => ['required', 'string', 'max:4096'],
            'slug' => ['nullable', 'string', 'min:3', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
            'title' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:4000'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'domain_id' => ['nullable', 'integer'],
            'campaign_id' => ['nullable', 'integer'],
            'folder_id' => ['nullable', 'integer'],
            'tag_ids' => ['nullable', 'array', 'max:20'],
            'tag_ids.*' => ['integer'],
            'redirect_type' => ['nullable', Rule::in([301, 302, 307, 308])],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'max_clicks' => ['nullable', 'integer', 'min:1'],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'utm' => ['nullable', 'array'],
            'qr_settings' => ['nullable', 'array'],
        ]);
        try {
            $data['target_url'] = $safety->normalizeAndValidate($data['target_url']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => ['target_url' => [$e->getMessage()]]], 422);
        }

        $domain = ! empty($data['domain_id']) ? Domain::where('workspace_id', $workspace->id)->whereKey($data['domain_id'])->firstOrFail() : null;
        if ($domain) {
            abort_unless($domain->isUsable(), 422, 'The selected domain is not active and verified.');
        }
        $host = $domain?->hostname ?: strtolower((string) config('gojet.default_host'));
        $slug = $data['slug'] ?? $codes->generate($domain?->id);
        if (in_array(Str::lower($slug), config('gojet.reserved_slugs', []), true)) {
            return response()->json(['message' => 'The requested short code is reserved.'], 422);
        }
        if (Link::withTrashed()->where('host', $host)->where('slug', $slug)->exists()) {
            return response()->json(['message' => 'The requested short code is already in use.'], 409);
        }

        $link = $request->user()->links()->create([
            'workspace_id' => $workspace->id,
            'domain_id' => $domain?->id,
            'campaign_id' => $data['campaign_id'] ?? null,
            'folder_id' => $data['folder_id'] ?? null,
            'host' => $host,
            'slug' => $slug,
            'target_url' => $data['target_url'],
            'title' => $data['title'] ?? null,
            'description' => $data['description'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => 'active',
            'redirect_type' => $data['redirect_type'] ?? config('gojet.default_redirect_type'),
            'starts_at' => $data['starts_at'] ?? null,
            'expires_at' => $data['expires_at'] ?? $this->defaultExpiration(),
            'max_clicks' => $data['max_clicks'] ?? null,
            'password_hash' => filled($data['password'] ?? null) ? Hash::make($data['password']) : null,
            'utm_parameters' => $data['utm'] ?? [],
            'qr_settings' => $data['qr_settings'] ?? [],
        ]);
        if (($data['tag_ids'] ?? []) !== []) {
            $link->tags()->sync(Tag::where('workspace_id', $workspace->id)->whereIn('id', $data['tag_ids'])->pluck('id'));
        }

        return response()->json(['data' => $link->load(['domain', 'campaign', 'folder', 'tags']), 'short_url' => $link->shortUrl()], 201);
    }

    public function show(Request $request, Link $link): JsonResponse
    {
        $this->authorizeWorkspace($request, $link);

        return response()->json(['data' => $link->load(['domain:id,hostname', 'campaign', 'folder', 'tags', 'destinations.rules'])]);
    }

    public function update(Request $request, Link $link, UrlSafetyService $safety): JsonResponse
    {
        $this->authorizeWorkspace($request, $link);
        $data = $request->validate([
            'target_url' => ['sometimes', 'required', 'string', 'max:4096'],
            'title' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:4000'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'status' => ['sometimes', Rule::in(['active', 'disabled'])],
            'redirect_type' => ['sometimes', Rule::in([301, 302, 307, 308])],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date'],
            'max_clicks' => ['nullable', 'integer', 'min:1'],
            'utm' => ['nullable', 'array'],
            'qr_settings' => ['nullable', 'array'],
            'tag_ids' => ['nullable', 'array', 'max:20'],
            'tag_ids.*' => ['integer'],
        ]);
        if (isset($data['target_url'])) {
            try {
                $data['target_url'] = $safety->normalizeAndValidate($data['target_url']);
            } catch (InvalidArgumentException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }
        if (array_key_exists('utm', $data)) {
            $data['utm_parameters'] = $data['utm'];
            unset($data['utm']);
        }
        if (isset($data['tag_ids'])) {
            $tagIds = $data['tag_ids'];
            unset($data['tag_ids']);
            $link->tags()->sync(Tag::where('workspace_id', $link->workspace_id)->whereIn('id', $tagIds)->pluck('id'));
        }
        $link->update($data);

        return response()->json(['data' => $link->fresh()->load(['domain', 'campaign', 'folder', 'tags'])]);
    }

    public function destroy(Request $request, Link $link): JsonResponse
    {
        $this->authorizeWorkspace($request, $link);
        $link->delete();

        return response()->json(status: 204);
    }

    private function authorizeWorkspace(Request $request, Link $link): void
    {
        abort_unless($link->workspace_id === $request->attributes->get('workspace')?->id, 404);
    }

    private function defaultExpiration(): ?Carbon
    {
        $days = config('gojet.links.default_expiration_days');

        return filled($days) ? now()->addDays((int) $days) : null;
    }
}
