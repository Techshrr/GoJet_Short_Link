<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProfileBlock;
use App\Models\ProfilePage;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');

        return response()->json(ProfilePage::where('workspace_id', $workspace->id)->withCount('blocks')->latest()->paginate(min(100, max(1, $request->integer('per_page', 50)))));
    }

    public function store(Request $request, QuotaService $quotas): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $quotas->ensureCanCreate($workspace, 'profiles');
        $data = $request->validate([
            'slug' => ['required', 'string', 'min:3', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/'],
            'title' => ['required', 'string', 'max:160'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'theme' => ['nullable', Rule::in(['aurora', 'minimal', 'midnight', 'paper', 'contrast'])],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'theme_settings' => ['nullable', 'array'],
        ]);
        abort_if(ProfilePage::withTrashed()->whereNull('domain_id')->where('slug', $data['slug'])->exists(), 409, 'Slug already exists.');
        $profile = $request->user()->profilePages()->create([
            'workspace_id' => $workspace->id,
            'slug' => $data['slug'],
            'title' => $data['title'],
            'bio' => $data['bio'] ?? null,
            'theme' => $data['theme'] ?? 'aurora',
            'theme_settings' => $data['theme_settings'] ?? [],
            'status' => $data['status'] ?? 'draft',
            'published_at' => ($data['status'] ?? 'draft') === 'published' ? now() : null,
        ]);

        return response()->json(['data' => $profile, 'url' => route('profiles.public', $profile->slug)], 201);
    }

    public function show(Request $request, ProfilePage $profilePage): JsonResponse
    {
        $this->authorize($request, $profilePage);

        return response()->json(['data' => $profilePage->load('blocks')]);
    }

    public function update(Request $request, ProfilePage $profilePage): JsonResponse
    {
        $this->authorize($request, $profilePage);
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:160'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'theme' => ['sometimes', Rule::in(['aurora', 'minimal', 'midnight', 'paper', 'contrast'])],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'theme_settings' => ['nullable', 'array'],
        ]);
        if (($data['status'] ?? null) === 'published' && ! $profilePage->published_at) {
            $data['published_at'] = now();
        }
        if (($data['status'] ?? null) === 'draft') {
            $data['published_at'] = null;
        }
        $profilePage->update($data);

        return response()->json(['data' => $profilePage->fresh()->load('blocks')]);
    }

    public function destroy(Request $request, ProfilePage $profilePage): JsonResponse
    {
        $this->authorize($request, $profilePage);
        $profilePage->delete();

        return response()->json(status: 204);
    }

    public function storeBlock(Request $request, ProfilePage $profilePage): JsonResponse
    {
        $this->authorize($request, $profilePage);
        $data = $request->validate([
            'type' => ['required', Rule::in(['link', 'heading', 'text', 'image', 'video', 'embed', 'contact', 'social'])],
            'content' => ['required', 'array'],
            'settings' => ['nullable', 'array'],
            'position' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);
        $block = $profilePage->blocks()->create(array_merge($data, ['position' => $data['position'] ?? (((int) $profilePage->blocks()->max('position')) + 10), 'is_active' => $data['is_active'] ?? true]));

        return response()->json(['data' => $block], 201);
    }

    public function updateBlock(Request $request, ProfilePage $profilePage, ProfileBlock $block): JsonResponse
    {
        $this->authorizeBlock($request, $profilePage, $block);
        $block->update($request->validate([
            'content' => ['sometimes', 'required', 'array'],
            'settings' => ['nullable', 'array'],
            'position' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
        ]));

        return response()->json(['data' => $block->fresh()]);
    }

    public function destroyBlock(Request $request, ProfilePage $profilePage, ProfileBlock $block): JsonResponse
    {
        $this->authorizeBlock($request, $profilePage, $block);
        $block->delete();

        return response()->json(status: 204);
    }

    private function authorize(Request $request, ProfilePage $profile): void
    {
        abort_unless($profile->workspace_id === $request->attributes->get('workspace')?->id, 404);
    }

    private function authorizeBlock(Request $request, ProfilePage $profile, ProfileBlock $block): void
    {
        $this->authorize($request, $profile);
        abort_unless($block->profile_page_id === $profile->id, 404);
    }
}
