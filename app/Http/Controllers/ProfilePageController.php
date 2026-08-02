<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\ProfileBlock;
use App\Models\ProfilePage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class ProfilePageController extends Controller
{
    public function index(Request $request): View
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $profiles = ProfilePage::withTrashed()->where('workspace_id', $workspace->id)->withCount('blocks')->latest()->paginate(20);
        $domains = Domain::where('workspace_id', $workspace->id)->whereNotNull('verified_at')->get();

        return view('profiles.index', compact('workspace', 'profiles', 'domains'));
    }

    public function store(Request $request): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'slug' => ['required', 'string', 'min:3', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'theme' => ['required', Rule::in(['aurora', 'minimal', 'midnight', 'paper', 'contrast'])],
            'domain_id' => ['nullable', 'integer'],
        ]);
        $domain = $this->domain($workspace->id, $data['domain_id'] ?? null);
        abort_if(ProfilePage::withTrashed()->where('domain_id', $domain?->id)->where('slug', $data['slug'])->exists(), 422, __('messages.slug_used'));

        $profile = $request->user()->profilePages()->create([
            'workspace_id' => $workspace->id,
            'domain_id' => $domain?->id,
            'title' => $data['title'],
            'slug' => $data['slug'],
            'bio' => $data['bio'] ?? null,
            'theme' => $data['theme'],
            'theme_settings' => $this->defaultTheme($data['theme']),
            'status' => 'draft',
        ]);

        return redirect()->route('profiles.edit', $profile)->with('status', __('v3.profile_created'));
    }

    public function edit(Request $request, ProfilePage $profilePage): View
    {
        $this->authorizeOwner($request, $profilePage);
        $profilePage->load('blocks');
        $domains = Domain::where('workspace_id', $profilePage->workspace_id)->whereNotNull('verified_at')->get();

        return view('profiles.edit', compact('profilePage', 'domains'));
    }

    public function update(Request $request, ProfilePage $profilePage): RedirectResponse
    {
        $this->authorizeOwner($request, $profilePage);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'theme' => ['required', Rule::in(['aurora', 'minimal', 'midnight', 'paper', 'contrast'])],
            'domain_id' => ['nullable', 'integer'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'background' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'foreground' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'accent' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'button_style' => ['nullable', Rule::in(['rounded', 'pill', 'square'])],
            'avatar' => ['nullable', 'image', 'max:2048'],
        ]);
        $domain = $this->domain((int) $profilePage->workspace_id, $data['domain_id'] ?? null);
        if ($request->hasFile('avatar')) {
            if ($profilePage->avatar_path) {
                Storage::disk('public')->delete($profilePage->avatar_path);
            }
            $data['avatar_path'] = $request->file('avatar')->store('profiles/'.$profilePage->id, 'public');
        }
        $data['domain_id'] = $domain?->id;
        $data['theme_settings'] = [
            'background' => $data['background'] ?? '#f8fafc',
            'foreground' => $data['foreground'] ?? '#0f172a',
            'accent' => $data['accent'] ?? '#06b6d4',
            'button_style' => $data['button_style'] ?? 'rounded',
        ];
        $data['published_at'] = $data['status'] === 'published' ? ($profilePage->published_at ?? now()) : null;
        unset($data['background'], $data['foreground'], $data['accent'], $data['button_style'], $data['avatar']);
        $profilePage->update($data);

        return back()->with('status', __('v3.profile_updated'));
    }

    public function destroy(Request $request, ProfilePage $profilePage): RedirectResponse
    {
        $this->authorizeOwner($request, $profilePage);
        $profilePage->delete();

        return redirect()->route('profiles.index')->with('status', __('v3.profile_deleted'));
    }

    public function storeBlock(Request $request, ProfilePage $profilePage): RedirectResponse
    {
        $this->authorizeOwner($request, $profilePage);
        $data = $this->blockData($request);
        $profilePage->blocks()->create([
            'type' => $data['type'],
            'content' => $this->blockContent($data),
            'settings' => ['style' => $data['style'] ?? 'default'],
            'position' => ((int) $profilePage->blocks()->max('position')) + 10,
            'is_active' => true,
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
        ]);

        return back()->with('status', __('v3.block_created'));
    }

    public function updateBlock(Request $request, ProfilePage $profilePage, ProfileBlock $block): RedirectResponse
    {
        $this->authorizeBlock($request, $profilePage, $block);
        $data = $this->blockData($request);
        $block->update([
            'type' => $data['type'],
            'content' => $this->blockContent($data),
            'settings' => ['style' => $data['style'] ?? 'default'],
            'is_active' => $request->boolean('is_active'),
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
        ]);

        return back()->with('status', __('v3.block_updated'));
    }

    public function destroyBlock(Request $request, ProfilePage $profilePage, ProfileBlock $block): RedirectResponse
    {
        $this->authorizeBlock($request, $profilePage, $block);
        $block->delete();

        return back()->with('status', __('v3.block_deleted'));
    }

    public function reorder(Request $request, ProfilePage $profilePage): RedirectResponse
    {
        $this->authorizeOwner($request, $profilePage);
        $data = $request->validate(['ids' => ['required', 'array', 'max:100'], 'ids.*' => ['integer']]);
        foreach ($data['ids'] as $position => $id) {
            $profilePage->blocks()->whereKey($id)->update(['position' => ($position + 1) * 10]);
        }

        return back()->with('status', __('v3.blocks_reordered'));
    }

    public function show(Request $request, string $slug): View
    {
        $profile = ProfilePage::where('slug', $slug)->where('status', 'published')->with('blocks')->firstOrFail();
        $visibleBlocks = $profile->blocks->filter->isVisible()->values();
        $profile->increment('views_count');

        return view('profiles.show', compact('profile', 'visibleBlocks'));
    }

    public function click(Request $request, ProfilePage $profilePage, ProfileBlock $block): RedirectResponse
    {
        abort_unless($profilePage->status === 'published' && $block->profile_page_id === $profilePage->id && $block->isVisible(), 404);
        $url = data_get($block->content, 'url');
        abort_unless(is_string($url) && preg_match('#^https?://#i', $url), 404);
        $block->increment('clicks_count');

        return redirect()->away($url, 302, ['Cache-Control' => 'no-store', 'X-Robots-Tag' => 'noindex']);
    }

    private function blockData(Request $request): array
    {
        return $request->validate([
            'type' => ['required', Rule::in(['link', 'heading', 'text', 'image', 'video', 'embed', 'contact', 'social'])],
            'label' => ['nullable', 'string', 'max:200'],
            'text' => ['nullable', 'string', 'max:5000'],
            'url' => ['nullable', 'url:http,https', 'max:2048'],
            'image_url' => ['nullable', 'url:http,https', 'max:2048'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'style' => ['nullable', 'string', 'max:40'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function blockContent(array $data): array
    {
        return array_filter([
            'label' => $data['label'] ?? null,
            'text' => $data['text'] ?? null,
            'url' => $data['url'] ?? null,
            'image_url' => $data['image_url'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function domain(int $workspaceId, mixed $domainId): ?Domain
    {
        return $domainId ? Domain::where('workspace_id', $workspaceId)->whereNotNull('verified_at')->findOrFail($domainId) : null;
    }

    private function defaultTheme(string $theme): array
    {
        return match ($theme) {
            'midnight' => ['background' => '#020617', 'foreground' => '#f8fafc', 'accent' => '#22d3ee', 'button_style' => 'rounded'],
            'paper' => ['background' => '#fffdf7', 'foreground' => '#292524', 'accent' => '#ea580c', 'button_style' => 'square'],
            'contrast' => ['background' => '#ffffff', 'foreground' => '#000000', 'accent' => '#000000', 'button_style' => 'square'],
            default => ['background' => '#f8fafc', 'foreground' => '#0f172a', 'accent' => '#06b6d4', 'button_style' => 'rounded'],
        };
    }

    private function authorizeOwner(Request $request, ProfilePage $profile): void
    {
        abort_unless($request->user()->is_admin || $request->user()->currentWorkspace()?->id === $profile->workspace_id, 403);
    }

    private function authorizeBlock(Request $request, ProfilePage $profile, ProfileBlock $block): void
    {
        $this->authorizeOwner($request, $profile);
        abort_unless($block->profile_page_id === $profile->id, 404);
    }
}
