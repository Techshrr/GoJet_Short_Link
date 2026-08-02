<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FileShare;
use App\Services\FilePolicyService;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');

        return response()->json(FileShare::where('workspace_id', $workspace->id)->latest()->paginate(min(100, max(1, $request->integer('per_page', 50)))));
    }

    public function store(Request $request, FilePolicyService $policy, QuotaService $quotas): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $quotas->ensureCanCreate($workspace, 'files');
        $data = $request->validate([
            'file' => ['required', 'file'],
            'visibility' => ['required', Rule::in(['public', 'unlisted', 'private'])],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'max_downloads' => ['nullable', 'integer', 'min:1'],
        ]);
        $file = $request->file('file');
        $policy->validateUpload($file);
        $quotas->ensureCanCreate($workspace, 'storage_mb', (int) ceil($file->getSize() / 1048576));
        $disk = (string) config('gojet.file_disk', config('filesystems.default', 'local'));
        $extension = strtolower($file->getClientOriginalExtension());
        $path = 'gojet/files/'.$workspace->id.'/'.Str::uuid().($extension ? '.'.$extension : '');
        Storage::disk($disk)->put($path, fopen($file->getRealPath(), 'rb'), ['visibility' => 'private']);
        $share = $request->user()->fileShares()->create([
            'workspace_id' => $workspace->id,
            'slug' => $this->slug(),
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

        return response()->json(['data' => $share, 'url' => route('files.public', $share->slug), 'download_url' => route('files.download', $share->slug)], 201);
    }

    public function show(Request $request, FileShare $fileShare): JsonResponse
    {
        $this->authorize($request, $fileShare);

        return response()->json(['data' => $fileShare]);
    }

    public function update(Request $request, FileShare $fileShare): JsonResponse
    {
        $this->authorize($request, $fileShare);
        $data = $request->validate([
            'visibility' => ['sometimes', Rule::in(['public', 'unlisted', 'private'])],
            'expires_at' => ['nullable', 'date'],
            'max_downloads' => ['nullable', 'integer', 'min:1'],
            'password' => ['nullable', 'string', 'min:8', 'max:190'],
            'remove_password' => ['nullable', 'boolean'],
        ]);
        if ($request->boolean('remove_password')) {
            $data['password_hash'] = null;
        } elseif (filled($data['password'] ?? null)) {
            $data['password_hash'] = Hash::make($data['password']);
        }
        unset($data['password'], $data['remove_password']);
        $fileShare->update($data);

        return response()->json(['data' => $fileShare->fresh()]);
    }

    public function destroy(Request $request, FileShare $fileShare): JsonResponse
    {
        $this->authorize($request, $fileShare);
        $fileShare->delete();

        return response()->json(status: 204);
    }

    private function authorize(Request $request, FileShare $share): void
    {
        abort_unless($share->workspace_id === $request->attributes->get('workspace')?->id, 404);
    }

    private function slug(): string
    {
        do {
            $slug = Str::lower(Str::random(12));
        } while (FileShare::withTrashed()->where('slug', $slug)->exists());

        return $slug;
    }
}
