<?php

namespace App\Http\Controllers;

use App\Models\Link;
use App\Services\AnalyticsRecorder;
use App\Services\DestinationUrlBuilder;
use App\Services\SmartRoutingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\View\View;

class RedirectController extends Controller
{
    public function resolve(
        Request $request,
        string $slug,
        SmartRoutingService $routing,
        DestinationUrlBuilder $urls,
        AnalyticsRecorder $analytics,
    ): RedirectResponse|View {
        $host = strtolower($request->getHost());
        $link = $this->findLink($host, $slug);

        abort_unless($link, 404);
        abort_if($link->domain_id && ! $link->domain?->isUsable(), 404);
        abort_if($link->status === 'disabled' || $link->archived_at, 404);
        abort_if($link->starts_at && $link->starts_at->isFuture(), 404);
        abort_if($link->expires_at && $link->expires_at->isPast(), 410);
        abort_if($link->max_clicks && $link->clicks_count >= $link->max_clicks, 410);

        if ($link->password_hash && ! $request->session()->get('gojet.link_access.'.$link->id)) {
            return view('link-password', compact('link'));
        }

        $destination = $routing->choose($link, $request);
        $target = $urls->build($destination?->target_url ?? $link->target_url, $link->utm_parameters ?? [], $request->query());
        $language = Str::before(Str::lower((string) $request->header('Accept-Language', '')), ',');

        if (config('gojet.analytics.enabled', true)) {
            $analytics->record($link, [
                'event_uuid' => (string) Str::uuid(),
                'request_id' => $request->header('X-Request-ID'),
                'destination_id' => $destination?->id,
                'ip' => $request->ip(),
                'forwarded_for' => $request->header('X-Forwarded-For'),
                'country_code' => $this->countryCode($request),
                'region' => $request->header('CF-Region', $request->header('X-GoJet-Region')),
                'city' => $request->header('CF-IPCity', $request->header('X-GoJet-City')),
                'language' => Str::before($language, '-'),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 1000),
                'referrer' => mb_substr((string) $request->headers->get('referer'), 0, 2048),
                'query' => $request->query(),
            ], 'laravel');
        }

        return redirect()->away($target, $link->redirect_type, [
            'Cache-Control' => 'private, no-store, max-age=0',
            'Pragma' => 'no-cache',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
    }

    public function unlock(Request $request, string $slug): RedirectResponse
    {
        $host = strtolower($request->getHost());
        $link = $this->findLink($host, $slug);
        abort_unless($link && $link->password_hash, 404);

        $request->validate(['password' => ['required', 'string', 'max:190']]);
        if (! Hash::check($request->string('password')->toString(), $link->password_hash)) {
            return back()->withErrors(['password' => __('messages.invalid_link_password')]);
        }

        $request->session()->put('gojet.link_access.'.$link->id, true);

        return redirect()->to('/'.$link->slug);
    }

    private function countryCode(Request $request): ?string
    {
        $country = strtoupper((string) $request->headers->get('CF-IPCountry'));

        return preg_match('/^[A-Z]{2}$/', $country) === 1 && $country !== 'XX' ? $country : null;
    }

    private function findLink(string $host, string $slug): ?Link
    {
        return Cache::remember(
            'gojet:redirect:'.$host.':'.$slug,
            config('gojet.link_cache_ttl'),
            fn (): ?Link => Link::query()
                ->with(['domain', 'destinations.rules', 'routingRules.destination'])
                ->where('host', $host)
                ->where('slug', $slug)
                ->first(),
        );
    }
}
