<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    private const SUPPORTED = ['zh_CN', 'en'];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->session()->get('locale')
            ?? $request->cookie('gojet_locale')
            ?? $this->fromBrowser($request)
            ?? config('app.locale', 'zh_CN');

        if (! in_array($locale, self::SUPPORTED, true)) {
            $locale = 'zh_CN';
        }

        App::setLocale($locale);

        return $next($request);
    }

    private function fromBrowser(Request $request): ?string
    {
        $language = strtolower((string) $request->header('Accept-Language'));

        if (str_starts_with($language, 'zh')) {
            return 'zh_CN';
        }

        if (str_starts_with($language, 'en')) {
            return 'en';
        }

        return null;
    }
}
