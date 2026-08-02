<?php

namespace App\Http\Controllers;

use App\Models\EmailDeliveryLog;
use App\Services\AuditLogger;
use App\Services\EnvironmentWriter;
use App\Services\MailDeliveryService;
use App\Services\SiteConfiguration;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AdminSettingsController extends Controller
{
    private const RESERVED = [
        'about', 'api', 'api-tokens', 'contact', 'dashboard', 'domains', 'forgot-password',
        'install', 'links', 'locale', 'login', 'logout', 'privacy', 'register',
        'report-abuse', 'reset-password', 'storage', 'terms', 'up', 'verify-email',
    ];

    private const SECTIONS = [
        'general', 'branding', 'seo', 'mail', 'authentication', 'links', 'analytics', 'storage', 'maintenance', 'advanced',
    ];

    public function edit(Request $request, SiteConfiguration $configuration): View
    {
        $section = in_array($request->string('section')->toString(), self::SECTIONS, true)
            ? $request->string('section')->toString()
            : 'general';

        return view('admin.settings', [
            'section' => $section,
            'settings' => $configuration->all(),
            'adminPath' => config('gojet.admin_path', 'manage'),
            'environmentWritable' => app(EnvironmentWriter::class)->isWritable(),
            'mailReady' => $configuration->isMailReady(),
            'mailLogs' => EmailDeliveryLog::query()->latest()->limit(20)->get(),
            'storageDisks' => array_keys(config('filesystems.disks')),
        ]);
    }

    public function updateSection(
        Request $request,
        string $section,
        SiteConfiguration $configuration,
        AuditLogger $audit,
    ): RedirectResponse {
        abort_unless(in_array($section, self::SECTIONS, true) && $section !== 'advanced', 404);

        match ($section) {
            'general' => $this->saveGeneral($request, $configuration),
            'branding' => $this->saveBranding($request, $configuration),
            'seo' => $this->saveSeo($request, $configuration),
            'mail' => $this->saveMail($request, $configuration),
            'authentication' => $this->saveAuthentication($request, $configuration),
            'links' => $this->saveLinks($request, $configuration),
            'analytics' => $this->saveAnalytics($request, $configuration),
            'storage' => $this->saveStorage($request, $configuration),
            'maintenance' => $this->saveMaintenance($request, $configuration),
        };

        $audit->record('settings.updated', null, ['section' => $section], $request);
        Artisan::call('optimize:clear');
        $configuration->apply();

        return redirect()->route('admin.settings.index', ['section' => $section])
            ->with('status', '设置已经保存并立即生效。');
    }

    public function testMail(
        Request $request,
        MailDeliveryService $mail,
        SiteConfiguration $configuration,
    ): RedirectResponse {
        $data = $request->validate(['recipient' => ['required', 'email:rfc', 'max:190']]);
        $result = $mail->sendTest($request->user(), $data['recipient']);

        if ($result['ok']) {
            $settings = $configuration->all()['mail'];
            $settings['verified_at'] = now()->toIso8601String();
            $configuration->write('mail.transport', $settings, true);
            $configuration->apply();

            return back()->with('status', 'SMTP 测试邮件已成功发送，邮件通道现已标记为可用。');
        }

        return back()->withErrors(['recipient' => $result['message'].' '.$result['technical']]);
    }

    public function retryMail(
        Request $request,
        EmailDeliveryLog $emailDeliveryLog,
        MailDeliveryService $mail,
    ): RedirectResponse {
        $result = $mail->retry($emailDeliveryLog, $request->user());

        return $result['ok']
            ? back()->with('status', '邮件重试成功。')
            : back()->withErrors(['mail' => $result['message'].' '.$result['technical']]);
    }

    public function clearCaches(Request $request, AuditLogger $audit): RedirectResponse
    {
        Artisan::call('optimize:clear');
        $audit->record('system.caches_cleared', null, [], $request);

        return back()->with('status', '应用缓存、路由缓存、配置缓存和视图缓存已经清理。');
    }

    public function updateAdminPath(
        Request $request,
        EnvironmentWriter $environment,
        AuditLogger $audit,
    ): RedirectResponse {
        $data = $request->validate([
            'admin_path' => [
                'required', 'string', 'min:4', 'max:40', 'regex:/^[a-z0-9][a-z0-9-]+$/',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (in_array($value, self::RESERVED, true)) {
                        $fail('该路径属于系统保留路径。');
                    }
                },
            ],
        ]);

        if (! $environment->isWritable()) {
            return back()->withErrors(['admin_path' => '.env 文件不可写，无法修改后台路径。']);
        }

        $oldPath = (string) config('gojet.admin_path');
        $environment->write(['GOJET_ADMIN_PATH' => $data['admin_path']]);
        $audit->record('admin.path_changed', null, [
            'old_path' => $oldPath,
            'new_path' => $data['admin_path'],
        ], $request);

        Artisan::call('optimize:clear');

        return redirect('/'.$data['admin_path'].'/settings?section=advanced')
            ->with('status', '后台路径已更新。');
    }

    private function saveGeneral(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'site_name' => ['required', 'string', 'max:120'],
            'site_short_name' => ['required', 'string', 'max:40'],
            'tagline' => ['required', 'string', 'max:190'],
            'description' => ['required', 'string', 'max:500'],
            'support_email' => ['required', 'email:rfc', 'max:190'],
            'contact_email' => ['required', 'email:rfc', 'max:190'],
            'locale' => ['required', Rule::in(['zh_CN', 'en'])],
            'timezone' => ['required', 'timezone'],
            'footer_text' => ['nullable', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:190'],
            'address' => ['nullable', 'string', 'max:500'],
            'registration_number' => ['nullable', 'string', 'max:120'],
            'privacy_email' => ['nullable', 'email:rfc', 'max:190'],
            'copyright' => ['nullable', 'string', 'max:255'],
        ]);

        $configuration->write('site.identity', [
            'site_name' => $data['site_name'],
            'site_short_name' => $data['site_short_name'],
            'tagline' => $data['tagline'],
            'description' => $data['description'],
            'support_email' => $data['support_email'],
            'contact_email' => $data['contact_email'],
            'locale' => $data['locale'],
            'timezone' => $data['timezone'],
            'footer_text' => $data['footer_text'] ?? null,
        ]);
        $configuration->write('site.legal', [
            'company' => $data['company'] ?? null,
            'address' => $data['address'] ?? null,
            'registration_number' => $data['registration_number'] ?? null,
            'privacy_email' => $data['privacy_email'] ?? $data['support_email'],
            'copyright' => $data['copyright'] ?? null,
        ]);
    }

    private function saveBranding(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'brand_color' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'accent_color' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096'],
            'logo_dark' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096'],
            'logo_mark' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'favicon' => ['nullable', 'file', 'mimes:png,ico,webp', 'max:1024'],
            'apple_touch_icon' => ['nullable', 'image', 'mimes:png,webp', 'max:2048'],
            'og_image' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:6144'],
            'mail_logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ]);

        $current = $configuration->all()['branding'];
        $next = [
            'brand_color' => $data['brand_color'],
            'accent_color' => $data['accent_color'],
        ];

        foreach (['logo', 'logo_dark', 'logo_mark', 'favicon', 'apple_touch_icon', 'og_image', 'mail_logo'] as $field) {
            if (! $request->hasFile($field)) {
                $next[$field] = $current[$field] ?? null;
                continue;
            }

            if (filled($current[$field] ?? null)) {
                Storage::disk('public')->delete((string) $current[$field]);
            }

            $next[$field] = $request->file($field)->store('branding', 'public');
        }

        $configuration->write('site.branding', $next);
    }

    private function saveSeo(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'default_title' => ['required', 'string', 'max:190'],
            'title_template' => ['required', 'string', 'max:190'],
            'seo_description' => ['required', 'string', 'max:500'],
            'keywords' => ['nullable', 'string', 'max:1000'],
            'robots' => ['required', 'string', 'max:190'],
            'google_site_verification' => ['nullable', 'string', 'max:255'],
            'baidu_site_verification' => ['nullable', 'string', 'max:255'],
        ]);

        $configuration->write('site.seo', [
            'default_title' => $data['default_title'],
            'title_template' => $data['title_template'],
            'description' => $data['seo_description'],
            'keywords' => $data['keywords'] ?? null,
            'robots' => $data['robots'],
            'google_site_verification' => $data['google_site_verification'] ?? null,
            'baidu_site_verification' => $data['baidu_site_verification'] ?? null,
        ]);
    }

    private function saveMail(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'port' => ['required', 'integer', 'min:1', 'max:65535'],
            'encryption' => ['required', Rule::in(['tls', 'ssl', 'none'])],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:1000'],
            'ehlo_domain' => ['nullable', 'string', 'max:253'],
            'from_address' => ['required', 'email:rfc', 'max:190'],
            'from_name' => ['required', 'string', 'max:120'],
            'reply_to' => ['nullable', 'email:rfc', 'max:190'],
        ]);

        $current = $configuration->all()['mail'];
        $configuration->write('mail.transport', [
            'configured' => true,
            'host' => $data['host'],
            'port' => (int) $data['port'],
            'encryption' => $data['encryption'] ?? null,
            'username' => $data['username'] ?? null,
            'password' => filled($data['password'] ?? null) ? $data['password'] : ($current['password'] ?? null),
            'ehlo_domain' => $data['ehlo_domain'] ?? null,
            'from_address' => $data['from_address'],
            'from_name' => $data['from_name'],
            'reply_to' => $data['reply_to'] ?? null,
            'verified_at' => null,
        ], true);
    }

    private function saveAuthentication(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'password_min_length' => ['required', 'integer', 'min:8', 'max:128'],
            'turnstile_site_key' => ['nullable', 'string', 'max:255'],
            'turnstile_secret_key' => ['nullable', 'string', 'max:255'],
            'blocked_email_domains' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($request->boolean('require_email_verification') && ! $configuration->isMailReady()) {
            throw ValidationException::withMessages(['require_email_verification' => '启用强制邮箱验证前，必须先完成 SMTP 配置并通过测试。']);
        }

        $current = $configuration->all()['auth'];
        $siteKey = filled($data['turnstile_site_key'] ?? null)
            ? $data['turnstile_site_key']
            : ($current['turnstile_site_key'] ?? null);
        $secretKey = filled($data['turnstile_secret_key'] ?? null)
            ? $data['turnstile_secret_key']
            : ($current['turnstile_secret_key'] ?? null);
        if ($request->boolean('turnstile_enabled') && (! filled($siteKey) || ! filled($secretKey))) {
            throw ValidationException::withMessages([
                'turnstile_site_key' => '启用 Turnstile 前必须填写 Site Key 和 Secret Key。',
            ]);
        }

        $configuration->write('auth.policy', [
            'allow_registration' => $request->boolean('allow_registration'),
            'require_email_verification' => $request->boolean('require_email_verification'),
            'password_min_length' => (int) $data['password_min_length'],
            'allow_password_reset' => $request->boolean('allow_password_reset'),
            'turnstile_enabled' => $request->boolean('turnstile_enabled'),
            'turnstile_site_key' => $siteKey,
            'turnstile_secret_key' => $secretKey,
            'blocked_email_domains' => collect(preg_split('/[\s,;]+/', $data['blocked_email_domains'] ?? '') ?: [])
                ->map(fn (string $value): string => strtolower(trim($value)))
                ->filter()
                ->unique()
                ->values()
                ->all(),
        ], true);
    }

    private function saveLinks(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'default_host' => ['required', 'string', 'max:253'],
            'short_code_length' => ['required', 'integer', 'min:3', 'max:32'],
            'default_redirect_type' => ['required', Rule::in([301, 302, 307, 308])],
            'default_expiration_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'reserved_words' => ['nullable', 'string', 'max:10000'],
        ]);

        $configuration->write('links.policy', [
            'default_host' => strtolower($data['default_host']),
            'short_code_length' => (int) $data['short_code_length'],
            'default_redirect_type' => (int) $data['default_redirect_type'],
            'force_https' => $request->boolean('force_https'),
            'default_expiration_days' => $data['default_expiration_days'] ?? null,
            'reserved_words' => collect(preg_split('/[\s,;]+/', $data['reserved_words'] ?? '') ?: [])->filter()->unique()->values()->all(),
            'safety_check' => $request->boolean('safety_check'),
        ]);
    }

    private function saveAnalytics(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'retention_days' => ['required', 'integer', 'min:7', 'max:3650'],
        ]);

        $configuration->write('analytics.policy', [
            'enabled' => $request->boolean('enabled'),
            'retention_days' => (int) $data['retention_days'],
            'store_referrer_url' => $request->boolean('store_referrer_url'),
            'store_city' => $request->boolean('store_city'),
            'exclude_bots_from_unique' => $request->boolean('exclude_bots_from_unique'),
            'reconciliation_enabled' => $request->boolean('reconciliation_enabled'),
        ]);
    }

    private function saveStorage(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'disk' => ['required', Rule::in(array_keys(config('filesystems.disks')))],
            'max_upload_mb' => ['required', 'integer', 'min:1', 'max:10240'],
            'allowed_extensions' => ['nullable', 'string', 'max:5000'],
        ]);

        $configuration->write('storage.policy', [
            'disk' => $data['disk'],
            'max_upload_mb' => (int) $data['max_upload_mb'],
            'allowed_extensions' => collect(preg_split('/[\s,;]+/', $data['allowed_extensions'] ?? '') ?: [])
                ->map(fn (string $value): string => strtolower(ltrim(trim($value), '.')))
                ->filter()
                ->unique()
                ->values()
                ->all(),
            'malware_scan' => $request->boolean('malware_scan'),
        ]);

        $features = collect(['links', 'smart_routing', 'texts', 'files', 'profiles', 'teams', 'webhooks', 'sso'])
            ->mapWithKeys(fn (string $feature): array => [$feature => $request->boolean('feature_'.$feature)])
            ->all();
        $configuration->write('features', $features);
    }

    private function saveMaintenance(Request $request, SiteConfiguration $configuration): void
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:1000'],
            'retry_after' => ['required', 'integer', 'min:60', 'max:86400'],
        ]);

        $configuration->write('maintenance.policy', [
            'enabled' => $request->boolean('enabled'),
            'message' => $data['message'],
            'allow_login' => $request->boolean('allow_login'),
            'allow_admin' => true,
            'retry_after' => (int) $data['retry_after'],
        ]);
    }

}
