<?php

namespace App\Http\Controllers;

use App\Services\SiteConfiguration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;
use Illuminate\View\View;
use Throwable;

class PublicStatusController extends Controller
{
    public function __invoke(SiteConfiguration $configuration): View
    {
        $components = [
            $this->probe('Web application', fn (): bool => true, '当前页面可正常响应'),
            $this->probe('Database', fn (): bool => (bool) DB::selectOne('select 1 as ok')?->ok, '业务数据源'),
            $this->probe('Redis', function (): bool {
                $result = Redis::connection()->ping();

                return $result === true || strtoupper((string) $result) === 'PONG';
            }, '缓存、限流和默认队列'),
            $this->probe('Go redirect plane', function (): bool {
                $response = Http::connectTimeout(1)->timeout(2)->get((string) config('gojet.redirect_plane.health_url'));

                return $response->successful() && in_array($response->json('status'), ['ok', 'degraded'], true);
            }, '根级短码与持久化事件队列'),
            [
                'name' => 'Email delivery',
                'ok' => $configuration->isMailReady(),
                'detail' => $configuration->isMailReady() ? 'SMTP 已测试' : '尚未完成 SMTP 测试',
            ],
            $this->probe('Private storage', fn (): bool => is_writable(storage_path('app')), '上传、导出和运行数据'),
        ];

        return view('pages.status', [
            'components' => $components,
            'overall' => collect($components)->every(fn (array $component): bool => $component['ok']),
            'checkedAt' => now(),
        ]);
    }

    /** @return array{name:string,ok:bool,detail:string} */
    private function probe(string $name, callable $probe, string $detail): array
    {
        try {
            $ok = (bool) $probe();
        } catch (Throwable) {
            $ok = false;
        }

        return ['name' => $name, 'ok' => $ok, 'detail' => $detail];
    }
}
