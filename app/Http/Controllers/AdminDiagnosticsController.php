<?php

namespace App\Http\Controllers;

use App\Models\AnalyticsIngestFailure;
use App\Models\EmailDeliveryLog;
use App\Services\CloudflareCustomHostnameService;
use App\Services\MailDeliveryService;
use App\Services\SiteConfiguration;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Throwable;

class AdminDiagnosticsController extends Controller
{
    public function index(SiteConfiguration $configuration): View
    {
        $health = [
            'php' => ['status' => version_compare(PHP_VERSION, '8.3.0', '>='), 'detail' => 'PHP '.PHP_VERSION],
            'database' => $this->probe(fn () => DB::select('SELECT 1'), 'MySQL 连接正常'),
            'redis' => $this->probe(fn () => Redis::connection()->ping(), 'Redis 连接正常'),
            'cache' => $this->probe(function (): void {
                $key = 'gojet:health:'.getmypid();
                Cache::put($key, 'ok', 30);
                throw_unless(Cache::get($key) === 'ok', new \RuntimeException('缓存写入后无法读取。'));
                Cache::forget($key);
            }, '缓存读写正常'),
            'storage' => $this->probe(function (): void {
                $path = 'gojet/health/'.Str::uuid().'.txt';
                $disk = Storage::disk(config('gojet.file_disk'));
                $disk->put($path, 'ok');
                throw_unless($disk->exists($path), new \RuntimeException('文件写入后无法读取。'));
                $disk->delete($path);
            }, '存储读写正常'),
            'queue' => $this->queueHealth(),
            'scheduler' => [
                'status' => cache()->has('gojet:scheduler:last_run'),
                'detail' => cache()->get('gojet:scheduler:last_run', '尚未发现计划任务心跳'),
            ],
            'mail' => [
                'status' => $configuration->isMailReady(),
                'detail' => $configuration->isMailReady() ? 'SMTP 基础配置完整' : 'SMTP 尚未配置完整',
            ],
            'redirect_plane' => $this->redirectPlaneHealth(),
            'cloudflare' => [
                'status' => ! config('gojet.cloudflare.enabled') || filled(config('gojet.cloudflare.api_token')),
                'detail' => config('gojet.cloudflare.enabled') ? '自定义主机名已启用' : '自定义主机名未启用',
            ],
        ];

        $pipeline = [
            'email_failed_24h' => Schema::hasTable('email_delivery_logs') ? EmailDeliveryLog::query()->where('status', 'failed')->where('created_at', '>=', now()->subDay())->count() : 0,
            'analytics_failed_24h' => Schema::hasTable('analytics_ingest_failures') ? AnalyticsIngestFailure::query()->where('created_at', '>=', now()->subDay())->count() : 0,
            'queue_failed' => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0,
            'queue_pending' => Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0,
        ];

        $recentMail = Schema::hasTable('email_delivery_logs')
            ? EmailDeliveryLog::query()->latest()->limit(8)->get()
            : collect();
        $recentAnalyticsFailures = Schema::hasTable('analytics_ingest_failures')
            ? AnalyticsIngestFailure::query()->latest()->limit(8)->get()
            : collect();

        return view('admin.diagnostics', compact('health', 'pipeline', 'recentMail', 'recentAnalyticsFailures'));
    }

    public function test(
        Request $request,
        string $service,
        CloudflareCustomHostnameService $cloudflare,
        MailDeliveryService $mail,
    ): RedirectResponse {
        if ($service === 'mail') {
            $result = $mail->sendTest($request->user(), $request->user()->email);

            return back()->with($result['ok'] ? 'status' : 'error', $result['message']);
        }

        $message = match ($service) {
            'database' => $this->run(fn () => DB::select('SELECT 1'), '数据库连接测试成功。'),
            'redis' => $this->run(fn () => Redis::connection()->ping(), 'Redis 连接测试成功。'),
            'storage' => $this->run(function (): void {
                $path = 'gojet/health/'.Str::uuid().'.txt';
                $disk = Storage::disk(config('gojet.file_disk'));
                $disk->put($path, 'storage test');
                throw_unless($disk->exists($path), new \RuntimeException('无法读取测试文件。'));
                $disk->delete($path);
            }, '存储读写测试成功。'),
            'redirect_plane' => $this->run(function (): void {
                $url = rtrim((string) config('gojet.redirect_plane.health_url'), '/');
                throw_if($url === '', new \RuntimeException('未配置跳转面健康检查地址。'));
                Http::timeout(3)->get($url)->throw();
            }, 'Go Redirect Plane 健康检查成功。'),
            'cloudflare' => $this->run(function () use ($cloudflare): void {
                throw_unless($cloudflare->enabled(), new \RuntimeException('Cloudflare 自定义主机名未启用。'));
            }, 'Cloudflare 配置已启用。'),
            default => abort(404),
        };

        return back()->with('status', $message);
    }

    private function queueHealth(): array
    {
        try {
            $pending = Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0;
            $failed = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0;

            return ['status' => $failed === 0, 'detail' => "待处理 {$pending} · 失败 {$failed}"];
        } catch (Throwable $exception) {
            return ['status' => false, 'detail' => $exception->getMessage()];
        }
    }

    private function redirectPlaneHealth(): array
    {
        if (! config('gojet.redirect_plane.enabled')) {
            return ['status' => true, 'detail' => '未启用，当前由 Laravel 同步跳转与统计'];
        }

        try {
            $url = rtrim((string) config('gojet.redirect_plane.health_url'), '/');
            throw_if($url === '', new \RuntimeException('缺少 GOJET_REDIRECT_HEALTH_URL。'));
            $response = Http::timeout(2)->get($url);

            return ['status' => $response->successful(), 'detail' => $response->successful() ? 'Go 跳转面在线' : 'HTTP '.$response->status()];
        } catch (Throwable $exception) {
            return ['status' => false, 'detail' => $exception->getMessage()];
        }
    }

    private function probe(callable $callback, string $success): array
    {
        try {
            $callback();

            return ['status' => true, 'detail' => $success];
        } catch (Throwable $exception) {
            return ['status' => false, 'detail' => $exception->getMessage()];
        }
    }

    private function run(callable $callback, string $success): string
    {
        try {
            $callback();

            return $success;
        } catch (Throwable $exception) {
            return '测试失败：'.$exception->getMessage();
        }
    }
}
