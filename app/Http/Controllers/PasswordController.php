<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\MailDeliveryService;
use App\Services\TurnstileVerifier;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\View\View;

class PasswordController extends Controller
{
    public function requestForm(): View
    {
        abort_unless(config('gojet.auth.allow_password_reset', true), 404);

        return view('account-access', ['mode' => 'forgot']);
    }

    public function email(Request $request, MailDeliveryService $mail, TurnstileVerifier $turnstile): RedirectResponse
    {
        abort_unless(config('gojet.auth.allow_password_reset', true), 404);
        $turnstile->verify($request, 'password-reset');
        $data = $request->validate(['email' => ['required', 'email:rfc']]);
        $result = $mail->sendPasswordReset($data['email']);

        return $result['ok']
            ? back()->with('status', '密码重置邮件已经发送。')
            : back()->withErrors(['email' => $result['message']]);
    }

    public function resetForm(Request $request, string $token): View
    {
        return view('account-access', ['mode' => 'reset', 'token' => $token, 'email' => $request->query('email')]);
    }

    public function reset(Request $request): RedirectResponse
    {
        $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email:rfc'],
            'password' => [
                'required', 'confirmed',
                PasswordRule::min((int) config('gojet.auth.password_min_length', 12))->letters()->mixedCase()->numbers()->symbols(),
            ],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
                event(new PasswordReset($user));
            },
        );

        return $status === Password::PASSWORD_RESET
            ? redirect()->route('login')->with('status', __($status))
            : back()->withErrors(['email' => __($status)]);
    }
}
