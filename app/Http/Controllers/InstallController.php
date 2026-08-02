<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\EnvironmentWriter;
use App\Services\InstallationState;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;
use PDO;
use Redis;
use Throwable;

class InstallController extends Controller
{
    private const RESERVED_ADMIN_PATHS = [
        'about', 'api', 'contact', 'dashboard', 'domains', 'forgot-password', 'install',
        'links', 'locale', 'login', 'logout', 'privacy', 'register', 'report-abuse',
        'reset-password', 'storage', 'terms', 'up', 'verify-email',
    ];

    public function __construct(
        private readonly InstallationState $state,
        private readonly EnvironmentWriter $environment,
    ) {}

    public function welcome(): View|RedirectResponse
    {
        if ($this->state->installed()) {
            return redirect()->route('home');
        }

        return view('install.welcome');
    }

    public function requirements(): View|RedirectResponse
    {
        if ($this->state->installed()) {
            return redirect()->route('home');
        }

        $checks = $this->checks();

        return view('install.requirements', [
            'checks' => $checks,
            'ready' => collect($checks)->every(fn (array $check): bool => $check['passed']),
        ]);
    }

    public function database(): View|RedirectResponse
    {
        if ($this->state->installed()) {
            return redirect()->route('home');
        }

        return view('install.database', [
            'database' => session('installer.database', [
                'host' => '127.0.0.1',
                'port' => 3306,
                'name' => 'gojet',
                'username' => 'gojet',
                'password' => '',
                'redis_host' => '127.0.0.1',
                'redis_port' => 6379,
                'redis_password' => '',
            ]),
        ]);
    }

    public function storeDatabase(Request $request): RedirectResponse
    {
        abort_if($this->state->installed(), 404);

        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'port' => ['required', 'integer', 'between:1,65535'],
            'name' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_\-]+$/'],
            'username' => ['required', 'string', 'max:128'],
            'password' => ['nullable', 'string', 'max:512'],
            'redis_host' => ['required', 'string', 'max:253'],
            'redis_port' => ['required', 'integer', 'between:1,65535'],
            'redis_password' => ['nullable', 'string', 'max:512'],
        ]);

        try {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $data['host'],
                $data['port'],
                $data['name'],
            );
            $pdo = new PDO($dsn, $data['username'], $data['password'] ?? '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            $pdo->query('SELECT 1');

            $redis = new Redis;
            $redis->connect($data['redis_host'], (int) $data['redis_port'], 5.0);
            if (filled($data['redis_password'] ?? null)) {
                $redis->auth($data['redis_password']);
            }
            $redis->ping();
            $redis->close();
        } catch (Throwable $exception) {
            return back()
                ->withInput($request->except(['password', 'redis_password']))
                ->withErrors(['connection' => __('installer.database_connection_failed', ['message' => $exception->getMessage()])]);
        }

        $request->session()->put('installer.database', $data);

        return redirect()->route('install.site');
    }

    public function site(Request $request): View|RedirectResponse
    {
        if ($this->state->installed()) {
            return redirect()->route('home');
        }

        if (! $request->session()->has('installer.database')) {
            return redirect()->route('install.database');
        }

        $suggestedUrl = $request->getSchemeAndHttpHost();
        $suggestedHost = $request->getHost();

        return view('install.site', [
            'suggestedUrl' => $suggestedUrl,
            'suggestedSupportEmail' => 'support@'.$suggestedHost,
            'suggestedMailFrom' => 'noreply@'.$suggestedHost,
            'suggestedTimezone' => app()->getLocale() === 'zh_CN' ? 'Asia/Shanghai' : 'UTC',
            'suggestedAdminPath' => 'manage-'.strtolower(substr(bin2hex(random_bytes(5)), 0, 8)),
        ]);
    }

    public function install(Request $request): RedirectResponse
    {
        abort_if($this->state->installed(), 404);

        $database = $request->session()->get('installer.database');
        if (! is_array($database)) {
            return redirect()->route('install.database');
        }

        $data = $request->validate([
            'site_name' => ['required', 'string', 'max:80'],
            'site_url' => ['required', 'url:http,https', 'max:2048'],
            'site_timezone' => ['required', 'timezone'],
            'support_email' => ['required', 'email:rfc', 'max:190'],
            'default_locale' => ['required', 'in:zh_CN,en'],
            'admin_path' => [
                'required', 'string', 'min:4', 'max:40', 'regex:/^[a-z0-9][a-z0-9-]+$/',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (in_array($value, self::RESERVED_ADMIN_PATHS, true)) {
                        $fail(__('installer.admin_path_reserved'));
                    }
                },
            ],
            'admin_name' => ['required', 'string', 'max:80'],
            'admin_email' => ['required', 'email:rfc', 'max:190'],
            'admin_password' => [
                'required', 'confirmed',
                Password::min(12)->mixedCase()->letters()->numbers()->symbols(),
            ],
            'smtp_host' => ['nullable', 'string', 'max:253'],
            'smtp_port' => ['nullable', 'integer', 'between:1,65535'],
            'smtp_username' => ['nullable', 'string', 'max:190'],
            'smtp_password' => ['nullable', 'string', 'max:512'],
            'smtp_scheme' => ['required', 'in:tls,ssl,none'],
            'mail_from_address' => ['nullable', 'email:rfc', 'max:190'],
        ]);

        $allowRegistration = $request->boolean('allow_registration');
        $requireEmailVerification = $allowRegistration && $request->boolean('require_email_verification');
        $smtpEnabled = filled($data['smtp_host'] ?? null);

        if ($requireEmailVerification && ! $smtpEnabled) {
            return back()
                ->withInput($request->except(['admin_password', 'admin_password_confirmation', 'smtp_password']))
                ->withErrors(['smtp_host' => __('installer.smtp_required_for_verification')]);
        }

        if ($smtpEnabled && blank($data['mail_from_address'] ?? null)) {
            return back()
                ->withInput($request->except(['admin_password', 'admin_password_confirmation', 'smtp_password']))
                ->withErrors(['mail_from_address' => __('installer.mail_from_required')]);
        }

        try {
            $siteUrl = rtrim($data['site_url'], '/');
            $siteHost = parse_url($siteUrl, PHP_URL_HOST) ?: $request->getHost();
            $secureCookie = parse_url($siteUrl, PHP_URL_SCHEME) === 'https';

            $this->environment->write([
                'APP_NAME' => $data['site_name'],
                'APP_ENV' => 'production',
                'APP_KEY' => (string) config('app.key'),
                'APP_DEBUG' => false,
                'APP_URL' => $siteUrl,
                'APP_TIMEZONE' => $data['site_timezone'],
                'APP_LOCALE' => $data['default_locale'],
                'APP_FALLBACK_LOCALE' => 'en',
                'DB_CONNECTION' => 'mysql',
                'DB_HOST' => $database['host'],
                'DB_PORT' => (int) $database['port'],
                'DB_DATABASE' => $database['name'],
                'DB_USERNAME' => $database['username'],
                'DB_PASSWORD' => $database['password'] ?? '',
                'REDIS_CLIENT' => 'phpredis',
                'REDIS_HOST' => $database['redis_host'],
                'REDIS_PORT' => (int) $database['redis_port'],
                'REDIS_PASSWORD' => filled($database['redis_password'] ?? null) ? $database['redis_password'] : null,
                'SESSION_DRIVER' => 'redis',
                'SESSION_SECURE_COOKIE' => $secureCookie,
                'CACHE_STORE' => 'redis',
                'QUEUE_CONNECTION' => 'redis',
                'MAIL_MAILER' => $smtpEnabled ? 'smtp' : 'log',
                'MAIL_HOST' => $smtpEnabled ? $data['smtp_host'] : '127.0.0.1',
                'MAIL_PORT' => $smtpEnabled ? (int) ($data['smtp_port'] ?: 587) : 2525,
                'MAIL_USERNAME' => $smtpEnabled && filled($data['smtp_username'] ?? null) ? $data['smtp_username'] : null,
                'MAIL_PASSWORD' => $smtpEnabled && filled($data['smtp_password'] ?? null) ? $data['smtp_password'] : null,
                'MAIL_SCHEME' => $smtpEnabled && $data['smtp_scheme'] !== 'none' ? $data['smtp_scheme'] : null,
                'MAIL_FROM_ADDRESS' => $smtpEnabled ? $data['mail_from_address'] : $data['support_email'],
                'MAIL_FROM_NAME' => $data['site_name'],
                'GOJET_SUPPORT_EMAIL' => strtolower($data['support_email']),
                'GOJET_DEFAULT_HOST' => $siteHost,
                'GOJET_IP_HASH_KEY' => bin2hex(random_bytes(32)),
                'GOJET_ADMIN_PATH' => $data['admin_path'],
                'GOJET_ALLOW_REGISTRATION' => $allowRegistration,
                'GOJET_REQUIRE_EMAIL_VERIFICATION' => $requireEmailVerification,
                'GOJET_INSTALLED' => false,
            ]);

            $this->configureDatabase($database);
            Artisan::call('migrate', ['--force' => true]);

            $admin = User::query()->updateOrCreate(
                ['email' => strtolower($data['admin_email'])],
                [
                    'name' => $data['admin_name'],
                    'password' => Hash::make($data['admin_password']),
                    'email_verified_at' => now(),
                    'is_admin' => true,
                    'status' => 'active',
                ],
            );

            $this->state->markInstalled([
                'site_url' => $siteUrl,
                'admin_path' => $data['admin_path'],
                'admin_user_id' => $admin->id,
                'installed_at' => now()->toIso8601String(),
            ]);

            $this->environment->write(['GOJET_INSTALLED' => true]);

            try {
                Artisan::call('storage:link');
            } catch (Throwable) {
                // Existing links and restricted shared-host filesystems are acceptable.
            }

            Artisan::call('optimize:clear');

            $request->session()->forget('installer.database');
            $request->session()->put('installer.complete', [
                'site_url' => $siteUrl,
                'admin_url' => $siteUrl.'/'.$data['admin_path'],
                'admin_name' => $data['admin_name'],
                'admin_email' => strtolower($data['admin_email']),
                'support_email' => strtolower($data['support_email']),
                'registration' => $allowRegistration,
                'verification' => $requireEmailVerification,
            ]);

            return redirect()->route('install.complete');
        } catch (Throwable $exception) {
            Log::error('GoJet web installation failed.', ['exception' => $exception]);

            return back()->withInput($request->except([
                'admin_password', 'admin_password_confirmation', 'smtp_password',
            ]))->withErrors(['install' => __('installer.install_failed', ['message' => $exception->getMessage()])]);
        }
    }

    public function complete(Request $request): View|RedirectResponse
    {
        $details = $request->session()->get('installer.complete');

        if (! is_array($details)) {
            return redirect()->route($this->state->installed() ? 'home' : 'install.welcome');
        }

        return view('install.complete', ['details' => $details]);
    }

    /**
     * @return array<int, array{name: string, detail: string, passed: bool}>
     */
    private function checks(): array
    {
        $checks = [];
        $add = static function (string $name, string $detail, bool $passed) use (&$checks): void {
            $checks[] = compact('name', 'detail', 'passed');
        };

        $add('PHP', PHP_VERSION.' / >= 8.3.0', version_compare(PHP_VERSION, '8.3.0', '>='));

        foreach (['bcmath', 'ctype', 'curl', 'dom', 'fileinfo', 'filter', 'gd', 'hash', 'intl', 'mbstring', 'openssl', 'pdo', 'pdo_mysql', 'redis', 'tokenizer', 'xml', 'zip'] as $extension) {
            $add('PHP: '.$extension, extension_loaded($extension) ? __('installer.loaded') : __('installer.missing'), extension_loaded($extension));
        }

        $add('.env', $this->environment->isWritable() ? __('installer.writable') : __('installer.not_writable'), $this->environment->isWritable());

        foreach ([storage_path(), storage_path('framework'), storage_path('logs'), app()->bootstrapPath('cache')] as $path) {
            $add($path, is_writable($path) ? __('installer.writable') : __('installer.not_writable'), is_dir($path) && is_writable($path));
        }

        $publicRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
        $expectedRoot = realpath(public_path());
        $add(__('installer.web_root'), (string) $expectedRoot, $publicRoot === $expectedRoot);
        $add(__('installer.rewrite'), __('installer.rewrite_detected'), true);

        return $checks;
    }

    /**
     * @param  array<string, mixed>  $database
     */
    private function configureDatabase(array $database): void
    {
        config([
            'database.default' => 'mysql',
            'database.connections.mysql.host' => $database['host'],
            'database.connections.mysql.port' => (int) $database['port'],
            'database.connections.mysql.database' => $database['name'],
            'database.connections.mysql.username' => $database['username'],
            'database.connections.mysql.password' => $database['password'] ?? '',
        ]);

        DB::purge('mysql');
        DB::connection('mysql')->getPdo();
    }
}
