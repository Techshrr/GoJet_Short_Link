<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\MailDeliveryService;
use App\Services\TurnstileVerifier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function loginForm(): View
    {
        return view('auth', ['mode' => 'login']);
    }

    public function registerForm(): View
    {
        abort_unless(config('gojet.allow_registration'), 404);

        return view('auth', ['mode' => 'register']);
    }

    public function login(Request $request, TurnstileVerifier $turnstile): RedirectResponse
    {
        $turnstile->verify($request, 'login');
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => __('auth.failed')])->onlyInput('email');
        }

        if ($request->user()->status !== 'active') {
            Auth::logout();

            return back()->withErrors(['email' => __('auth.inactive')]);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    public function register(Request $request, MailDeliveryService $mail, TurnstileVerifier $turnstile): RedirectResponse
    {
        abort_unless(config('gojet.allow_registration'), 404);
        $turnstile->verify($request, 'register');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email:rfc', 'max:190', 'unique:users,email'],
            'password' => [
                'required', 'confirmed',
                Password::min((int) config('gojet.auth.password_min_length', 12))->letters()->mixedCase()->numbers()->symbols(),
            ],
        ]);

        $blockedDomains = collect(config('gojet.auth.blocked_email_domains', []))->map(fn ($value) => strtolower(trim((string) $value)));
        $domain = strtolower((string) str($data['email'])->afterLast('@'));
        if ($blockedDomains->contains($domain)) {
            return back()->withErrors(['email' => '该邮箱域名不允许注册。'])->onlyInput('name', 'email');
        }

        $user = User::create($data + ['status' => 'active']);
        Auth::login($user);
        $request->session()->regenerate();

        if (config('gojet.require_email_verification')) {
            $result = $mail->sendVerification($user);

            return redirect()->route('verification.notice')->with(
                $result['ok'] ? 'status' : 'mail_error',
                $result['ok'] ? '验证邮件已经发送。' : $result['message'],
            );
        }

        return redirect()->route('dashboard');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }
}
