<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\InstallationState;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class InstallCompleteController extends Controller
{
    public function __invoke(InstallationState $state): View|RedirectResponse
    {
        if (! $state->installed()) {
            return redirect()->route('install.welcome');
        }

        $metadata = $state->metadata();
        $siteUrl = rtrim((string) ($metadata['site_url'] ?? config('app.url')), '/');
        $adminPath = trim((string) ($metadata['admin_path'] ?? config('gojet.admin_path', 'manage')), '/');
        $admin = isset($metadata['admin_user_id'])
            ? User::query()->find($metadata['admin_user_id'])
            : User::query()->where('is_admin', true)->oldest()->first();

        if (! $admin) {
            return redirect()->route('home');
        }

        return view('install.complete', [
            'details' => [
                'site_url' => $siteUrl,
                'admin_url' => $siteUrl.'/'.$adminPath,
                'admin_name' => $admin->name,
                'admin_email' => $admin->email,
                'support_email' => (string) config('gojet.support_email'),
                'registration' => (bool) config('gojet.allow_registration'),
                'verification' => (bool) config('gojet.require_email_verification'),
            ],
        ]);
    }
}
