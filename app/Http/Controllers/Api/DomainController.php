<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Services\CloudflareCustomHostnameService;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

class DomainController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');

        return response()->json(Domain::where('workspace_id', $workspace->id)->withCount('links')->latest()->paginate(min(100, max(1, $request->integer('per_page', 50)))));
    }

    public function store(Request $request, QuotaService $quotas): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $quotas->ensureCanCreate($workspace, 'domains');
        $data = $request->validate([
            'hostname' => [
                'required', 'string', 'max:253',
                'regex:/^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i',
                Rule::unique('domains', 'hostname'),
            ],
        ]);
        $hostname = Str::lower(rtrim($data['hostname'], '.'));
        abort_if($hostname === strtolower((string) config('gojet.default_host')), 422, 'The platform host cannot be added as a custom domain.');
        $domain = $request->user()->domains()->create([
            'workspace_id' => $workspace->id,
            'hostname' => $hostname,
            'verification_token' => Str::random(48),
            'status' => 'pending',
            'certificate_status' => 'pending',
        ]);

        return response()->json([
            'data' => $domain,
            'verification' => [
                'type' => 'TXT',
                'name' => config('gojet.domain_verification_prefix').'.'.$hostname,
                'value' => $domain->verification_token,
            ],
        ], 201);
    }

    public function show(Request $request, Domain $domain): JsonResponse
    {
        $this->authorize($request, $domain);

        return response()->json([
            'data' => $domain->loadCount('links'),
            'verification' => [
                'type' => 'TXT',
                'name' => config('gojet.domain_verification_prefix').'.'.$domain->hostname,
                'value' => $domain->verification_token,
            ],
        ]);
    }

    public function verify(Request $request, Domain $domain, CloudflareCustomHostnameService $cloudflare): JsonResponse
    {
        $this->authorize($request, $domain);
        $recordName = config('gojet.domain_verification_prefix').'.'.$domain->hostname;
        $records = dns_get_record($recordName, DNS_TXT) ?: [];
        $verified = collect($records)->contains(function (array $record) use ($domain): bool {
            $value = (string) ($record['txt'] ?? implode('', $record['entries'] ?? []));

            return hash_equals($domain->verification_token, trim($value, '"'));
        });
        if (! $verified) {
            return response()->json(['message' => 'DNS verification record was not found.'], 422);
        }

        $domain->update([
            'verified_at' => now(),
            'status' => 'active',
            'certificate_status' => $cloudflare->enabled() ? 'provisioning' : 'external',
            'provisioning_error' => null,
        ]);
        try {
            $cloudflare->provision($domain);
        } catch (Throwable $exception) {
            $domain->update(['certificate_status' => 'error', 'provisioning_error' => $exception->getMessage()]);

            return response()->json(['message' => $exception->getMessage(), 'data' => $domain->fresh()], 502);
        }

        return response()->json(['data' => $domain->fresh()]);
    }

    public function refresh(Request $request, Domain $domain, CloudflareCustomHostnameService $cloudflare): JsonResponse
    {
        $this->authorize($request, $domain);
        try {
            $cloudflare->refresh($domain);
        } catch (Throwable $exception) {
            $domain->update(['provisioning_error' => $exception->getMessage()]);

            return response()->json(['message' => $exception->getMessage(), 'data' => $domain->fresh()], 502);
        }

        return response()->json(['data' => $domain->fresh()]);
    }

    public function setDefault(Request $request, Domain $domain): JsonResponse
    {
        $this->authorize($request, $domain);
        abort_unless($domain->isUsable(), 422, 'Only an active verified domain may be selected.');
        DB::transaction(function () use ($domain): void {
            Domain::where('workspace_id', $domain->workspace_id)->whereKeyNot($domain->id)->update(['is_default' => false]);
            $domain->update(['is_default' => true]);
        });

        return response()->json(['data' => $domain->fresh()]);
    }

    public function destroy(Request $request, Domain $domain, CloudflareCustomHostnameService $cloudflare): JsonResponse
    {
        $this->authorize($request, $domain);
        abort_if($domain->links()->exists() || $domain->profilePages()->exists(), 422, 'Remove all links and profile pages from this domain first.');
        try {
            $cloudflare->remove($domain);
        } catch (Throwable $exception) {
            return response()->json(['message' => $exception->getMessage()], 502);
        }
        $domain->delete();

        return response()->json(status: 204);
    }

    private function authorize(Request $request, Domain $domain): void
    {
        abort_unless($domain->workspace_id === $request->attributes->get('workspace')?->id, 404);
    }
}
