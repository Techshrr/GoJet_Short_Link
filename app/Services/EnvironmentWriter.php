<?php

namespace App\Services;

use RuntimeException;

class EnvironmentWriter
{
    public function path(): string
    {
        return base_path('.env');
    }

    public function isWritable(): bool
    {
        $path = $this->path();

        return is_file($path) ? is_writable($path) : is_writable(base_path());
    }

    /**
     * @param  array<string, bool|int|string|null>  $values
     */
    public function write(array $values): void
    {
        $path = $this->path();

        if (! is_file($path)) {
            $example = base_path('.env.example');
            if (! is_readable($example) || ! @copy($example, $path)) {
                throw new RuntimeException('Unable to create the .env file. Make the project root writable by PHP during installation.');
            }
        }

        if (! is_writable($path)) {
            throw new RuntimeException('The .env file is not writable.');
        }

        $original = (string) file_get_contents($path);
        $contents = $original;

        foreach ($values as $name => $value) {
            $line = $name.'='.$this->encode($value);
            $pattern = '/^'.preg_quote($name, '/').'\s*=.*$/m';

            if (preg_match($pattern, $contents) === 1) {
                $contents = (string) preg_replace($pattern, $line, $contents, 1);
            } else {
                $contents = rtrim($contents).PHP_EOL.$line.PHP_EOL;
            }
        }

        $backup = storage_path('framework/.env.last-good');
        @file_put_contents($backup, $original, LOCK_EX);
        @chmod($backup, 0600);

        if (file_put_contents($path, $contents, LOCK_EX) === false) {
            if ($original !== '') {
                @file_put_contents($path, $original, LOCK_EX);
            }

            throw new RuntimeException('Unable to save the .env file.');
        }

        @chmod($path, 0640);
    }

    private function encode(bool|int|string|null $value): string
    {
        if ($value === null) {
            return 'null';
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_int($value)) {
            return (string) $value;
        }

        if ($value === '') {
            return '""';
        }

        if (preg_match('/^[A-Za-z0-9_\.\-:\/@]+$/', $value) === 1) {
            return $value;
        }

        return '"'.str_replace(
            ['\\', '"', '$', "\n", "\r"],
            ['\\\\', '\\"', '\\$', '\\n', ''],
            $value,
        ).'"';
    }
}
