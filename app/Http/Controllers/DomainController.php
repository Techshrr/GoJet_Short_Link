<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Services\AuditLogger;
use App\Services\CloudflareCustomHostnameService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Throwable;

class DomainController extends Controller
{
    public function index(Request $request): View
    {
        return view('domains', [
            'domains' => $request->user()->domains()->latest()->get(),
        ]);
    }

    public function store(Request $request, AuditLogger $audit): RedirectResponse
    {
        $data = $request->validate([
            'hostname' => [
                'required', 'string', 'max:253',
                'regex:/^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i',
                Rule::unique('domains', 'hostname'),
            ],
        ]);

        $host = Str::lower(rtrim($data['hostname'], '.'));
        abort_if(
            $host === strtolower((string) config('gojet.default_host')),
            422,
            __('messages.platform_domain_forbidden'),
        );

        $domain = $request->user()->domains()->create([
            'hostname' => $host,
            'verification_token' => Str::random(48),
            'status' => 'pending',
            'certificate_status' => 'pending',
        ]);

        $audit->record('domain.created', $domain, ['hostname' => $host], $request);

        return back()->with('status', __('messages.domain_added'));
    }

    public function verify(
        Request $request,
        Domain $domain,
        CloudflareCustomHostnameService $cloudflare,
        AuditLogger $audit,
    ): RedirectResponse {
        $this->authorizeOwner($request, $domain);

        $recordName = config('gojet.domain_verification_prefix').'.'.$domain->hostname;
        $records = dns_get_record($recordName, DNS_TXT) ?: [];
        $verified = collect($records)->contains(function (array $record) use ($domain): bool {
            $value = (string) ($record['txt'] ?? implode('', $record['entries'] ?? []));

            return hash_equals($domain->verification_token, trim($value, '"'));
        });

        if (! $verified) {
            return back()->withErrors(['hostname' => __('messages.domain_not_verified')]);
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
            $domain->forceFill([
                'certificate_status' => 'error',
                'provisioning_error' => $exception->getMessage(),
            ])->save();

            $audit->record('domain.provisioning_failed', $domain, [
                'error' => $exception->getMessage(),
            ], $request);

            return back()->withErrors([
                'hostname' => __('messages.domain_provision_failed', ['message' => $exception->getMessage()]),
            ]);
        }

        $audit->record('domain.verified', $domain, ['hostname' => $domain->hostname], $request);

        return back()->with('status', __('messages.domain_verified'));
    }

    public function refresh(
        Request $request,
        Domain $domain,
        CloudflareCustomHostnameService $cloudflare,
        AuditLogger $audit,
    ): RedirectResponse {
        $this->authorizeOwner($request, $domain);

        try {
            $cloudflare->refresh($domain);
            $audit->record('domain.certificate_refreshed', $domain, [
                'status' => $domain->fresh()->certificate_status,
            ], $request);
        } catch (Throwable $exception) {
            $domain->forceFill(['provisioning_error' => $exception->getMessage()])->save();

            return back()->withErrors(['hostname' => $exception->getMessage()]);
        }

        return back()->with('status', __('messages.domain_refreshed'));
    }

    public function setDefault(Request $request, Domain $domain, AuditLogger $audit): RedirectResponse
    {
        $this->authorizeOwner($request, $domain);
        abort_unless($domain->isUsable(), 422, __('messages.domain_default_only_usable'));

        DB::transaction(function () use ($request, $domain): void {
            $request->user()->domains()->whereKeyNot($domain->id)->update(['is_default' => false]);
            $domain->update(['is_default' => true]);
        });

        $audit->record('domain.default_changed', $domain, ['hostname' => $domain->hostname], $request);

        return back()->with('status', __('messages.domain_default'));
    }

    public function destroy(
        Request $request,
        Domain $domain,
        CloudflareCustomHostnameService $cloudflare,
        AuditLogger $audit,
    ): RedirectResponse {
        $this->authorizeOwner($request, $domain);
        abort_if($domain->links()->exists(), 422, __('messages.domain_has_links'));

        try {
            $cloudflare->remove($domain);
        } catch (Throwable $exception) {
            return back()->withErrors([
                'hostname' => __('messages.domain_removal_failed', ['message' => $exception->getMessage()]),
            ]);
        }

        $audit->record('domain.deleted', $domain, ['hostname' => $domain->hostname], $request);
        $domain->delete();

        return back()->with('status', __('messages.domain_deleted'));
    }

    private function authorizeOwner(Request $request, Domain $domain): void
    {
        abort_unless($domain->user_id === $request->user()->id, 403);
    }
}
