<?php

namespace App\Http\Controllers;

use App\Services\MailDeliveryService;
use App\Services\SiteConfiguration;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class EmailVerificationController extends Controller
{
    public function notice(Request $request): View|RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail() || ! config('gojet.require_email_verification')) {
            return redirect()->route('dashboard');
        }

        return view('account-access', [
            'mode' => 'verify',
            'mailReady' => app(SiteConfiguration::class)->isMailReady(),
        ]);
    }

    public function verify(EmailVerificationRequest $request): RedirectResponse
    {
        $request->fulfill();

        return redirect()->route('dashboard')->with('status', __('messages.email_verified'));
    }

    public function resend(Request $request, MailDeliveryService $mail): RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->route('dashboard');
        }

        $result = $mail->sendVerification($request->user());

        return $result['ok']
            ? back()->with('status', __('messages.verification_sent'))
            : back()->withErrors(['email' => $result['message']]);
    }
}
