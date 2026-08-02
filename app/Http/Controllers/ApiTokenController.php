<?php

namespace App\Http\Controllers;

use App\Models\ApiToken;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class ApiTokenController extends Controller
{
    private const ABILITIES = [
        'links:read', 'links:write', 'analytics:read', 'domains:read', 'domains:write',
        'texts:read', 'texts:write', 'files:read', 'files:write', 'profiles:read',
        'profiles:write', 'webhooks:read', 'webhooks:write', 'conversions:write',
    ];

    public function index(Request $request): View
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $tokens = ApiToken::where('workspace_id', $workspace->id)->latest()->get();

        return view('tokens', compact('tokens', 'workspace'));
    }

    public function store(Request $request): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'abilities' => ['required', 'array', 'min:1'],
            'abilities.*' => ['string', Rule::in(array_merge(['*'], self::ABILITIES))],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        $plain = 'gjt_'.Str::random(64);
        $request->user()->apiTokens()->create([
            'workspace_id' => $workspace->id,
            'name' => $data['name'],
            'token_hash' => hash('sha256', $plain),
            'abilities' => array_values(array_unique($data['abilities'])),
            'expires_at' => $data['expires_at'] ?? null,
        ]);

        return back()->with('status', __('messages.token_created'))->with('plain_token', $plain);
    }

    public function destroy(Request $request, ApiToken $token): RedirectResponse
    {
        abort_unless($request->user()->is_admin || $request->user()->currentWorkspace()?->id === $token->workspace_id, 403);
        $token->delete();

        return back()->with('status', __('messages.token_revoked'));
    }
}
