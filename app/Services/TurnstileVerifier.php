<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Throwable;

class TurnstileVerifier
{
    public function verify(Request $request, string $action): void
    {
        if (! config('gojet.auth.turnstile_enabled', false)) {
            return;
        }

        $secret = (string) config('gojet.auth.turnstile_secret_key');
        $token = (string) $request->input('cf-turnstile-response');
        if ($secret === '' || $token === '') {
            throw ValidationException::withMessages([
                'cf-turnstile-response' => '请完成人机验证后再继续。',
            ]);
        }

        try {
            $response = Http::asForm()
                ->connectTimeout(3)
                ->timeout(8)
                ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                    'secret' => $secret,
                    'response' => $token,
                    'remoteip' => $request->ip(),
                    'idempotency_key' => (string) str()->uuid(),
                ]);
            $payload = $response->json();
        } catch (Throwable) {
            throw ValidationException::withMessages([
                'cf-turnstile-response' => '人机验证服务暂时不可用，请稍后重试。',
            ]);
        }

        $responseAction = (string) data_get($payload, 'action', '');
        if (! $response->successful()
            || data_get($payload, 'success') !== true
            || ($responseAction !== '' && $responseAction !== $action)) {
            throw ValidationException::withMessages([
                'cf-turnstile-response' => '人机验证失败或已经过期，请重新验证。',
            ]);
        }
    }
}
