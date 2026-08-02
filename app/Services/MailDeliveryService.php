<?php

namespace App\Services;

use App\Models\EmailDeliveryLog;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class MailDeliveryService
{
    public function __construct(private readonly SiteConfiguration $configuration) {}

    public function sendVerification(User $user, ?EmailDeliveryLog $previous = null): array
    {
        if (! $this->configuration->isMailReady()) {
            return $this->failure(
                $user,
                'email_verification',
                $user->email,
                '邮箱验证',
                new RuntimeException('SMTP 尚未完成配置或验证。请管理员先在“系统设置 → 邮件”保存配置并发送测试邮件。'),
                ['user_id' => $user->id],
                $previous,
            );
        }

        try {
            $this->refreshMailer();
            $user->sendEmailVerificationNotification();

            return $this->success($user, 'email_verification', $user->email, '邮箱验证', ['user_id' => $user->id], $previous);
        } catch (Throwable $exception) {
            return $this->failure($user, 'email_verification', $user->email, '邮箱验证', $exception, ['user_id' => $user->id], $previous);
        }
    }

    public function sendPasswordReset(string $email, ?User $actor = null, ?EmailDeliveryLog $previous = null): array
    {
        if (! $this->configuration->isMailReady()) {
            return $this->failure(
                $actor,
                'password_reset',
                $email,
                '重置密码',
                new RuntimeException('SMTP 尚未完成配置或验证。'),
                [],
                $previous,
            );
        }

        try {
            $this->refreshMailer();
            $status = Password::sendResetLink(['email' => $email]);
            if ($status !== Password::RESET_LINK_SENT) {
                throw new RuntimeException(__($status));
            }

            return $this->success($actor, 'password_reset', $email, '重置密码', [], $previous);
        } catch (Throwable $exception) {
            return $this->failure($actor, 'password_reset', $email, '重置密码', $exception, [], $previous);
        }
    }

    public function sendWorkspaceInvitation(
        User $actor,
        Workspace $workspace,
        WorkspaceMember $member,
        string $token,
        ?EmailDeliveryLog $previous = null,
    ): array {
        $context = [
            'workspace_id' => $workspace->id,
            'workspace_member_id' => $member->id,
            'actor_id' => $actor->id,
        ];

        if (! $this->configuration->isMailReady()) {
            return $this->failure(
                $actor,
                'workspace_invitation',
                $member->email,
                '加入 '.$workspace->name,
                new RuntimeException('SMTP 尚未完成配置或验证。'),
                $context,
                $previous,
            );
        }

        try {
            $this->refreshMailer();
            $url = route('workspace.invitation', ['token' => $token]);
            $expires = $member->invitation_expires_at?->format('Y-m-d H:i') ?? now()->addDays(7)->format('Y-m-d H:i');
            Mail::raw(
                "{$actor->name} 邀请你加入 GoJet 工作区“{$workspace->name}”。

接受邀请：{$url}

邀请有效期至：{$expires}",
                fn ($message) => $message->to($member->email)->subject('加入 GoJet 工作区：'.$workspace->name),
            );

            return $this->success($actor, 'workspace_invitation', $member->email, '加入 '.$workspace->name, $context, $previous);
        } catch (Throwable $exception) {
            return $this->failure($actor, 'workspace_invitation', $member->email, '加入 '.$workspace->name, $exception, $context, $previous);
        }
    }

    public function sendTest(User $admin, string $recipient, ?EmailDeliveryLog $previous = null): array
    {
        if (! $this->configuration->isMailConfigured()) {
            return $this->failure(
                $admin,
                'smtp_test',
                $recipient,
                'GoJet SMTP 测试',
                new RuntimeException('SMTP 配置不完整，无法发送测试邮件。'),
                ['admin_id' => $admin->id],
                $previous,
            );
        }

        try {
            $this->refreshMailer();
            Mail::raw(
                '这是一封来自 GoJet 系统设置中心的 SMTP 测试邮件。发送时间：'.now()->toDateTimeString(),
                fn ($message) => $message->to($recipient)->subject('GoJet SMTP 测试'),
            );

            return $this->success($admin, 'smtp_test', $recipient, 'GoJet SMTP 测试', ['admin_id' => $admin->id], $previous);
        } catch (Throwable $exception) {
            return $this->failure($admin, 'smtp_test', $recipient, 'GoJet SMTP 测试', $exception, ['admin_id' => $admin->id], $previous);
        }
    }

    public function retry(EmailDeliveryLog $log, User $admin): array
    {
        return match ($log->message_type) {
            'email_verification' => $log->user
                ? $this->sendVerification($log->user, $log)
                : $this->failure($admin, $log->message_type, $log->recipient, $log->subject ?? '邮箱验证', new RuntimeException('原用户已不存在，无法重试。'), [], $log),
            'password_reset' => $this->sendPasswordReset($log->recipient, $admin, $log),
            'smtp_test' => $this->sendTest($admin, $log->recipient, $log),
            'workspace_invitation' => $this->retryWorkspaceInvitation($log, $admin),
            default => $this->failure($admin, $log->message_type, $log->recipient, $log->subject ?? '邮件', new RuntimeException('该邮件类型不支持自动重试。'), [], $log),
        };
    }

    private function retryWorkspaceInvitation(EmailDeliveryLog $log, User $admin): array
    {
        $memberId = (int) data_get($log->context, 'workspace_member_id');
        $member = WorkspaceMember::with('workspace')->find($memberId);
        if (! $member || ! $member->workspace || $member->status === 'active') {
            return $this->failure($admin, 'workspace_invitation', $log->recipient, $log->subject ?? '工作区邀请', new RuntimeException('邀请记录已失效，无法重试。'), [], $log);
        }

        $token = Str::random(64);
        $member->update([
            'status' => 'invited',
            'invitation_token_hash' => hash('sha256', $token),
            'invited_at' => now(),
            'invitation_expires_at' => now()->addDays(7),
            'revoked_at' => null,
            'last_sent_at' => now(),
            'invitation_attempts' => $member->invitation_attempts + 1,
        ]);

        return $this->sendWorkspaceInvitation($admin, $member->workspace, $member, $token, $log);
    }

    private function refreshMailer(): void
    {
        $this->configuration->apply();
        Mail::purge('smtp');
    }

    private function success(?User $user, string $type, string $recipient, string $subject, array $context, ?EmailDeliveryLog $previous): array
    {
        $log = $previous ?? new EmailDeliveryLog;
        $log->fill([
            'user_id' => $user?->id ?? $log->user_id,
            'message_type' => $type,
            'recipient' => $recipient,
            'subject' => $subject,
            'transport' => (string) config('mail.default', 'smtp'),
            'status' => 'sent',
            'attempts' => ($previous?->attempts ?? 0) + 1,
            'error_class' => null,
            'error_message' => null,
            'context' => $context,
            'sent_at' => now(),
            'last_attempt_at' => now(),
        ])->save();

        return ['ok' => true, 'message' => '邮件已成功发送。', 'log_id' => $log->id];
    }

    private function failure(
        ?User $user,
        string $type,
        string $recipient,
        string $subject,
        Throwable $exception,
        array $context,
        ?EmailDeliveryLog $previous,
    ): array {
        try {
            $log = $previous ?? new EmailDeliveryLog;
            $log->fill([
                'user_id' => $user?->id ?? $log->user_id,
                'message_type' => $type,
                'recipient' => $recipient,
                'subject' => $subject,
                'transport' => (string) config('mail.default', 'smtp'),
                'status' => 'failed',
                'attempts' => ($previous?->attempts ?? 0) + 1,
                'error_class' => $exception::class,
                'error_message' => Str::limit($exception->getMessage(), 5000, ''),
                'context' => $context,
                'sent_at' => null,
                'last_attempt_at' => now(),
            ])->save();
            $logId = $log->id;
        } catch (Throwable $logException) {
            $logId = null;
            Log::critical('GoJet could not persist the mail failure log.', ['exception' => $logException]);
        }

        Log::error('GoJet mail delivery failed.', [
            'type' => $type,
            'recipient' => $recipient,
            'error' => $exception->getMessage(),
        ]);

        return [
            'ok' => false,
            'message' => '邮件暂时无法发送。错误已经记录，管理员可以在“系统设置 → 邮件”查看原因并重试。',
            'technical' => Str::limit($exception->getMessage(), 800, ''),
            'log_id' => $logId,
        ];
    }
}
