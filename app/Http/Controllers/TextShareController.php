<?php

namespace App\Http\Controllers;

use App\Models\TextShare;
use App\Services\SafeTextRenderer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class TextShareController extends Controller
{
    public function index(Request $request): View
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $shares = TextShare::withTrashed()
            ->where('workspace_id', $workspace->id)
            ->when($request->filled('q'), fn ($query) => $query->where(fn ($nested) => $nested->where('title', 'like', '%'.$request->string('q').'%')->orWhere('slug', 'like', '%'.$request->string('q').'%')))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return view('texts.index', compact('workspace', 'shares'));
    }

    public function store(Request $request): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $data = $this->validateData($request, false);
        $slug = $data['slug'] ?: $this->uniqueSlug();
        abort_if(TextShare::withTrashed()->where('slug', $slug)->exists(), 422, __('messages.slug_used'));

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
            'burn_after_read' => $request->boolean('burn_after_read'),
            'max_views' => $data['max_views'] ?? null,
        ]);
        $share->revisions()->create([
            'editor_user_id' => $request->user()->id,
            'content' => $share->content,
            'format' => $share->format,
            'syntax_language' => $share->syntax_language,
        ]);

        return redirect()->route('texts.edit', $share)->with('status', __('v3.text_created'));
    }

    public function edit(Request $request, TextShare $textShare): View
    {
        $this->authorizeOwner($request, $textShare);
        $textShare->load(['revisions' => fn ($query) => $query->latest()->limit(20)]);

        return view('texts.edit', compact('textShare'));
    }

    public function update(Request $request, TextShare $textShare): RedirectResponse
    {
        $this->authorizeOwner($request, $textShare);
        $data = $this->validateData($request, true);
        $textShare->revisions()->create([
            'editor_user_id' => $request->user()->id,
            'content' => $textShare->content,
            'format' => $textShare->format,
            'syntax_language' => $textShare->syntax_language,
        ]);

        if ($request->boolean('remove_password')) {
            $data['password_hash'] = null;
        } elseif (filled($data['password'] ?? null)) {
            $data['password_hash'] = Hash::make($data['password']);
        }
        $data['burn_after_read'] = $request->boolean('burn_after_read');
        unset($data['password'], $data['remove_password'], $data['slug']);
        $textShare->update($data);

        return back()->with('status', __('v3.text_updated'));
    }

    public function destroy(Request $request, TextShare $textShare): RedirectResponse
    {
        $this->authorizeOwner($request, $textShare);
        $textShare->delete();

        return redirect()->route('texts.index')->with('status', __('v3.text_deleted'));
    }

    public function show(Request $request, string $slug, SafeTextRenderer $renderer): View
    {
        $share = TextShare::where('slug', $slug)->firstOrFail();
        $this->authorizePublicAccess($request, $share);
        abort_unless($share->isAvailable(), 410);

        if ($share->password_hash && ! $request->session()->get('gojet.text_access.'.$share->id)) {
            return view('texts.password', compact('share'));
        }

        $share->increment('views_count');
        $share->forceFill(['last_viewed_at' => now()])->saveQuietly();
        $rendered = $renderer->render($share->content, $share->format);
        if ($share->burn_after_read && (! $request->user() || $request->user()->id !== $share->user_id)) {
            $share->delete();
        }

        return view('texts.show', compact('share', 'rendered'));
    }

    public function unlock(Request $request, string $slug): RedirectResponse
    {
        $share = TextShare::where('slug', $slug)->firstOrFail();
        $request->validate(['password' => ['required', 'string', 'max:190']]);
        if (! $share->password_hash || ! Hash::check($request->string('password')->toString(), $share->password_hash)) {
            return back()->withErrors(['password' => __('messages.invalid_link_password')]);
        }
        $request->session()->put('gojet.text_access.'.$share->id, true);

        return redirect()->route('texts.public', $share->slug);
    }

    public function raw(Request $request, string $slug): Response
    {
        $share = TextShare::where('slug', $slug)->firstOrFail();
        $this->authorizePublicAccess($request, $share);
        abort_unless($share->isAvailable(), 410);
        abort_if($share->password_hash && ! $request->session()->get('gojet.text_access.'.$share->id), 403);

        return response($share->content, 200, ['Content-Type' => 'text/plain; charset=UTF-8', 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function download(Request $request, string $slug): Response
    {
        $response = $this->raw($request, $slug);
        $response->headers->set('Content-Disposition', 'attachment; filename="gojet-'.$slug.'.txt"');

        return $response;
    }

    private function validateData(Request $request, bool $updating): array
    {
        return $request->validate([
            'slug' => $updating ? ['sometimes'] : ['nullable', 'string', 'min:3', 'max:80', 'regex:/^[A-Za-z0-9_-]+$/'],
            'title' => ['nullable', 'string', 'max:190'],
            'content' => ['required', 'string', 'max:2097152'],
            'format' => ['required', Rule::in(['plain', 'markdown', 'code'])],
            'syntax_language' => ['nullable', 'string', 'max:60'],
            'visibility' => ['required', Rule::in(['public', 'unlisted', 'private'])],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'remove_password' => ['nullable', 'boolean'],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'burn_after_read' => ['nullable', 'boolean'],
            'max_views' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
        ]);
    }

    private function uniqueSlug(): string
    {
        do {
            $slug = Str::lower(Str::random(10));
        } while (TextShare::withTrashed()->where('slug', $slug)->exists());

        return $slug;
    }

    private function authorizeOwner(Request $request, TextShare $share): void
    {
        abort_unless($request->user()->is_admin || $request->user()->currentWorkspace()?->id === $share->workspace_id, 403);
    }

    private function authorizePublicAccess(Request $request, TextShare $share): void
    {
        if ($share->visibility === 'private') {
            abort_unless($request->user() && ($request->user()->is_admin || $request->user()->id === $share->user_id), 404);
        }
    }
}
