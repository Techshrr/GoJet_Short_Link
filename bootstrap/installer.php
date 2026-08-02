<?php

/**
 * First-run bootstrap executed before Laravel loads.
 *
 * It creates a private per-installation application key in storage so the
 * graphical installer can boot even when .env has not been created yet.
 * The installer later persists the key and the final configuration to .env.
 */
$basePath = dirname(__DIR__);
$storagePath = $basePath.'/storage/app';
$lockPath = $storagePath.'/installed.json';
$temporaryKeyPath = $storagePath.'/.installer-key';
$environmentPath = $basePath.'/.env';

if (! is_dir($storagePath)) {
    @mkdir($storagePath, 0775, true);
}

$installed = is_file($lockPath);
$environment = is_file($environmentPath) ? (string) @file_get_contents($environmentPath) : '';

$readValue = static function (string $name) use ($environment): ?string {
    if (preg_match('/^'.preg_quote($name, '/').'=(.*)$/m', $environment, $matches) !== 1) {
        return null;
    }

    return trim($matches[1], " \t\n\r\0\x0B\"'");
};

$appKey = $readValue('APP_KEY');
if (! is_string($appKey) || $appKey === '') {
    if (is_file($temporaryKeyPath)) {
        $appKey = trim((string) @file_get_contents($temporaryKeyPath));
    }

    if (! is_string($appKey) || $appKey === '') {
        $appKey = 'base64:'.base64_encode(random_bytes(32));
        @file_put_contents($temporaryKeyPath, $appKey, LOCK_EX);
        @chmod($temporaryKeyPath, 0600);
    }
}

$put = static function (string $name, string $value): void {
    putenv($name.'='.$value);
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
};

$put('APP_KEY', $appKey);

// A fresh installation must not depend on MySQL or Redis-backed sessions.
if (! $installed && $readValue('GOJET_INSTALLED') !== 'true') {
    $put('SESSION_DRIVER', 'file');
    $put('CACHE_STORE', 'file');
    $put('QUEUE_CONNECTION', 'sync');
    $put('SESSION_SECURE_COOKIE', (! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'true' : 'false');
}
