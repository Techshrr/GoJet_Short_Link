<?php

namespace App\Jobs;

use App\Contracts\MalwareScanner;
use App\Models\FileShare;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ScanFileShare implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [60, 300];

    public function __construct(public int $fileShareId) {}

    public function handle(MalwareScanner $scanner): void
    {
        $share = FileShare::withTrashed()->find($this->fileShareId);
        if (! $share || $share->trashed()) {
            return;
        }
        if (! $scanner->available()) {
            $share->forceFill(['scan_status' => 'not_configured', 'scan_result' => ['message' => 'Scanner unavailable']])->saveQuietly();

            return;
        }

        $stream = Storage::disk($share->disk)->readStream($share->path);
        if (! is_resource($stream)) {
            $share->forceFill(['scan_status' => 'error', 'scan_result' => ['message' => 'Unable to open stored file']])->saveQuietly();

            return;
        }

        try {
            $result = $scanner->scan($stream, $share->original_name);
            $share->forceFill([
                'scan_status' => $result->status,
                'scan_result' => array_filter(['signature' => $result->signature, 'message' => $result->message]),
            ])->saveQuietly();
        } catch (Throwable $exception) {
            $share->forceFill(['scan_status' => 'error', 'scan_result' => ['message' => $exception->getMessage()]])->saveQuietly();
            throw $exception;
        } finally {
            fclose($stream);
        }
    }
}
