<?php

namespace App\Http\Middleware;

use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureWorkspaceAccess
{
    private const RANK = [
        'viewer' => 10,
        'analyst' => 20,
        'editor' => 30,
        'admin' => 40,
        'owner' => 50,
    ];

    /** @var list<string> */
    private const ADMIN_ROUTES = [
        'domains.*',
        'tokens.*',
        'webhooks.*',
        'sso.*',
        'plans.request',
        'subscriptions.cancel',
        'workspaces.update',
        'workspaces.invite',
        'workspaces.members.*',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_unless($user, 401);

        $workspace = $this->workspaceForRequest($request);
        abort_unless($workspace && $workspace->status === 'active', 403, __('v3.workspace_unavailable'));

        $role = $this->role($workspace, $user->id);
        abort_unless($role, 403, __('v3.workspace_access_denied'));

        $request->attributes->set('workspace', $workspace);
        $request->attributes->set('workspace_role', $role);

        if ($request->routeIs('workspaces.switch')) {
            return $next($request);
        }

        if ($request->isMethodSafe()) {
            return $next($request);
        }

        $required = $request->routeIs(...self::ADMIN_ROUTES) ? 'admin' : 'editor';
        abort_unless($this->rank($role) >= $this->rank($required), 403, __('v3.workspace_role_required', ['role' => $required]));

        return $next($request);
    }

    private function workspaceForRequest(Request $request): ?Workspace
    {
        $routeWorkspace = $request->route('workspace');
        if ($request->routeIs('workspaces.switch') && $routeWorkspace instanceof Workspace) {
            return $routeWorkspace;
        }

        return $request->user()->currentWorkspace();
    }

    private function role(Workspace $workspace, int $userId): ?string
    {
        if ($workspace->owner_user_id === $userId) {
            return 'owner';
        }

        return WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->value('role');
    }

    private function rank(string $role): int
    {
        return self::RANK[$role] ?? 0;
    }
}
