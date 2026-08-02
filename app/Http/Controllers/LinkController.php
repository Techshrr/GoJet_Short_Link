<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Domain;
use App\Models\Folder;
use App\Models\Link;
use App\Models\Tag;
use App\Services\AuditLogger;
use App\Services\ShortCodeGenerator;
use App\Services\UrlSafetyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class LinkController extends Controller
{
    public function store(Request $request, ShortCodeGenerator $codes, UrlSafetyService $safety, AuditLogger $audit): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless($workspace, 409, __('v3.workspace_required'));
        $data = $this->validated($request, false);

        try {
            $target = $safety->normalizeAndValidate($data['target_url']);
        } catch (InvalidArgumentException $exception) {
            return back()->withErrors(['target_url' => $exception->getMessage()])->withInput();
        }

        $domain = $this->resolveDomain($request, $workspace->id, $data['domain_id'] ?? null);
        $campaign = $this->resolveCampaign($request, $workspace->id, $data['campaign_id'] ?? null);
        $folder = $this->resolveFolder($request, $workspace->id, $data['folder_id'] ?? null);
        $host = $domain?->hostname ?: strtolower((string) config('gojet.default_host'));
        $slug = $data['slug'] ?? $codes->generate($domain?->id);

        if (in_array(Str::lower($slug), config('gojet.reserved_slugs', []), true)) {
            return back()->withErrors(['slug' => __('messages.reserved_slug')])->withInput();
        }
        if (Link::withTrashed()->where('host', $host)->where('slug', $slug)->exists()) {
            return back()->withErrors(['slug' => __('messages.slug_used')])->withInput();
        }

        $link = $request->user()->links()->create([
            'workspace_id' => $workspace->id,
            'domain_id' => $domain?->id,
            'campaign_id' => $campaign?->id,
            'folder_id' => $folder?->id,
            'host' => $host,
            'slug' => $slug,
            'target_url' => $target,
            'title' => $data['title'] ?? null,
            'description' => $data['description'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => 'active',
            'redirect_type' => $data['redirect_type'] ?? config('gojet.default_redirect_type'),
            'starts_at' => $data['starts_at'] ?? null,
            'expires_at' => $data['expires_at'] ?? $this->defaultExpiration(),
            'max_clicks' => $data['max_clicks'] ?? null,
            'password_hash' => filled($data['password'] ?? null) ? Hash::make($data['password']) : null,
            'utm_parameters' => $this->utm($data),
            'qr_settings' => $this->qr($data),
        ]);
        $this->syncTags($request, $link, $workspace->id, $data['tag_ids'] ?? [], $data['new_tags'] ?? null);

        $audit->record('link.created', $link, ['host' => $link->host, 'slug' => $link->slug, 'workspace_id' => $workspace->id], $request);

        return redirect()->route('links.show', $link)->with('status', __('messages.link_created'));
    }

    public function update(Request $request, Link $link, UrlSafetyService $safety, AuditLogger $audit): RedirectResponse
    {
        $this->authorizeManager($request, $link);
        $data = $this->validated($request, true);

        try {
            $data['target_url'] = $safety->normalizeAndValidate($data['target_url']);
        } catch (InvalidArgumentException $exception) {
            return back()->withErrors(['target_url' => $exception->getMessage()])->withInput();
        }

        $workspaceId = (int) $link->workspace_id;
        $data['campaign_id'] = $this->resolveCampaign($request, $workspaceId, $data['campaign_id'] ?? null)?->id;
        $data['folder_id'] = $this->resolveFolder($request, $workspaceId, $data['folder_id'] ?? null)?->id;
        $data['utm_parameters'] = $this->utm($data);
        $data['qr_settings'] = $this->qr($data);

        if ($request->boolean('remove_password')) {
            $data['password_hash'] = null;
        } elseif (filled($data['password'] ?? null)) {
            $data['password_hash'] = Hash::make($data['password']);
        }

        $tagIds = $data['tag_ids'] ?? [];
        $newTags = $data['new_tags'] ?? null;
        unset($data['password'], $data['remove_password'], $data['tag_ids'], $data['new_tags'], $data['utm_source'], $data['utm_medium'], $data['utm_campaign'], $data['utm_content'], $data['utm_term'], $data['qr_dark'], $data['qr_light'], $data['qr_level']);
        $before = $link->only(['target_url', 'title', 'status', 'redirect_type', 'starts_at', 'expires_at', 'max_clicks', 'campaign_id', 'folder_id']);
        $link->update($data);
        $this->syncTags($request, $link, $workspaceId, $tagIds, $newTags);

        $audit->record('link.updated', $link, [
            'before' => $before,
            'changed' => array_keys($link->getChanges()),
            'administrator_override' => $request->user()->is_admin && $link->user_id !== $request->user()->id,
        ], $request);

        return back()->with('status', __('messages.link_updated'));
    }

    public function duplicate(Request $request, Link $link, ShortCodeGenerator $codes, AuditLogger $audit): RedirectResponse
    {
        $this->authorizeManager($request, $link);
        $copy = $link->replicate(['clicks_count', 'health_status', 'health_http_status', 'health_error', 'last_health_checked_at', 'preview_title', 'preview_description', 'preview_image_url', 'favicon_url', 'created_at', 'updated_at']);
        $copy->slug = $codes->generate($link->domain_id);
        $copy->title = __('v3.copy_of', ['name' => $link->title ?: $link->slug]);
        $copy->clicks_count = 0;
        $copy->status = 'active';
        $copy->archived_at = null;
        $copy->save();
        $copy->tags()->sync($link->tags()->pluck('tags.id'));
        foreach ($link->destinations as $destination) {
            $newDestination = $copy->destinations()->create($destination->only(['name', 'target_url', 'weight', 'position', 'is_fallback', 'is_active']));
            foreach ($destination->rules as $rule) {
                $copy->routingRules()->create([
                    'destination_id' => $newDestination->id,
                    'type' => $rule->type,
                    'operator' => $rule->operator,
                    'values' => $rule->values,
                    'priority' => $rule->priority,
                    'is_active' => $rule->is_active,
                ]);
            }
        }
        $audit->record('link.duplicated', $copy, ['source_link_id' => $link->id], $request);

        return redirect()->route('links.show', $copy)->with('status', __('v3.link_duplicated'));
    }

    public function archive(Request $request, Link $link): RedirectResponse
    {
        $this->authorizeManager($request, $link);
        $link->update(['archived_at' => now()]);

        return back()->with('status', __('v3.link_archived'));
    }

    public function unarchive(Request $request, Link $link): RedirectResponse
    {
        $this->authorizeManager($request, $link);
        $link->update(['archived_at' => null]);

        return back()->with('status', __('v3.link_unarchived'));
    }

    public function restore(Request $request, int $link): RedirectResponse
    {
        $model = Link::withTrashed()->findOrFail($link);
        $this->authorizeManager($request, $model);
        $model->restore();

        return back()->with('status', __('v3.link_restored'));
    }

    public function destroy(Request $request, Link $link, AuditLogger $audit): RedirectResponse
    {
        $this->authorizeManager($request, $link);
        $returnToAdmin = $request->user()->is_admin && $link->user_id !== $request->user()->id;
        $audit->record('link.trashed', $link, ['host' => $link->host, 'slug' => $link->slug, 'administrator_override' => $returnToAdmin], $request);
        $link->delete();

        return redirect()->route($returnToAdmin ? 'admin.index' : 'links.index')->with('status', __('v3.link_trashed'));
    }

    private function validated(Request $request, bool $updating): array
    {
        return $request->validate([
            'target_url' => ['required', 'string', 'max:4096'],
            'slug' => $updating ? ['sometimes'] : ['nullable', 'string', 'min:3', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
            'title' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:4000'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'domain_id' => ['nullable', 'integer'],
            'campaign_id' => ['nullable', 'integer'],
            'folder_id' => ['nullable', 'integer'],
            'tag_ids' => ['nullable', 'array', 'max:20'],
            'tag_ids.*' => ['integer'],
            'new_tags' => ['nullable', 'string', 'max:500'],
            'status' => $updating ? ['required', Rule::in(['active', 'disabled'])] : ['nullable'],
            'redirect_type' => ['nullable', Rule::in([301, 302, 307, 308])],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'max_clicks' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'remove_password' => ['nullable', 'boolean'],
            'utm_source' => ['nullable', 'string', 'max:120'],
            'utm_medium' => ['nullable', 'string', 'max:120'],
            'utm_campaign' => ['nullable', 'string', 'max:160'],
            'utm_content' => ['nullable', 'string', 'max:160'],
            'utm_term' => ['nullable', 'string', 'max:160'],
            'qr_dark' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'qr_light' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'qr_level' => ['nullable', Rule::in(['L', 'M', 'Q', 'H'])],
        ]);
    }

    private function resolveDomain(Request $request, int $workspaceId, mixed $domainId): ?Domain
    {
        if ($domainId) {
            $domain = Domain::where('workspace_id', $workspaceId)->whereKey($domainId)->firstOrFail();
            abort_unless($domain->isUsable(), 422, __('messages.domain_unusable'));

            return $domain;
        }

        return Domain::where('workspace_id', $workspaceId)->where('is_default', true)->get()->first(fn (Domain $domain): bool => $domain->isUsable());
    }

    private function resolveCampaign(Request $request, int $workspaceId, mixed $campaignId): ?Campaign
    {
        return $campaignId ? Campaign::where('workspace_id', $workspaceId)->whereKey($campaignId)->firstOrFail() : null;
    }

    private function resolveFolder(Request $request, int $workspaceId, mixed $folderId): ?Folder
    {
        return $folderId ? Folder::where('workspace_id', $workspaceId)->whereKey($folderId)->firstOrFail() : null;
    }

    private function syncTags(Request $request, Link $link, int $workspaceId, array $tagIds, ?string $newTags): void
    {
        $ids = Tag::where('workspace_id', $workspaceId)->whereIn('id', $tagIds)->pluck('id');
        $created = collect(preg_split('/[,|]/', (string) $newTags) ?: [])->map(fn ($name) => trim($name))->filter()->take(20)->map(function (string $name) use ($request, $workspaceId) {
            $slug = Str::slug($name) ?: Str::lower(Str::random(8));

            return Tag::firstOrCreate(['workspace_id' => $workspaceId, 'slug' => $slug], ['user_id' => $request->user()->id, 'name' => Str::limit($name, 80, '')])->id;
        });
        $link->tags()->sync($ids->merge($created)->unique()->values());
    }

    private function utm(array $data): array
    {
        return array_filter(['source' => $data['utm_source'] ?? null, 'medium' => $data['utm_medium'] ?? null, 'campaign' => $data['utm_campaign'] ?? null, 'content' => $data['utm_content'] ?? null, 'term' => $data['utm_term'] ?? null]);
    }

    private function qr(array $data): array
    {
        return ['dark' => $data['qr_dark'] ?? '#0f172a', 'light' => $data['qr_light'] ?? '#ffffff', 'level' => $data['qr_level'] ?? 'M'];
    }

    private function defaultExpiration(): ?\Illuminate\Support\Carbon
    {
        $days = config('gojet.links.default_expiration_days');

        return filled($days) ? now()->addDays((int) $days) : null;
    }

    private function authorizeManager(Request $request, Link $link): void
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless($request->user()->is_admin || ($workspace && $link->workspace_id === $workspace->id), 403);
    }
}
