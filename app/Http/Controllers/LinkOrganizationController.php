<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

class LinkOrganizationController extends Controller
{
    public function index(Request $request): View
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless($workspace, 409, __('v3.workspace_required'));

        $campaigns = $request->user()->campaigns()
            ->where('workspace_id', $workspace->id)
            ->withCount('links')
            ->latest()
            ->get();
        $folders = $request->user()->folders()
            ->where('workspace_id', $workspace->id)
            ->withCount('links')
            ->orderBy('position')
            ->orderBy('name')
            ->get();
        $tags = $request->user()->tags()
            ->where('workspace_id', $workspace->id)
            ->withCount('links')
            ->orderBy('name')
            ->get();

        return view('links.organization', compact('workspace', 'campaigns', 'folders', 'tags'));
    }
}
