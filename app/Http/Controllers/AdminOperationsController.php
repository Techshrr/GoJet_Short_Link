<?php

namespace App\Http\Controllers;

use App\Models\FileShare;
use App\Models\Link;
use App\Models\ProfilePage;
use App\Models\Subscription;
use App\Models\TextShare;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\Workspace;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class AdminOperationsController extends Controller
{
    public function index(Request $request): View
    {
        $allowedSections = ['users', 'workspaces', 'links', 'texts', 'files', 'profiles', 'subscriptions', 'webhooks'];
        $section = $request->string('section', 'users')->toString();
        if (! in_array($section, $allowedSections, true)) {
            $section = 'users';
        }
        $query = $request->string('q')->toString();

        $records = match ($section) {
            'workspaces' => Workspace::with(['owner', 'subscriptions.plan'])->withCount(['members', 'links', 'domains'])->when($query, fn ($builder) => $builder->where(fn ($search) => $search->where('name', 'like', '%'.$query.'%')->orWhere('slug', 'like', '%'.$query.'%')))->latest()->paginate(30),
            'links' => Link::withTrashed()->with(['user', 'workspace'])->when($query, fn ($builder) => $builder->where(fn ($search) => $search->where('slug', 'like', '%'.$query.'%')->orWhere('target_url', 'like', '%'.$query.'%')->orWhere('title', 'like', '%'.$query.'%')))->latest()->paginate(30),
            'texts' => TextShare::withTrashed()->with(['user', 'workspace'])->when($query, fn ($builder) => $builder->where(fn ($search) => $search->where('slug', 'like', '%'.$query.'%')->orWhere('title', 'like', '%'.$query.'%')))->latest()->paginate(30),
            'files' => FileShare::withTrashed()->with(['user', 'workspace'])->when($query, fn ($builder) => $builder->where(fn ($search) => $search->where('slug', 'like', '%'.$query.'%')->orWhere('original_name', 'like', '%'.$query.'%')))->latest()->paginate(30),
            'profiles' => ProfilePage::withTrashed()->with(['user', 'workspace'])->when($query, fn ($builder) => $builder->where(fn ($search) => $search->where('slug', 'like', '%'.$query.'%')->orWhere('title', 'like', '%'.$query.'%')))->latest()->paginate(30),
            'subscriptions' => Subscription::with(['workspace', 'plan'])->latest()->paginate(30),
            'webhooks' => WebhookDelivery::with('webhook.workspace')->latest()->paginate(30),
            default => User::withCount(['links', 'domains', 'ownedWorkspaces'])->when($query, fn ($builder) => $builder->where(fn ($search) => $search->where('email', 'like', '%'.$query.'%')->orWhere('name', 'like', '%'.$query.'%')))->latest()->paginate(30),
        };
        $records->withQueryString();

        $totals = [
            'users' => User::count(),
            'workspaces' => Workspace::count(),
            'links' => Link::withTrashed()->count(),
            'texts' => TextShare::withTrashed()->count(),
            'files' => FileShare::withTrashed()->count(),
            'profiles' => ProfilePage::withTrashed()->count(),
            'subscriptions' => Subscription::count(),
            'webhooks' => WebhookDelivery::count(),
        ];

        return view('admin.operations', compact('section', 'records', 'totals'));
    }

    public function updateUser(Request $request, User $user, AuditLogger $audit): RedirectResponse
    {
        abort_if($user->id === $request->user()->id && $request->string('status')->toString() !== 'active', 422, '不能暂停当前登录的管理员账户。');
        $data = $request->validate([
            'status' => ['required', Rule::in(['active', 'suspended'])],
            'is_admin' => ['nullable', 'boolean'],
        ]);
        $before = $user->only(['status', 'is_admin']);
        $user->update(['status' => $data['status'], 'is_admin' => $request->boolean('is_admin')]);
        if ($user->status === 'suspended') {
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }
        $audit->record('admin.user.updated', $user, ['before' => $before, 'after' => $user->only(['status', 'is_admin'])], $request);

        return back()->with('status', '用户状态与权限已更新。');
    }

    public function updateWorkspace(Request $request, Workspace $workspace, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['active', 'suspended'])],
            'plan_code' => ['required', 'string', 'max:40'],
        ]);
        $before = $workspace->only(['status', 'plan_code']);
        $workspace->update($data);
        $audit->record('admin.workspace.updated', $workspace, ['before' => $before, 'after' => $data], $request);

        return back()->with('status', '工作区状态与套餐已更新。');
    }

    public function quarantineLink(Request $request, Link $link, AuditLogger $audit): RedirectResponse
    {
        $link->update(['status' => $link->status === 'disabled' ? 'active' : 'disabled']);
        $audit->record('admin.link.quarantine', $link, ['status' => $link->status], $request);

        return back()->with('status', '链接处置状态已更新。');
    }

    public function quarantineText(Request $request, int $textShare, AuditLogger $audit): RedirectResponse
    {
        $share = TextShare::withTrashed()->findOrFail($textShare);
        $share->trashed() ? $share->restore() : $share->delete();
        $audit->record('admin.text.quarantine', $share, ['trashed' => $share->trashed()], $request);

        return back()->with('status', '文本分享处置状态已更新。');
    }

    public function quarantineFile(Request $request, int $fileShare, AuditLogger $audit): RedirectResponse
    {
        $share = FileShare::withTrashed()->findOrFail($fileShare);
        $share->update(['scan_status' => $share->scan_status === 'blocked' ? 'clean' : 'blocked']);
        $audit->record('admin.file.quarantine', $share, ['scan_status' => $share->scan_status], $request);

        return back()->with('status', '文件扫描状态已更新。');
    }

    public function quarantineProfile(Request $request, int $profilePage, AuditLogger $audit): RedirectResponse
    {
        $profile = ProfilePage::withTrashed()->findOrFail($profilePage);
        $status = $profile->status === 'published' ? 'draft' : 'published';
        $profile->update(['status' => $status, 'published_at' => $status === 'published' ? now() : null]);
        $audit->record('admin.profile.quarantine', $profile, ['status' => $profile->status], $request);

        return back()->with('status', '个人主页发布状态已更新。');
    }
}
