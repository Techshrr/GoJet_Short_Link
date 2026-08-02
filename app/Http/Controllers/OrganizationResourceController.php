<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Folder;
use App\Models\Tag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrganizationResourceController extends Controller
{
    public function storeCampaign(Request $request): RedirectResponse
    {
        $workspace = $this->workspace($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);
        $data['slug'] = $this->uniqueSlug(Campaign::class, $workspace->id, $data['name']);
        $data['workspace_id'] = $workspace->id;
        $data['status'] = 'active';
        $request->user()->campaigns()->create($data);

        return back()->with('status', __('v3.campaign_created'));
    }

    public function updateCampaign(Request $request, Campaign $campaign): RedirectResponse
    {
        $this->owns($request, $campaign->workspace_id);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'status' => ['required', Rule::in(['active', 'paused', 'completed'])],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);
        $campaign->update($data);

        return back()->with('status', __('v3.campaign_updated'));
    }

    public function destroyCampaign(Request $request, Campaign $campaign): RedirectResponse
    {
        $this->owns($request, $campaign->workspace_id);
        $campaign->links()->update(['campaign_id' => null]);
        $campaign->delete();

        return back()->with('status', __('v3.campaign_deleted'));
    }

    public function storeFolder(Request $request): RedirectResponse
    {
        $workspace = $this->workspace($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'parent_id' => ['nullable', 'integer'],
        ]);
        if ($data['parent_id'] ?? null) {
            abort_unless(Folder::where('workspace_id', $workspace->id)->whereKey($data['parent_id'])->exists(), 422);
        }
        $data['workspace_id'] = $workspace->id;
        $data['position'] = ((int) Folder::where('workspace_id', $workspace->id)->max('position')) + 10;
        $request->user()->folders()->create($data);

        return back()->with('status', __('v3.folder_created'));
    }

    public function updateFolder(Request $request, Folder $folder): RedirectResponse
    {
        $this->owns($request, $folder->workspace_id);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'parent_id' => ['nullable', 'integer', Rule::notIn([$folder->id])],
            'position' => ['nullable', 'integer', 'min:0'],
        ]);
        if ($data['parent_id'] ?? null) {
            abort_unless(Folder::where('workspace_id', $folder->workspace_id)->whereKey($data['parent_id'])->exists(), 422);
        }
        $folder->update($data);

        return back()->with('status', __('v3.folder_updated'));
    }

    public function destroyFolder(Request $request, Folder $folder): RedirectResponse
    {
        $this->owns($request, $folder->workspace_id);
        $folder->links()->update(['folder_id' => null]);
        $folder->children()->update(['parent_id' => null]);
        $folder->delete();

        return back()->with('status', __('v3.folder_deleted'));
    }

    public function storeTag(Request $request): RedirectResponse
    {
        $workspace = $this->workspace($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);
        $data['slug'] = $this->uniqueSlug(Tag::class, $workspace->id, $data['name']);
        $data['workspace_id'] = $workspace->id;
        $request->user()->tags()->create($data);

        return back()->with('status', __('v3.tag_created'));
    }

    public function updateTag(Request $request, Tag $tag): RedirectResponse
    {
        $this->owns($request, $tag->workspace_id);
        $tag->update($request->validate([
            'name' => ['required', 'string', 'max:80'],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]));

        return back()->with('status', __('v3.tag_updated'));
    }

    public function destroyTag(Request $request, Tag $tag): RedirectResponse
    {
        $this->owns($request, $tag->workspace_id);
        $tag->links()->detach();
        $tag->delete();

        return back()->with('status', __('v3.tag_deleted'));
    }

    private function workspace(Request $request)
    {
        return $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
    }

    private function owns(Request $request, ?int $workspaceId): void
    {
        abort_unless($request->user()->currentWorkspace()?->id === $workspaceId, 403);
    }

    private function uniqueSlug(string $model, int $workspaceId, string $name): string
    {
        $base = Str::slug($name) ?: Str::lower(Str::random(8));
        $slug = $base;
        $suffix = 2;
        while ($model::query()->where('workspace_id', $workspaceId)->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        return $slug;
    }
}
