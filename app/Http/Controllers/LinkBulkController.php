<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Folder;
use App\Models\Link;
use App\Models\Tag;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LinkBulkController extends Controller
{
    public function __invoke(Request $request, AuditLogger $audit): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless($workspace, 409, __('v3.workspace_required'));

        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer'],
            'action' => ['required', Rule::in(['activate', 'disable', 'archive', 'unarchive', 'trash', 'restore', 'delete_forever', 'move_campaign', 'move_folder', 'tag_add', 'tag_remove'])],
            'campaign_id' => ['nullable', 'integer'],
            'folder_id' => ['nullable', 'integer'],
            'tag_id' => ['nullable', 'integer'],
        ]);

        $links = Link::withTrashed()
            ->where('workspace_id', $workspace->id)
            ->whereIn('id', $data['ids'])
            ->get();
        abort_if($links->isEmpty(), 404);

        $campaign = isset($data['campaign_id']) ? Campaign::where('workspace_id', $workspace->id)->findOrFail($data['campaign_id']) : null;
        $folder = isset($data['folder_id']) ? Folder::where('workspace_id', $workspace->id)->findOrFail($data['folder_id']) : null;
        $tag = isset($data['tag_id']) ? Tag::where('workspace_id', $workspace->id)->findOrFail($data['tag_id']) : null;

        foreach ($links as $link) {
            match ($data['action']) {
                'activate' => $link->update(['status' => 'active']),
                'disable' => $link->update(['status' => 'disabled']),
                'archive' => $link->update(['archived_at' => now()]),
                'unarchive' => $link->update(['archived_at' => null]),
                'trash' => $link->trashed() ? null : $link->delete(),
                'restore' => $link->trashed() ? $link->restore() : null,
                'delete_forever' => $link->forceDelete(),
                'move_campaign' => $link->update(['campaign_id' => $campaign?->id]),
                'move_folder' => $link->update(['folder_id' => $folder?->id]),
                'tag_add' => $tag ? $link->tags()->syncWithoutDetaching([$tag->id]) : null,
                'tag_remove' => $tag ? $link->tags()->detach($tag->id) : null,
            };
        }

        $audit->record('links.bulk_action', null, [
            'action' => $data['action'],
            'count' => $links->count(),
            'ids' => $links->pluck('id')->all(),
            'workspace_id' => $workspace->id,
        ], $request);

        return back()->with('status', __('v3.bulk_completed', ['count' => $links->count()]));
    }
}
