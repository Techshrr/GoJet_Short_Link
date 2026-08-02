<?php

namespace App\Http\Controllers;

use App\Models\Link;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\View\View;

class LinkWorkspaceController extends Controller
{
    public function index(Request $request): View
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless($workspace, 409, __('v3.workspace_required'));
        $request->session()->put('gojet.workspace_id', $workspace->id);

        $view = $request->string('view', 'active')->toString();
        $sort = in_array($request->string('sort')->toString(), ['created_at', 'updated_at', 'clicks_count', 'title', 'slug'], true)
            ? $request->string('sort')->toString()
            : 'created_at';
        $direction = $request->string('direction')->toString() === 'asc' ? 'asc' : 'desc';

        $query = Link::query()
            ->where('workspace_id', $workspace->id)
            ->with(['domain', 'campaign', 'folder', 'tags']);

        match ($view) {
            'archived' => $query->whereNotNull('archived_at'),
            'trash' => $query->onlyTrashed(),
            'all' => null,
            default => $query->whereNull('archived_at'),
        };

        $query
            ->when($request->filled('q'), function (Builder $query) use ($request): void {
                $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $request->string('q')->toString()).'%';
                $query->where(fn (Builder $nested) => $nested
                    ->where('title', 'like', $term)
                    ->orWhere('slug', 'like', $term)
                    ->orWhere('target_url', 'like', $term)
                    ->orWhere('notes', 'like', $term));
            })
            ->when($request->filled('status'), fn (Builder $query) => $query->where('status', $request->string('status')->toString()))
            ->when($request->integer('domain_id'), fn (Builder $query, int $id) => $query->where('domain_id', $id))
            ->when($request->integer('campaign_id'), fn (Builder $query, int $id) => $query->where('campaign_id', $id))
            ->when($request->integer('folder_id'), fn (Builder $query, int $id) => $query->where('folder_id', $id))
            ->when($request->integer('tag_id'), fn (Builder $query, int $id) => $query->whereHas('tags', fn (Builder $tagQuery) => $tagQuery->whereKey($id)))
            ->when($request->filled('health'), fn (Builder $query) => $query->where('health_status', $request->string('health')->toString()))
            ->orderBy($sort, $direction);

        $links = $query->paginate(25)->withQueryString();
        $domains = $workspace->domains()->orderByDesc('is_default')->orderBy('hostname')->get();
        $campaigns = $request->user()->campaigns()->where('workspace_id', $workspace->id)->orderBy('name')->get();
        $folders = $request->user()->folders()->where('workspace_id', $workspace->id)->orderBy('position')->orderBy('name')->get();
        $tags = $request->user()->tags()->where('workspace_id', $workspace->id)->orderBy('name')->get();

        $base = Link::withTrashed()->where('workspace_id', $workspace->id);
        $totals = [
            'all' => (clone $base)->count(),
            'active' => (clone $base)->whereNull('deleted_at')->whereNull('archived_at')->where('status', 'active')->count(),
            'archived' => (clone $base)->whereNull('deleted_at')->whereNotNull('archived_at')->count(),
            'trash' => (clone $base)->whereNotNull('deleted_at')->count(),
            'clicks' => (int) (clone $base)->whereNull('deleted_at')->sum('clicks_count'),
        ];

        return view('links.index', compact('workspace', 'links', 'domains', 'campaigns', 'folders', 'tags', 'totals', 'view', 'sort', 'direction'));
    }
}
