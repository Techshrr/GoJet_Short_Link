<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    public function record(
        string $action,
        ?Model $subject = null,
        array $metadata = [],
        ?Request $request = null,
    ): AuditLog {
        $request ??= request();
        $ip = $request?->ip();
        $ipHash = $ip
            ? hash_hmac('sha256', $ip, (string) config('gojet.ip_hash_key'))
            : null;

        return AuditLog::create([
            'actor_user_id' => $request?->user()?->id,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'metadata' => $metadata ?: null,
            'ip_hash' => $ipHash,
            'created_at' => now(),
        ]);
    }
}
