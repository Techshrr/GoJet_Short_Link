<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

class GoJetCheckCommand extends Command
{
    protected $signature = 'gojet:check {--json : Output machine-readable JSON}';

    protected $description = 'Validate GoJet application and server readiness';

    public function handle(): int
    {
        $checks = [];
        $this->add($checks, 'php.version', version_compare(PHP_VERSION, '8.3.0', '>='), PHP_VERSION, true);

        foreach (['bcmath', 'ctype', 'curl', 'dom', 'fileinfo', 'filter', 'hash', 'mbstring', 'openssl', 'pdo', 'tokenizer', 'xml'] as $extension) {
            $this->add($checks, 'php.ext.'.$extension, extension_loaded($extension), extension_loaded($extension) ? 'loaded' : 'missing', true);
        }

        $this->add($checks, 'app.key', filled(config('app.key')), filled(config('app.key')) ? 'configured' : 'missing', true);
        $this->add($checks, 'app.debug', ! (bool) config('app.debug') || app()->environment('local', 'testing'), config('app.debug') ? 'enabled' : 'disabled', app()->environment('production'));
        $this->add($checks, 'app.https', str_starts_with((string) config('app.url'), 'https://') || ! app()->environment('production'), (string) config('app.url'), app()->environment('production'));
        $this->add($checks, 'gojet.ip_hash_key', strlen((string) config('gojet.ip_hash_key')) >= 32, 'configured length '.strlen((string) config('gojet.ip_hash_key')), true);

        $writablePaths = [
            storage_path(),
            storage_path('framework'),
            storage_path('logs'),
            app()->bootstrapPath('cache'),
        ];

        foreach ($writablePaths as $path) {
            $this->add($checks, 'writable.'.$path, is_dir($path) && is_writable($path), $path, true);
        }

        try {
            DB::connection()->getPdo();
            $this->add($checks, 'database.connection', true, DB::connection()->getDatabaseName(), true);
            Artisan::call('migrate:status', ['--no-interaction' => true]);
            $this->add($checks, 'database.migrations', true, 'migration table reachable', true);
        } catch (Throwable $e) {
            $this->add($checks, 'database.connection', false, $e->getMessage(), true);
        }

        $usesRedis = config('cache.default') === 'redis'
            || config('queue.default') === 'redis'
            || config('session.driver') === 'redis';

        if ($usesRedis) {
            try {
                Redis::connection()->ping();
                $this->add($checks, 'redis.connection', true, 'reachable', true);
            } catch (Throwable $e) {
                $this->add($checks, 'redis.connection', false, $e->getMessage(), true);
            }
        }

        $failed = collect($checks)->contains(fn (array $check) => $check['required'] && ! $check['passed']);

        if ($this->option('json')) {
            $this->line(json_encode(['ready' => ! $failed, 'checks' => $checks], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $this->newLine();
            $this->info('GoJet installation self-check');
            foreach ($checks as $check) {
                $symbol = $check['passed'] ? '<fg=green>PASS</>' : ($check['required'] ? '<fg=red>FAIL</>' : '<fg=yellow>WARN</>');
                $this->line(sprintf('%s  %-36s %s', $symbol, $check['name'], $check['detail']));
            }
            $this->newLine();
            $failed ? $this->error('GoJet is not ready.') : $this->info('GoJet is ready.');
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    private function add(array &$checks, string $name, bool $passed, string $detail, bool $required): void
    {
        $checks[] = compact('name', 'passed', 'detail', 'required');
    }
}
