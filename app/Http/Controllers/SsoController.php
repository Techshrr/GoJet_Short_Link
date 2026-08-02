<?php

namespace App\Http\Controllers;

use App\Models\SsoConnection;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AuditLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use RuntimeException;
use Throwable;

class SsoController extends Controller
{
    public function index(Request $request): View
    {
        $workspace = $this->adminWorkspace($request);

        return view('sso.index', [
            'workspace' => $workspace,
            'connections' => $workspace->ssoConnections()->latest()->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $workspace = $this->adminWorkspace($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'provider' => ['required', Rule::in(['oidc'])],
            'issuer' => ['required', 'url:https', 'max:2048'],
            'client_id' => ['required', 'string', 'max:500'],
            'client_secret' => ['required', 'string', 'max:2000'],
            'scopes' => ['nullable', 'string', 'max:500'],
            'domains' => ['nullable', 'string', 'max:2000'],
            'enforce_for_members' => ['nullable', 'boolean'],
        ]);

        $connection = new SsoConnection([
            'workspace_id' => $workspace->id,
            'provider' => 'oidc',
            'name' => $data['name'],
            'domains' => $this->domains($data['domains'] ?? ''),
            'is_enabled' => true,
            'enforce_for_members' => $request->boolean('enforce_for_members'),
        ]);
        $connection->setConfiguration([
            'issuer' => rtrim($data['issuer'], '/'),
            'client_id' => $data['client_id'],
            'client_secret' => $data['client_secret'],
            'scopes' => $this->scopes($data['scopes'] ?? ''),
        ]);
        $connection->save();

        return back()->with('status', __('v3.sso_created'));
    }

    public function update(Request $request, SsoConnection $connection): RedirectResponse
    {
        $workspace = $this->adminWorkspace($request);
        abort_unless($connection->workspace_id === $workspace->id, 404);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'issuer' => ['required', 'url:https', 'max:2048'],
            'client_id' => ['required', 'string', 'max:500'],
            'client_secret' => ['nullable', 'string', 'max:2000'],
            'scopes' => ['nullable', 'string', 'max:500'],
            'domains' => ['nullable', 'string', 'max:2000'],
            'is_enabled' => ['nullable', 'boolean'],
            'enforce_for_members' => ['nullable', 'boolean'],
        ]);
        $configuration = $connection->configuration();
        $connection->fill([
            'name' => $data['name'],
            'domains' => $this->domains($data['domains'] ?? ''),
            'is_enabled' => $request->boolean('is_enabled'),
            'enforce_for_members' => $request->boolean('enforce_for_members'),
        ]);
        $connection->setConfiguration([
            'issuer' => rtrim($data['issuer'], '/'),
            'client_id' => $data['client_id'],
            'client_secret' => $data['client_secret'] ?: ($configuration['client_secret'] ?? ''),
            'scopes' => $this->scopes($data['scopes'] ?? ''),
        ]);
        $connection->save();
        Cache::forget($this->discoveryCacheKey($connection));

        return back()->with('status', __('v3.sso_updated'));
    }

    public function destroy(Request $request, SsoConnection $connection): RedirectResponse
    {
        $workspace = $this->adminWorkspace($request);
        abort_unless($connection->workspace_id === $workspace->id, 404);
        Cache::forget($this->discoveryCacheKey($connection));
        $connection->delete();

        return back()->with('status', __('v3.sso_deleted'));
    }

    public function redirect(Request $request, SsoConnection $connection): RedirectResponse
    {
        abort_unless($connection->is_enabled && $connection->provider === 'oidc', 404);
        $configuration = $connection->configuration();
        $discovery = $this->discovery($connection, $configuration);
        $state = Str::random(64);
        $nonce = Str::random(64);
        $verifier = Str::random(96);
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

        $request->session()->put('gojet.oidc.'.$connection->id, [
            'state_hash' => hash('sha256', $state),
            'nonce_hash' => hash('sha256', $nonce),
            'verifier' => $verifier,
            'created_at' => now()->timestamp,
        ]);

        $query = http_build_query([
            'client_id' => $configuration['client_id'],
            'redirect_uri' => route('sso.callback', $connection),
            'response_type' => 'code',
            'scope' => implode(' ', $configuration['scopes'] ?? ['openid', 'profile', 'email']),
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
        ], encoding_type: PHP_QUERY_RFC3986);

        return redirect()->away($discovery['authorization_endpoint'].'?'.$query);
    }

    public function callback(Request $request, SsoConnection $connection, AuditLogger $audit): RedirectResponse
    {
        abort_unless($connection->is_enabled && $connection->provider === 'oidc', 404);
        $flow = $request->session()->pull('gojet.oidc.'.$connection->id);
        abort_unless(is_array($flow) && now()->timestamp - (int) ($flow['created_at'] ?? 0) <= 600, 419, __('v3.sso_expired'));
        abort_unless(hash_equals((string) $flow['state_hash'], hash('sha256', $request->string('state')->toString())), 419, __('v3.sso_state_invalid'));
        abort_if($request->filled('error'), 403, $request->string('error_description', $request->string('error')->toString())->toString());

        $code = $request->string('code')->toString();
        abort_if($code === '', 422, __('v3.sso_code_missing'));
        $configuration = $connection->configuration();
        $discovery = $this->discovery($connection, $configuration);

        try {
            $token = Http::asForm()->timeout(15)->retry(2, 250)->post($discovery['token_endpoint'], [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => route('sso.callback', $connection),
                'client_id' => $configuration['client_id'],
                'client_secret' => $configuration['client_secret'],
                'code_verifier' => $flow['verifier'],
            ])->throw()->json();
            $accessToken = (string) ($token['access_token'] ?? '');
            throw_if($accessToken === '', RuntimeException::class, 'OIDC access token missing.');
            $claims = Http::withToken($accessToken)->acceptJson()->timeout(15)->retry(2, 250)
                ->get($discovery['userinfo_endpoint'])->throw()->json();
        } catch (Throwable $exception) {
            report($exception);

            return redirect()->route('login')->withErrors(['email' => __('v3.sso_exchange_failed')]);
        }

        $email = strtolower(trim((string) ($claims['email'] ?? '')));
        abort_unless(filter_var($email, FILTER_VALIDATE_EMAIL), 403, __('v3.sso_email_missing'));
        abort_if(array_key_exists('email_verified', $claims) && ! filter_var($claims['email_verified'], FILTER_VALIDATE_BOOL), 403, __('v3.sso_email_unverified'));
        $this->assertAllowedDomain($connection, $email);

        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => mb_substr((string) ($claims['name'] ?? $claims['preferred_username'] ?? strstr($email, '@', true)), 0, 120),
                'password' => Str::password(64),
                'status' => 'active',
                'email_verified_at' => now(),
            ],
        );
        abort_unless($user->status === 'active', 403, __('v3.account_suspended'));
        if (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
        $connection->workspace->members()->updateOrCreate(
            ['email' => $email],
            [
                'user_id' => $user->id,
                'role' => 'viewer',
                'status' => 'active',
                'accepted_at' => now(),
                'invitation_token_hash' => null,
            ],
        );

        Auth::login($user, remember: false);
        $request->session()->regenerate();
        $request->session()->put('gojet.workspace_id', $connection->workspace_id);
        $audit->record('sso.login', $connection, [
            'workspace_id' => $connection->workspace_id,
            'provider' => 'oidc',
            'subject' => hash('sha256', (string) ($claims['sub'] ?? $email)),
        ], $request);

        return redirect()->route('dashboard')->with('status', __('v3.sso_login_success'));
    }

    private function discovery(SsoConnection $connection, array $configuration): array
    {
        return Cache::remember($this->discoveryCacheKey($connection), now()->addHour(), function () use ($configuration): array {
            $issuer = rtrim((string) ($configuration['issuer'] ?? ''), '/');
            throw_if(! str_starts_with($issuer, 'https://'), RuntimeException::class, 'OIDC issuer must use HTTPS.');
            $document = Http::acceptJson()->timeout(15)->retry(2, 250)
                ->get($issuer.'/.well-known/openid-configuration')->throw()->json();
            throw_if(rtrim((string) ($document['issuer'] ?? ''), '/') !== $issuer, RuntimeException::class, 'OIDC issuer mismatch.');
            foreach (['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint'] as $key) {
                throw_if(! str_starts_with((string) ($document[$key] ?? ''), 'https://'), RuntimeException::class, "Invalid OIDC {$key}.");
            }

            return $document;
        });
    }

    private function adminWorkspace(Request $request): Workspace
    {
        $workspace = $request->user()->currentWorkspace() ?? abort(409, __('v3.workspace_required'));
        $role = $workspace->owner_user_id === $request->user()->id
            ? 'owner'
            : $workspace->members()->where('user_id', $request->user()->id)->where('status', 'active')->value('role');
        abort_unless($request->user()->is_admin || in_array($role, ['owner', 'admin'], true), 403);

        return $workspace;
    }

    private function domains(string $value): array
    {
        return collect(preg_split('/[\s,;]+/', strtolower($value)) ?: [])
            ->map(fn (string $domain): string => trim($domain, " .\t\n\r\0\x0B"))
            ->filter(fn (string $domain): bool => preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/', $domain) === 1)
            ->unique()->values()->all();
    }

    private function scopes(string $value): array
    {
        $scopes = collect(preg_split('/[\s,]+/', strtolower($value)) ?: [])->filter()->unique();

        return $scopes->merge(['openid', 'profile', 'email'])->unique()->values()->all();
    }

    private function assertAllowedDomain(SsoConnection $connection, string $email): void
    {
        $domains = $connection->domains ?? [];
        if ($domains === []) {
            return;
        }
        $domain = strtolower((string) strrchr($email, '@'));
        abort_unless(in_array(ltrim($domain, '@'), $domains, true), 403, __('v3.sso_domain_denied'));
    }

    private function discoveryCacheKey(SsoConnection $connection): string
    {
        return 'gojet:oidc:discovery:'.$connection->id.':'.$connection->updated_at?->timestamp;
    }
}
