<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\MailDeliveryService;
use App\Services\QuotaService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class WorkspaceController extends Controller
{
    public function index(Request $request, QuotaService $quotas): View
    {
        $current = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $owned = $request->user()->ownedWorkspaces()->withCount('members')->get();
        $member = Workspace::whereHas('members', fn ($query) => $query
            ->where('user_id', $request->user()->id)
            ->where('status', 'active'))
            ->withCount('members')
            ->get();
        $workspaces = $owned->merge($member)->unique('id')->values();
        $current->load(['members.user', 'subscriptions.plan']);
        $quotaSummary = $quotas->summary($current);
        $plan = $quotas->plan($current);
        $canAdminister = $this->canAdminister($request, $current);

        return view('workspaces.index', compact('current', 'workspaces', 'quotaSummary', 'plan', 'canAdminister'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $base = Str::slug($data['name']) ?: 'workspace';
        $slug = $base;
        $suffix = 2;
        while (Workspace::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix++;
        }

        $workspace = $request->user()->ownedWorkspaces()->create([
            'name' => $data['name'],
            'slug' => $slug,
            'status' => 'active',
            'plan_code' => 'free',
            'settings' => [],
        ]);
        $workspace->members()->create([
            'user_id' => $request->user()->id,
            'email' => strtolower($request->user()->email),
            'role' => 'owner',
            'status' => 'active',
            'invited_at' => now(),
            'accepted_at' => now(),
        ]);
        $request->session()->put('gojet.workspace_id', $workspace->id);

        return back()->with('status', __('v3.workspace_created'));
    }

    public function update(Request $request, Workspace $workspace): RedirectResponse
    {
        $this->authorizeAdmin($request, $workspace);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'status' => ['required', Rule::in(['active', 'suspended'])],
        ]);
        $workspace->update($data);

        return back()->with('status', __('v3.workspace_updated'));
    }

    public function switch(Request $request, Workspace $workspace): RedirectResponse
    {
        $this->authorizeMember($request, $workspace);
        $request->session()->put('gojet.workspace_id', $workspace->id);

        return redirect()->route('links.index')->with('status', __('v3.workspace_switched', ['name' => $workspace->name]));
    }

    public function invite(
        Request $request,
        Workspace $workspace,
        QuotaService $quotas,
        MailDeliveryService $mail,
    ): RedirectResponse {
        $this->authorizeAdmin($request, $workspace);
        $quotas->ensureCanCreate($workspace, 'members');
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:190'],
            'role' => ['required', Rule::in(['admin', 'editor', 'analyst', 'viewer'])],
        ]);
        $email = strtolower($data['email']);
        $existing = $workspace->members()->where('email', $email)->first();
        abort_if($existing && in_array($existing->status, ['active', 'invited'], true) && ! $existing->invitationExpired(), 422, __('v3.member_exists'));

        $token = Str::random(64);
        $member = $existing ?? new WorkspaceMember(['workspace_id' => $workspace->id, 'email' => $email]);
        $member->fill([
            'user_id' => null,
            'role' => $data['role'],
            'status' => 'invited',
            'invitation_token_hash' => hash('sha256', $token),
            'invited_at' => now(),
            'accepted_at' => null,
            'invitation_expires_at' => now()->addDays(7),
            'revoked_at' => null,
            'last_sent_at' => now(),
            'invitation_attempts' => ($existing?->invitation_attempts ?? 0) + 1,
        ]);
        $member->save();

        $result = $mail->sendWorkspaceInvitation($request->user(), $workspace, $member, $token);

        return back()
            ->with($result['ok'] ? 'status' : 'mail_error', $result['ok']
                ? '邀请已发送，有效期为 7 天。'
                : $result['message']);
    }

    public function resendInvitation(
        Request $request,
        Workspace $workspace,
        WorkspaceMember $member,
        MailDeliveryService $mail,
    ): RedirectResponse {
        $this->authorizeAdmin($request, $workspace);
        $this->assertMemberBelongsToWorkspace($workspace, $member);
        abort_unless(in_array($member->status, ['invited', 'expired'], true), 422, '只有待接受或已过期的邀请可以重新发送。');

        $token = Str::random(64);
        $member->update([
            'status' => 'invited',
            'invitation_token_hash' => hash('sha256', $token),
            'invited_at' => now(),
            'invitation_expires_at' => now()->addDays(7),
            'revoked_at' => null,
            'last_sent_at' => now(),
            'invitation_attempts' => $member->invitation_attempts + 1,
        ]);

        $result = $mail->sendWorkspaceInvitation($request->user(), $workspace, $member, $token);

        return back()->with($result['ok'] ? 'status' : 'mail_error', $result['ok'] ? '邀请邮件已重新发送。' : $result['message']);
    }

    public function revokeInvitation(Request $request, Workspace $workspace, WorkspaceMember $member): RedirectResponse
    {
        $this->authorizeAdmin($request, $workspace);
        $this->assertMemberBelongsToWorkspace($workspace, $member);
        abort_unless(in_array($member->status, ['invited', 'expired'], true), 422, '该邀请已无法撤销。');

        $member->update([
            'status' => 'revoked',
            'invitation_token_hash' => null,
            'revoked_at' => now(),
        ]);

        return back()->with('status', '邀请已撤销。');
    }

    public function acceptInvitation(Request $request, string $token): RedirectResponse
    {
        $member = WorkspaceMember::where('invitation_token_hash', hash('sha256', $token))
            ->where('status', 'invited')
            ->firstOrFail();

        if ($member->invitationExpired()) {
            $member->update(['status' => 'expired', 'invitation_token_hash' => null]);
            abort(410, '该邀请已经过期，请联系工作区管理员重新发送。');
        }

        abort_unless(strtolower($request->user()->email) === strtolower($member->email), 403, __('v3.invitation_email_mismatch'));
        $member->update([
            'user_id' => $request->user()->id,
            'status' => 'active',
            'accepted_at' => now(),
            'invitation_token_hash' => null,
            'revoked_at' => null,
        ]);
        $request->session()->put('gojet.workspace_id', $member->workspace_id);

        return redirect()->route('workspaces.index')->with('status', __('v3.invitation_accepted'));
    }

    public function updateMember(Request $request, Workspace $workspace, WorkspaceMember $member): RedirectResponse
    {
        $this->authorizeAdmin($request, $workspace);
        $this->assertMemberBelongsToWorkspace($workspace, $member);
        abort_if($member->role === 'owner', 422, __('v3.owner_role_locked'));
        abort_unless($member->status === 'active', 422, '只有已加入的成员可以修改角色。');
        $member->update($request->validate(['role' => ['required', Rule::in(['admin', 'editor', 'analyst', 'viewer'])]]));

        return back()->with('status', __('v3.member_updated'));
    }

    public function removeMember(Request $request, Workspace $workspace, WorkspaceMember $member): RedirectResponse
    {
        $this->authorizeAdmin($request, $workspace);
        $this->assertMemberBelongsToWorkspace($workspace, $member);
        abort_if($member->role === 'owner', 422, __('v3.owner_role_locked'));
        $member->delete();

        return back()->with('status', __('v3.member_removed'));
    }

    private function assertMemberBelongsToWorkspace(Workspace $workspace, WorkspaceMember $member): void
    {
        abort_unless($member->workspace_id === $workspace->id, 404);
    }

    private function authorizeMember(Request $request, Workspace $workspace): void
    {
        abort_unless($request->user()->is_admin
            || $workspace->owner_user_id === $request->user()->id
            || $workspace->members()->where('user_id', $request->user()->id)->where('status', 'active')->exists(), 403);
    }

    private function authorizeAdmin(Request $request, Workspace $workspace): void
    {
        abort_unless($this->canAdminister($request, $workspace), 403);
    }

    private function canAdminister(Request $request, Workspace $workspace): bool
    {
        return $request->user()->is_admin
            || $workspace->owner_user_id === $request->user()->id
            || $workspace->members()->where('user_id', $request->user()->id)
                ->where('status', 'active')
                ->whereIn('role', ['owner', 'admin'])
                ->exists();
    }
}
