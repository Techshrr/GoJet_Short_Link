<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Domain;
use App\Models\Folder;
use App\Models\Link;
use App\Models\Tag;
use App\Services\ShortCodeGenerator;
use App\Services\UrlSafetyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class LinkImportExportController extends Controller
{
    public function export(Request $request): StreamedResponse
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless($workspace, 409, __('v3.workspace_required'));

        $query = Link::withTrashed()
            ->where('workspace_id', $workspace->id)
            ->with(['domain', 'campaign', 'folder', 'tags'])
            ->orderBy('id');
        if ($request->filled('ids')) {
            $ids = collect(explode(',', $request->string('ids')->toString()))->map('intval')->filter()->take(1000);
            $query->whereIn('id', $ids);
        }

        return response()->streamDownload(function () use ($query): void {
            $output = fopen('php://output', 'wb');
            fputcsv($output, ['id', 'title', 'short_url', 'target_url', 'status', 'redirect_type', 'campaign', 'folder', 'tags', 'utm_source', 'utm_medium', 'utm_campaign', 'starts_at', 'expires_at', 'max_clicks', 'clicks_count', 'created_at']);
            $query->chunkById(200, function ($links) use ($output): void {
                foreach ($links as $link) {
                    fputcsv($output, [
                        $link->id,
                        $link->title,
                        $link->shortUrl(),
                        $link->target_url,
                        $link->trashed() ? 'trashed' : ($link->archived_at ? 'archived' : $link->status),
                        $link->redirect_type,
                        $link->campaign?->name,
                        $link->folder?->name,
                        $link->tags->pluck('name')->implode('|'),
                        data_get($link->utm_parameters, 'source'),
                        data_get($link->utm_parameters, 'medium'),
                        data_get($link->utm_parameters, 'campaign'),
                        $link->starts_at?->toIso8601String(),
                        $link->expires_at?->toIso8601String(),
                        $link->max_clicks,
                        $link->clicks_count,
                        $link->created_at?->toIso8601String(),
                    ]);
                }
            });
            fclose($output);
        }, 'gojet-links-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function import(Request $request, ShortCodeGenerator $codes, UrlSafetyService $safety): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace();
        abort_unless($workspace, 409, __('v3.workspace_required'));
        $request->validate(['file' => ['required', 'file', 'max:5120', 'mimes:csv,txt']]);

        $handle = fopen($request->file('file')->getRealPath(), 'rb');
        abort_unless($handle, 422, __('v3.import_unreadable'));
        $headers = array_map(fn ($header) => Str::snake(trim((string) $header)), fgetcsv($handle) ?: []);
        abort_unless(in_array('target_url', $headers, true), 422, __('v3.import_target_required'));

        $created = 0;
        $errors = [];
        $rowNumber = 1;
        while (($row = fgetcsv($handle)) !== false && $rowNumber <= 1000) {
            $rowNumber++;
            $row = array_pad($row, count($headers), null);
            $data = array_combine($headers, array_slice($row, 0, count($headers)));
            try {
                $target = $safety->normalizeAndValidate((string) ($data['target_url'] ?? ''));
                $domain = $this->domain($workspace->id, $data['domain'] ?? null);
                $host = $domain?->hostname ?: strtolower((string) config('gojet.default_host'));
                $slug = trim((string) ($data['slug'] ?? '')) ?: $codes->generate($domain?->id);
                if (! preg_match('/^[A-Za-z0-9_-]{3,64}$/', $slug)) {
                    throw new \InvalidArgumentException('Invalid slug');
                }
                if (Link::withTrashed()->where('host', $host)->where('slug', $slug)->exists()) {
                    $slug = $codes->generate($domain?->id);
                }

                $campaign = $this->campaign($request, $workspace->id, $data['campaign'] ?? null);
                $folder = $this->folder($request, $workspace->id, $data['folder'] ?? null);
                $link = $request->user()->links()->create([
                    'workspace_id' => $workspace->id,
                    'domain_id' => $domain?->id,
                    'campaign_id' => $campaign?->id,
                    'folder_id' => $folder?->id,
                    'host' => $host,
                    'slug' => $slug,
                    'target_url' => $target,
                    'title' => Str::limit((string) ($data['title'] ?? ''), 190, ''),
                    'description' => Str::limit((string) ($data['description'] ?? ''), 4000, ''),
                    'notes' => Str::limit((string) ($data['notes'] ?? ''), 10000, ''),
                    'status' => in_array(($data['status'] ?? 'active'), ['active', 'disabled'], true) ? $data['status'] : 'active',
                    'redirect_type' => in_array((int) ($data['redirect_type'] ?? 302), [301, 302, 307, 308], true) ? (int) $data['redirect_type'] : 302,
                    'starts_at' => filled($data['starts_at'] ?? null) ? $data['starts_at'] : null,
                    'expires_at' => filled($data['expires_at'] ?? null) ? $data['expires_at'] : null,
                    'max_clicks' => filled($data['max_clicks'] ?? null) ? max(1, (int) $data['max_clicks']) : null,
                    'utm_parameters' => array_filter([
                        'source' => $data['utm_source'] ?? null,
                        'medium' => $data['utm_medium'] ?? null,
                        'campaign' => $data['utm_campaign'] ?? null,
                        'content' => $data['utm_content'] ?? null,
                        'term' => $data['utm_term'] ?? null,
                    ]),
                ]);
                $this->syncTags($request, $workspace->id, $link, (string) ($data['tags'] ?? ''));
                $created++;
            } catch (Throwable $exception) {
                $errors[] = __('v3.import_row_error', ['row' => $rowNumber, 'message' => $exception->getMessage()]);
            }
        }
        fclose($handle);

        return back()->with('status', __('v3.import_completed', ['count' => $created]))->with('import_errors', array_slice($errors, 0, 20));
    }

    private function domain(int $workspaceId, mixed $hostname): ?Domain
    {
        if (! filled($hostname)) {
            return null;
        }

        return Domain::where('workspace_id', $workspaceId)->where('hostname', strtolower(trim((string) $hostname)))->whereNotNull('verified_at')->firstOrFail();
    }

    private function campaign(Request $request, int $workspaceId, mixed $name): ?Campaign
    {
        if (! filled($name)) {
            return null;
        }
        $name = Str::limit(trim((string) $name), 120, '');

        return Campaign::firstOrCreate(
            ['workspace_id' => $workspaceId, 'slug' => Str::slug($name) ?: Str::lower(Str::random(8))],
            ['user_id' => $request->user()->id, 'name' => $name, 'status' => 'active'],
        );
    }

    private function folder(Request $request, int $workspaceId, mixed $name): ?Folder
    {
        if (! filled($name)) {
            return null;
        }
        $name = Str::limit(trim((string) $name), 120, '');

        return Folder::firstOrCreate(
            ['workspace_id' => $workspaceId, 'name' => $name, 'parent_id' => null],
            ['user_id' => $request->user()->id, 'position' => 0],
        );
    }

    private function syncTags(Request $request, int $workspaceId, Link $link, string $value): void
    {
        $ids = collect(preg_split('/[|,]/', $value) ?: [])
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->take(20)
            ->map(function (string $name) use ($request, $workspaceId) {
                return Tag::firstOrCreate(
                    ['workspace_id' => $workspaceId, 'slug' => Str::slug($name) ?: Str::lower(Str::random(8))],
                    ['user_id' => $request->user()->id, 'name' => Str::limit($name, 80, '')],
                )->id;
            });
        $link->tags()->sync($ids);
    }
}
