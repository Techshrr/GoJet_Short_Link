<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class SiteConfiguration
{
    public const GROUPS = [
        'site.identity',
        'site.branding',
        'site.seo',
        'site.legal',
        'mail.transport',
        'auth.policy',
        'links.policy',
        'analytics.policy',
        'storage.policy',
        'maintenance.policy',
        'features',
    ];

    public function all(): array
    {
        return [
            'identity' => $this->group('site.identity', $this->identityDefaults()),
            'branding' => $this->group('site.branding', $this->brandingDefaults()),
            'seo' => $this->group('site.seo', $this->seoDefaults()),
            'legal' => $this->group('site.legal', $this->legalDefaults()),
            'mail' => $this->group('mail.transport', $this->mailDefaults()),
            'auth' => $this->group('auth.policy', $this->authDefaults()),
            'links' => $this->group('links.policy', $this->linkDefaults()),
            'analytics' => $this->group('analytics.policy', $this->analyticsDefaults()),
            'storage' => $this->group('storage.policy', $this->storageDefaults()),
            'maintenance' => $this->group('maintenance.policy', $this->maintenanceDefaults()),
            'features' => $this->group('features', config('gojet.features', [])),
        ];
    }

    public function group(string $key, array $defaults = []): array
    {
        if (!config('gojet.installed')) {
            return $defaults;
        }

        try {
            if (!Schema::hasTable('system_settings')) {
                return $defaults;
            }

            $stored = SystemSetting::read($key, []);

            return array_replace_recursive($defaults, is_array($stored) ? $stored : []);
        } catch (Throwable) {
            return $defaults;
        }
    }

    public function write(string $key, array $value, bool $secret = false): void
    {
        SystemSetting::write($key, $value, $secret);
    }

    public function apply(): void
    {
        $settings = $this->all();
        $identity = $settings['identity'];
        $branding = $settings['branding'];
        $seo = $settings['seo'];
        $mail = $settings['mail'];
        $auth = $settings['auth'];
        $links = $settings['links'];
        $analytics = $settings['analytics'];
        $storage = $settings['storage'];
        $maintenance = $settings['maintenance'];

        config([
            'app.name' => $identity['site_name'],
            'app.locale' => $identity['locale'],
            'app.timezone' => $identity['timezone'],
            'gojet.support_email' => $identity['support_email'],
            'gojet.default_host' => $links['default_host'],
            'gojet.short_code_length' => (int) $links['short_code_length'],
            'gojet.default_redirect_type' => (int) $links['default_redirect_type'],
            'gojet.reserved_slugs' => array_values(array_unique(array_merge(config('gojet.reserved_slugs', []), $links['reserved_words'] ?? []))),
            'gojet.allow_registration' => (bool) $auth['allow_registration'],
            'gojet.require_email_verification' => (bool) $auth['require_email_verification'],
            'gojet.click_retention_days' => (int) $analytics['retention_days'],
            'gojet.file_disk' => $storage['disk'],
            'gojet.max_upload_mb' => (int) $storage['max_upload_mb'],
            'gojet.features' => $settings['features'],
            'gojet.site.identity' => $identity,
            'gojet.site.branding' => $branding,
            'gojet.site.seo' => $seo,
            'gojet.site.legal' => $settings['legal'],
            'gojet.mail' => $mail,
            'gojet.auth' => $auth,
            'gojet.links' => $links,
            'gojet.analytics' => $analytics,
            'gojet.storage' => $storage,
            'gojet.maintenance' => $maintenance,
        ]);

        date_default_timezone_set((string) $identity['timezone']);

        if (($mail['configured'] ?? false) && filled($mail['host'] ?? null)) {
            $encryption = strtolower((string) ($mail['encryption'] ?? 'tls'));
            $implicitTls = in_array($encryption, ['ssl', 'smtps'], true);
            $plainText = $encryption === 'none';

            config([
                'mail.default' => 'smtp',
                'mail.mailers.smtp.host' => $mail['host'],
                'mail.mailers.smtp.port' => (int) $mail['port'],
                'mail.mailers.smtp.scheme' => $implicitTls ? 'smtps' : 'smtp',
                'mail.mailers.smtp.auto_tls' => !$plainText,
                'mail.mailers.smtp.require_tls' => in_array($encryption, ['tls', 'starttls'], true),
                'mail.mailers.smtp.username' => $mail['username'] ?: null,
                'mail.mailers.smtp.password' => $mail['password'] ?: null,
                'mail.mailers.smtp.local_domain' => $mail['ehlo_domain'] ?: null,
                'mail.from.address' => $mail['from_address'],
                'mail.from.name' => $mail['from_name'],
            ]);
            Mail::purge('smtp');
            if (filled($mail['reply_to'] ?? null)) {
                Mail::alwaysReplyTo($mail['reply_to']);
            }
        }
    }

    public function assetUrl(?string $path, ?string $fallback = null): ?string
    {
        if (!filled($path)) {
            return $fallback;
        }

        if (Str::startsWith($path, ['http://', 'https://', '/'])) {
            return $path;
        }

        return Storage::disk('public')->url($path);
    }

    public function publicMeta(?string $title = null, ?string $description = null): array
    {
        $settings = $this->all();
        $identity = $settings['identity'];
        $seo = $settings['seo'];
        $branding = $settings['branding'];
        $siteName = (string) $identity['site_name'];
        $titleTemplate = (string) ($seo['title_template'] ?? '%s · %site%');
        $resolvedTitle = $title
            ? strtr($titleTemplate, ['%site%' => $siteName, '%s' => $title])
            : ($seo['default_title'] ?: $siteName);

        return [
            'title' => $resolvedTitle,
            'description' => $description ?: $seo['description'],
            'keywords' => $seo['keywords'],
            'canonical' => url()->current(),
            'robots' => $seo['robots'],
            'og_image' => $this->assetUrl($branding['og_image'] ?? null),
            'favicon' => $this->assetUrl($branding['favicon'] ?? null, '/favicon.ico'),
            'logo' => $this->assetUrl($branding['logo'] ?? null),
            'logo_dark' => $this->assetUrl($branding['logo_dark'] ?? null),
            'logo_mark' => $this->assetUrl($branding['logo_mark'] ?? null),
            'brand_color' => $branding['brand_color'] ?? '#10b981',
        ];
    }

    public function isMailConfigured(): bool
    {
        $mail = $this->group('mail.transport', $this->mailDefaults());

        return (bool) ($mail['configured'] ?? false)
            && filled($mail['host'] ?? null)
            && filled($mail['from_address'] ?? null);
    }

    public function isMailReady(): bool
    {
        $mail = $this->group('mail.transport', $this->mailDefaults());

        return $this->isMailConfigured() && filled($mail['verified_at'] ?? null);
    }

    private function identityDefaults(): array
    {
        return [
            'site_name' => config('app.name', 'GoJet'),
            'site_short_name' => 'GoJet',
            'tagline' => '强大的链接管理，触手可及',
            'description' => '缩短网址、分享内容并理解每一次访问。',
            'support_email' => config('gojet.support_email'),
            'contact_email' => config('gojet.support_email'),
            'locale' => config('app.locale', 'zh_CN'),
            'timezone' => config('app.timezone', 'Asia/Shanghai'),
            'footer_text' => '让每一个链接更短，也更值得信任。',
        ];
    }

    private function brandingDefaults(): array
    {
        return [
            'logo' => null,
            'logo_dark' => null,
            'logo_mark' => null,
            'favicon' => null,
            'apple_touch_icon' => null,
            'og_image' => null,
            'mail_logo' => null,
            'brand_color' => '#10b981',
            'accent_color' => '#22d3ee',
        ];
    }

    private function seoDefaults(): array
    {
        return [
            'default_title' => config('app.name', 'GoJet').' · 智能链接管理平台',
            'title_template' => '%s · %site%',
            'description' => 'GoJet 提供短网址、二维码、链接分析、智能路由、文件和文本分享。',
            'keywords' => '短网址,短链接,二维码,链接分析,智能链接,GoJet',
            'robots' => 'index,follow,max-image-preview:large',
            'google_site_verification' => null,
            'baidu_site_verification' => null,
        ];
    }

    private function legalDefaults(): array
    {
        return [
            'company' => null,
            'address' => null,
            'registration_number' => null,
            'privacy_email' => config('gojet.support_email'),
            'copyright' => '© '.date('Y').' '.config('app.name', 'GoJet').'.',
        ];
    }

    private function mailDefaults(): array
    {
        return [
            'configured' => filled(config('mail.mailers.smtp.host')),
            'host' => config('mail.mailers.smtp.host'),
            'port' => (int) config('mail.mailers.smtp.port', 587),
            'encryption' => match ((string) config('mail.mailers.smtp.scheme', 'smtp')) {
                'smtps' => 'ssl',
                default => config('mail.mailers.smtp.require_tls', false) ? 'tls' : (config('mail.mailers.smtp.auto_tls', true) ? 'tls' : 'none'),
            },
            'username' => config('mail.mailers.smtp.username'),
            'password' => config('mail.mailers.smtp.password'),
            'ehlo_domain' => config('mail.mailers.smtp.local_domain'),
            'from_address' => config('mail.from.address'),
            'from_name' => config('mail.from.name', config('app.name')),
            'reply_to' => config('gojet.support_email'),
            'verified_at' => null,
        ];
    }

    private function authDefaults(): array
    {
        return [
            'allow_registration' => (bool) config('gojet.allow_registration', true),
            'require_email_verification' => (bool) config('gojet.require_email_verification', true),
            'password_min_length' => 10,
            'allow_password_reset' => true,
            'turnstile_enabled' => false,
            'turnstile_site_key' => null,
            'turnstile_secret_key' => null,
            'blocked_email_domains' => [],
        ];
    }

    private function linkDefaults(): array
    {
        return [
            'default_host' => config('gojet.default_host'),
            'short_code_length' => (int) config('gojet.short_code_length', 7),
            'default_redirect_type' => (int) config('gojet.default_redirect_type', 302),
            'force_https' => true,
            'default_expiration_days' => null,
            'reserved_words' => config('gojet.reserved_slugs', []),
            'safety_check' => true,
        ];
    }

    private function analyticsDefaults(): array
    {
        return [
            'enabled' => true,
            'retention_days' => (int) config('gojet.click_retention_days', 90),
            'store_referrer_url' => true,
            'store_city' => true,
            'exclude_bots_from_unique' => true,
            'reconciliation_enabled' => true,
        ];
    }

    private function maintenanceDefaults(): array
    {
        return [
            'enabled' => false,
            'message' => '系统正在进行计划维护，请稍后再试。',
            'allow_login' => true,
            'allow_admin' => true,
            'retry_after' => 900,
        ];
    }

    private function storageDefaults(): array
    {
        return [
            'disk' => config('gojet.file_disk', 'local'),
            'max_upload_mb' => (int) config('gojet.max_upload_mb', 1024),
            'allowed_extensions' => [],
            'malware_scan' => (bool) config('gojet.malware_scanner_enabled', false),
        ];
    }
}
