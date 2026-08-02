<?php

namespace App\Http\Controllers;

use App\Models\FileShare;
use App\Models\FileUploadSession;
use App\Services\FilePolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileShareController extends Controller
{
    public function index(Request $request): View
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $files = FileShare::withTrashed()
            ->where('workspace_id', $workspace->id)
            ->when($request->filled('q'), fn ($query) => $query->where('original_name', 'like', '%'.$request->string('q').'%'))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return view('files.index', compact('workspace', 'files'));
    }

    public function store(Request $request, FilePolicyService $policy): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $data = $request->validate([
            'file' => ['required', 'file'],
            'visibility' => ['required', Rule::in(['public', 'unlisted', 'private'])],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'max_downloads' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
        ]);
        $file = $request->file('file');
        $policy->validateUpload($file);
        $disk = (string) config('gojet.file_disk', config('filesystems.default', 'local'));
        $slug = $this->uniqueSlug();
        $extension = strtolower($file->getClientOriginalExtension());
        $path = 'gojet/files/'.$workspace->id.'/'.Str::uuid().($extension !== '' ? '.'.$extension : '');
        Storage::disk($disk)->put($path, fopen($file->getRealPath(), 'rb'), ['visibility' => 'private']);

        $share = $request->user()->fileShares()->create([
            'workspace_id' => $workspace->id,
            'slug' => $slug,
            'disk' => $disk,
            'path' => $path,
            'original_name' => $policy->safeDownloadName($file->getClientOriginalName()),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'sha256' => hash_file('sha256', $file->getRealPath()),
            'visibility' => $data['visibility'],
            'password_hash' => filled($data['password'] ?? null) ? Hash::make($data['password']) : null,
            'expires_at' => $data['expires_at'] ?? null,
            'max_downloads' => $data['max_downloads'] ?? null,
            'scan_status' => config('gojet.storage.malware_scan', false) ? 'pending' : 'not_configured',
        ]);

        return redirect()->route('files.manage', $share)->with('status', __('v3.file_created'));
    }

    public function manage(Request $request, FileShare $fileShare): View
    {
        $this->authorizeOwner($request, $fileShare);

        return view('files.manage', compact('fileShare'));
    }

    public function update(Request $request, FileShare $fileShare): RedirectResponse
    {
        $this->authorizeOwner($request, $fileShare);
        $data = $request->validate([
            'visibility' => ['required', Rule::in(['public', 'unlisted', 'private'])],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'remove_password' => ['nullable', 'boolean'],
            'expires_at' => ['nullable', 'date'],
            'max_downloads' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
        ]);
        if ($request->boolean('remove_password')) {
            $data['password_hash'] = null;
        } elseif (filled($data['password'] ?? null)) {
            $data['password_hash'] = Hash::make($data['password']);
        }
        unset($data['password'], $data['remove_password']);
        $fileShare->update($data);

        return back()->with('status', __('v3.file_updated'));
    }

    public function destroy(Request $request, FileShare $fileShare): RedirectResponse
    {
        $this->authorizeOwner($request, $fileShare);
        $fileShare->delete();

        return redirect()->route('files.index')->with('status', __('v3.file_deleted'));
    }

    public function show(Request $request, string $slug): View
    {
        $share = FileShare::where('slug', $slug)->firstOrFail();
        $this->authorizePublicAccess($request, $share);
        abort_unless($share->isAvailable(), 410);

        return view('files.show', compact('share'));
    }

    public function unlock(Request $request, string $slug): RedirectResponse
    {
        $share = FileShare::where('slug', $slug)->firstOrFail();
        $request->validate(['password' => ['required', 'string', 'max:190']]);
        if (! $share->password_hash || ! Hash::check($request->string('password')->toString(), $share->password_hash)) {
            return back()->withErrors(['password' => __('messages.invalid_link_password')]);
        }
        $request->session()->put('gojet.file_access.'.$share->id, true);

        return redirect()->route('files.public', $share->slug);
    }

    public function download(Request $request, string $slug, FilePolicyService $policy): StreamedResponse|Response
    {
        $share = FileShare::where('slug', $slug)->firstOrFail();
        $this->authorizePublicAccess($request, $share);
        abort_unless($share->isAvailable(), 410);
        abort_if($share->password_hash && ! $request->session()->get('gojet.file_access.'.$share->id), 403);
        abort_unless(Storage::disk($share->disk)->exists($share->path), 404);

        $share->increment('downloads_count');
        $inline = $request->boolean('inline') && $policy->mayRenderInline($share->mime_type);
        $name = $policy->safeDownloadName($share->original_name);
        $stream = Storage::disk($share->disk)->readStream($share->path);

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $share->mime_type ?: 'application/octet-stream',
            'Content-Length' => (string) $share->size_bytes,
            'Content-Disposition' => ($inline ? 'inline' : 'attachment').'; filename="'.addcslashes($name, '"\\').'"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ]);
    }

    public function createUploadSession(Request $request, FilePolicyService $policy): JsonResponse
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'size_bytes' => ['required', 'integer', 'min:1', 'max:'.((int) config('gojet.max_upload_mb', 1024) * 1024 * 1024)],
            'mime_type' => ['nullable', 'string', 'max:190'],
            'visibility' => ['required', Rule::in(['public', 'unlisted', 'private'])],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'max_downloads' => ['nullable', 'integer', 'min:1'],
        ]);
        $policy->validateName($data['name']);
        $session = FileUploadSession::create([
            'id' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'disk' => (string) config('gojet.file_disk', config('filesystems.default', 'local')),
            'original_name' => $policy->safeDownloadName($data['name']),
            'size_bytes' => $data['size_bytes'],
            'received_bytes' => 0,
            'chunk_size' => 5 * 1024 * 1024,
            'status' => 'pending',
            'metadata' => [
                'workspace_id' => $workspace->id,
                'mime_type' => $data['mime_type'] ?? null,
                'visibility' => $data['visibility'],
                'expires_at' => $data['expires_at'] ?? null,
                'max_downloads' => $data['max_downloads'] ?? null,
            ],
            'expires_at' => now()->addHours(24),
        ]);

        return response()->json(['id' => $session->id, 'chunk_size' => $session->chunk_size, 'expires_at' => $session->expires_at]);
    }

    public function uploadChunk(Request $request, FileUploadSession $uploadSession, int $index): JsonResponse
    {
        abort_unless($uploadSession->user_id === $request->user()->id && $uploadSession->status === 'pending' && $uploadSession->expires_at->isFuture(), 403);
        $request->validate(['chunk' => ['required', 'file', 'max:6144']]);
        abort_if($index < 0 || $index > 100000, 422);
        $chunk = $request->file('chunk');
        Storage::disk('local')->putFileAs('gojet/chunks/'.$uploadSession->id, $chunk, $index.'.part');
        $received = collect(Storage::disk('local')->files('gojet/chunks/'.$uploadSession->id))->sum(fn ($path) => Storage::disk('local')->size($path));
        $uploadSession->update(['received_bytes' => $received]);

        return response()->json(['received_bytes' => $received, 'size_bytes' => $uploadSession->size_bytes]);
    }

    public function completeUpload(Request $request, FileUploadSession $uploadSession, FilePolicyService $policy): JsonResponse
    {
        abort_unless($uploadSession->user_id === $request->user()->id && $uploadSession->status === 'pending', 403);
        $parts = collect(Storage::disk('local')->files('gojet/chunks/'.$uploadSession->id))
            ->sortBy(fn ($path) => (int) pathinfo($path, PATHINFO_FILENAME))
            ->values();
        abort_if($parts->isEmpty(), 422, __('v3.upload_no_chunks'));

        $assembledDirectory = storage_path('app/private/gojet/assembled');
        if (! is_dir($assembledDirectory)) {
            mkdir($assembledDirectory, 0770, true);
        }
        $temporary = $assembledDirectory.'/'.$uploadSession->id.'.tmp';
        $output = fopen($temporary, 'wb');
        foreach ($parts as $part) {
            $input = Storage::disk('local')->readStream($part);
            stream_copy_to_stream($input, $output);
            fclose($input);
        }
        fclose($output);
        abort_if(filesize($temporary) !== $uploadSession->size_bytes, 422, __('v3.upload_size_mismatch'));
        $policy->validateName($uploadSession->original_name);

        $workspaceId = (int) data_get($uploadSession->metadata, 'workspace_id');
        abort_unless($request->user()->currentWorkspace()?->id === $workspaceId, 403);
        $extension = strtolower((string) pathinfo($uploadSession->original_name, PATHINFO_EXTENSION));
        $path = 'gojet/files/'.$workspaceId.'/'.Str::uuid().($extension !== '' ? '.'.$extension : '');
        $stream = fopen($temporary, 'rb');
        Storage::disk($uploadSession->disk)->put($path, $stream, ['visibility' => 'private']);
        fclose($stream);

        $share = $request->user()->fileShares()->create([
            'workspace_id' => $workspaceId,
            'slug' => $this->uniqueSlug(),
            'disk' => $uploadSession->disk,
            'path' => $path,
            'original_name' => $uploadSession->original_name,
            'mime_type' => data_get($uploadSession->metadata, 'mime_type'),
            'size_bytes' => $uploadSession->size_bytes,
            'sha256' => hash_file('sha256', $temporary),
            'visibility' => data_get($uploadSession->metadata, 'visibility', 'unlisted'),
            'expires_at' => data_get($uploadSession->metadata, 'expires_at'),
            'max_downloads' => data_get($uploadSession->metadata, 'max_downloads'),
            'scan_status' => config('gojet.storage.malware_scan', false) ? 'pending' : 'not_configured',
        ]);
        @unlink($temporary);
        Storage::disk('local')->deleteDirectory('gojet/chunks/'.$uploadSession->id);
        $uploadSession->update(['status' => 'completed']);

        return response()->json(['id' => $share->id, 'slug' => $share->slug, 'manage_url' => route('files.manage', $share)]);
    }

    private function uniqueSlug(): string
    {
        do {
            $slug = Str::lower(Str::random(12));
        } while (FileShare::withTrashed()->where('slug', $slug)->exists());

        return $slug;
    }

    private function authorizeOwner(Request $request, FileShare $share): void
    {
        abort_unless($request->user()->is_admin || $request->user()->currentWorkspace()?->id === $share->workspace_id, 403);
    }

    private function authorizePublicAccess(Request $request, FileShare $share): void
    {
        if ($share->visibility === 'private') {
            abort_unless($request->user() && ($request->user()->is_admin || $request->user()->id === $share->user_id), 404);
        }
    }
}
