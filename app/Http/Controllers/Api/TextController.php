<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TextShare;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TextController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');

        return response()->json(TextShare::where('workspace_id', $workspace->id)->latest()->paginate(min(100, max(1, $request->integer('per_page', 50)))));
    }

    public function store(Request $request, QuotaService $quotas): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $quotas->ensureCanCreate($workspace, 'texts');
        $data = $this->validated($request);
        $slug = $data['slug'] ?? $this->slug();
        abort_if(TextShare::withTrashed()->where('slug', $slug)->exists(), 409, 'Slug already exists.');
        $share = $request->user()->textShares()->create([
            'workspace_id' => $workspace->id,
            'slug' => $slug,
            'title' => $data['title'] ?? null,
            'content' => $data['content'],
            'format' => $data['format'],
            'syntax_language' => $data['syntax_language'] ?? null,
            'visibility' => $data['visibility'],
            'password_hash' => filled($data['password'] ?? null) ? Hash::make($data['password']) : null,
            'expires_at' => $data['expires_at'] ?? null,
            'burn_after_read' => $data['burn_after_read'] ?? false,
            'max_views' => $data['max_views'] ?? null,
        ]);
        $share->revisions()->create(['editor_user_id' => $request->user()->id, 'content' => $share->content, 'format' => $share->format, 'syntax_language' => $share->syntax_language]);

        return response()->json(['data' => $share, 'url' => route('texts.public', $share->slug)], 201);
    }

    public function show(Request $request, TextShare $textShare): JsonResponse
    {
        $this->authorize($request, $textShare);

        return response()->json(['data' => $textShare->load(['revisions' => fn ($query) => $query->latest()->limit(20)])]);
    }

    public function update(Request $request, TextShare $textShare): JsonResponse
    {
        $this->authorize($request, $textShare);
        $data = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:190'],
            'content' => ['sometimes', 'required', 'string', 'max:2097152'],
            'format' => ['sometimes', Rule::in(['plain', 'markdown', 'code'])],
            'syntax_language' => ['nullable', 'string', 'max:60'],
            'visibility' => ['sometimes', Rule::in(['public', 'unlisted', 'private'])],
            'expires_at' => ['nullable', 'date'],
            'burn_after_read' => ['sometimes', 'boolean'],
            'max_views' => ['nullable', 'integer', 'min:1'],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'remove_password' => ['nullable', 'boolean'],
        ]);
        $textShare->revisions()->create(['editor_user_id' => $request->user()->id, 'content' => $textShare->content, 'format' => $textShare->format, 'syntax_language' => $textShare->syntax_language]);
        if ($request->boolean('remove_password')) {
            $data['password_hash'] = null;
        } elseif (filled($data['password'] ?? null)) {
            $data['password_hash'] = Hash::make($data['password']);
        }
        unset($data['password'], $data['remove_password']);
        $textShare->update($data);

        return response()->json(['data' => $textShare->fresh()]);
    }

    public function destroy(Request $request, TextShare $textShare): JsonResponse
    {
        $this->authorize($request, $textShare);
        $textShare->delete();

        return response()->json(status: 204);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'slug' => ['nullable', 'string', 'min:3', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/'],
            'title' => ['nullable', 'string', 'max:190'],
            'content' => ['required', 'string', 'max:2097152'],
            'format' => ['required', Rule::in(['plain', 'markdown', 'code'])],
            'syntax_language' => ['nullable', 'string', 'max:60'],
            'visibility' => ['required', Rule::in(['public', 'unlisted', 'private'])],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'burn_after_read' => ['nullable', 'boolean'],
            'max_views' => ['nullable', 'integer', 'min:1'],
        ]);
    }

    private function authorize(Request $request, TextShare $share): void
    {
        abort_unless($share->workspace_id === $request->attributes->get('workspace')?->id, 404);
    }

    private function slug(): string
    {
        do {
            $slug = Str::lower(Str::random(10));
        } while (TextShare::withTrashed()->where('slug', $slug)->exists());

        return $slug;
    }
}
