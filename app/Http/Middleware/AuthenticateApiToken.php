<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next, ?string $ability = null): Response
    {
        $plain = $request->bearerToken();
        if (! is_string($plain) || strlen($plain) < 32) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $token = ApiToken::with(['user', 'workspace'])->where('token_hash', hash('sha256', $plain))->first();
        if (! $token || ! $token->workspace || ($token->expires_at && $token->expires_at->isPast()) || $token->user->status !== 'active' || $token->workspace->status !== 'active') {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        if ($ability && ! $token->can($ability)) {
            return response()->json(['message' => 'Token lacks the required ability.'], 403);
        }

        $token->forceFill(['last_used_at' => now()])->saveQuietly();
        $request->setUserResolver(fn () => $token->user);
        $request->attributes->set('api_token', $token);
        $request->attributes->set('workspace', $token->workspace);

        return $next($request);
    }
}
