<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Throwable;

class InstallationState
{
    public function lockPath(): string
    {
        return storage_path('app/installed.json');
    }

    public function installed(): bool
    {
        if ((bool) config('gojet.installed', false) || is_file($this->lockPath())) {
            return true;
        }

        try {
            return Schema::hasTable('users')
                && (bool) User::query()->where('is_admin', true)->exists();
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function metadata(): array
    {
        if (! is_readable($this->lockPath())) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($this->lockPath()), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    public function markInstalled(array $metadata): void
    {
        $directory = dirname($this->lockPath());
        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        $payload = array_merge([
            'installed_at' => now()->toIso8601String(),
            'version' => '4.0.0',
        ], $metadata);

        if (file_put_contents(
            $this->lockPath(),
            json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            LOCK_EX,
        ) === false) {
            throw new \RuntimeException('Unable to write the installation lock file.');
        }

        @chmod($this->lockPath(), 0640);
    }
}
