<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Services\CloudflareCustomHostnameService;
use App\Services\QuotaService;
use App\Services\UrlSafetyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use InvalidArgumentException;
use Throwable;

class WorkspaceDomainController extends Controller
{
    public function index(Request $request): View
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $domains = Domain::where('workspace_id', $workspace->id)->withCount(['links', 'profilePages'])->latest()->get();

        return view('domains.index', compact('workspace', 'domains'));
    }

    public function store(Request $request, QuotaService $quotas): RedirectResponse
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $quotas->ensureCanCreate($workspace, 'domains');
        $data = $request->validate([
            'hostname' => ['required', 'string', 'max:253', 'regex:/^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i', Rule::unique('domains', 'hostname')],
        ]);
        $hostname = Str::lower(rtrim($data['hostname'], '.'));
        abort_if($hostname === strtolower((string) config('gojet.default_host')), 422, __('messages.domain_unusable'));
        $request->user()->domains()->create([
            'workspace_id' => $workspace->id,
            'hostname' => $hostname,
            'verification_token' => Str::random(48),
            'status' => 'pending',
            'certificate_status' => 'pending',
            'branding_settings' => ['title' => config('app.name'), 'message' => 'The requested branded link does not exist.'],
        ]);

        return back()->with('status', __('messages.domain_created'));
    }

    public function verify(Request $request, Domain $domain, CloudflareCustomHostnameService $cloudflare): RedirectResponse
    {
        $this->authorizeDomain($request, $domain);
        $recordName = config('gojet.domain_verification_prefix').'.'.$domain->hostname;
        $records = dns_get_record($recordName, DNS_TXT) ?: [];
        $verified = collect($records)->contains(function (array $record) use ($domain): bool {
            $value = (string) ($record['txt'] ?? implode('', $record['entries'] ?? []));

            return hash_equals($domain->verification_token, trim($value, '"'));
        });
        if (! $verified) {
            return back()->withErrors(['hostname' => __('messages.domain_dns_missing')]);
        }
        $domain->update(['verified_at' => now(), 'status' => 'active', 'certificate_status' => $cloudflare->enabled() ? 'provisioning' : 'external', 'provisioning_error' => null]);
        try {
            $cloudflare->provision($domain);
        } catch (Throwable $exception) {
            $domain->update(['certificate_status' => 'error', 'provisioning_error' => $exception->getMessage()]);

            return back()->withErrors(['hostname' => $exception->getMessage()]);
        }

        return back()->with('status', __('messages.domain_verified'));
    }

    public function refresh(Request $request, Domain $domain, CloudflareCustomHostnameService $cloudflare): RedirectResponse
    {
        $this->authorizeDomain($request, $domain);
        try {
            $cloudflare->refresh($domain);
        } catch (Throwable $exception) {
            $domain->update(['provisioning_error' => $exception->getMessage()]);

            return back()->withErrors(['hostname' => $exception->getMessage()]);
        }

        return back()->with('status', __('messages.domain_refreshed'));
    }

    public function update(Request $request, Domain $domain, UrlSafetyService $safety): RedirectResponse
    {
        $this->authorizeDomain($request, $domain);
        $data = $request->validate([
            'not_found_url' => ['nullable', 'url:http,https', 'max:2048'],
            'brand_title' => ['nullable', 'string', 'max:160'],
            'brand_message' => ['nullable', 'string', 'max:1000'],
            'brand_color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);
        if (filled($data['not_found_url'] ?? null)) {
            try {
                $data['not_found_url'] = $safety->normalizeAndValidate($data['not_found_url']);
            } catch (InvalidArgumentException $exception) {
                return back()->withErrors(['not_found_url' => $exception->getMessage()]);
            }
        }
        $domain->update([
            'not_found_url' => $data['not_found_url'] ?? null,
            'branding_settings' => [
                'title' => $data['brand_title'] ?? config('app.name'),
                'message' => $data['brand_message'] ?? 'The requested branded link does not exist.',
                'color' => $data['brand_color'] ?? '#06b6d4',
            ],
        ]);

        return back()->with('status', __('messages.domain_updated'));
    }

    public function setDefault(Request $request, Domain $domain): RedirectResponse
    {
        $this->authorizeDomain($request, $domain);
        abort_unless($domain->isUsable(), 422, __('messages.domain_unusable'));
        DB::transaction(function () use ($domain): void {
            Domain::where('workspace_id', $domain->workspace_id)->whereKeyNot($domain->id)->update(['is_default' => false]);
            $domain->update(['is_default' => true]);
        });

        return back()->with('status', __('messages.domain_default'));
    }

    public function destroy(Request $request, Domain $domain, CloudflareCustomHostnameService $cloudflare): RedirectResponse
    {
        $this->authorizeDomain($request, $domain);
        abort_if($domain->links()->exists() || $domain->profilePages()->exists(), 422, __('messages.domain_in_use'));
        try {
            $cloudflare->remove($domain);
        } catch (Throwable $exception) {
            return back()->withErrors(['hostname' => $exception->getMessage()]);
        }
        $domain->delete();

        return back()->with('status', __('messages.domain_deleted'));
    }

    private function authorizeDomain(Request $request, Domain $domain): void
    {
        abort_unless($request->user()->is_admin || $request->user()->currentWorkspace()?->id === $domain->workspace_id, 403);
    }
}
