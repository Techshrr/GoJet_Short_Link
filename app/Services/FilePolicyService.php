<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class FilePolicyService
{
    private const BLOCKED_EXTENSIONS = [
        'exe', 'com', 'bat', 'cmd', 'msi', 'scr', 'pif', 'cpl', 'dll', 'sys', 'jar',
        'sh', 'bash', 'zsh', 'ps1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'hta',
        'php', 'php3', 'php4', 'php5', 'phtml', 'phar', 'cgi', 'pl', 'pyc', 'apk', 'app',
    ];

    public function validateUpload(UploadedFile $file, ?int $maxMegabytes = null): void
    {
        $maxMegabytes ??= (int) config('gojet.max_upload_mb', 1024);
        if (! $file->isValid()) {
            throw ValidationException::withMessages(['file' => __('v3.file_upload_failed')]);
        }
        if ($file->getSize() > $maxMegabytes * 1024 * 1024) {
            throw ValidationException::withMessages(['file' => __('v3.file_too_large', ['size' => $maxMegabytes])]);
        }
        $this->validateName($file->getClientOriginalName());
    }

    public function validateName(string $name): void
    {
        $extension = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
        if ($extension !== '' && in_array($extension, self::BLOCKED_EXTENSIONS, true)) {
            throw ValidationException::withMessages(['file' => __('v3.file_type_blocked')]);
        }

        $allowed = collect(config('gojet.storage.allowed_extensions', []))
            ->map(fn ($value): string => strtolower(ltrim(trim((string) $value), '.')))
            ->filter()
            ->values();
        if ($allowed->isNotEmpty() && ($extension === '' || ! $allowed->contains($extension))) {
            throw ValidationException::withMessages(['file' => '该文件扩展名不在平台允许列表中。']);
        }
        if (preg_match('/[\x00-\x1F\x7F]/', $name)) {
            throw ValidationException::withMessages(['file' => __('v3.file_name_invalid')]);
        }
    }

    public function safeDownloadName(string $name): string
    {
        $name = preg_replace('/[^\pL\pN._()\- ]+/u', '_', $name) ?: 'download';

        return mb_substr($name, 0, 180);
    }

    public function mayRenderInline(?string $mime): bool
    {
        return is_string($mime) && (str_starts_with($mime, 'image/') || $mime === 'application/pdf' || str_starts_with($mime, 'text/'));
    }
}
