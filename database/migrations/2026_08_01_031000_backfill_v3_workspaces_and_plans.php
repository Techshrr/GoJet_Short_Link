<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('plans')->upsert([
            [
                'code' => 'free',
                'name' => 'Free',
                'description' => 'Self-hosted starter plan',
                'monthly_price' => 0,
                'yearly_price' => 0,
                'currency' => 'USD',
                'limits' => json_encode(['links' => 1000, 'domains' => 3, 'texts' => 100, 'files' => 25, 'storage_mb' => 1024, 'profiles' => 3, 'members' => 1, 'api_requests_month' => 100000]),
                'features' => json_encode(['analytics', 'qr', 'api']),
                'is_public' => true,
                'is_active' => true,
                'position' => 10,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'pro',
                'name' => 'Pro',
                'description' => 'Advanced routing, sharing and branded profiles',
                'monthly_price' => 12,
                'yearly_price' => 120,
                'currency' => 'USD',
                'limits' => json_encode(['links' => 50000, 'domains' => 25, 'texts' => 5000, 'files' => 1000, 'storage_mb' => 102400, 'profiles' => 50, 'members' => 10, 'api_requests_month' => 2000000]),
                'features' => json_encode(['analytics', 'advanced_routing', 'qr', 'files', 'profiles', 'webhooks', 'api']),
                'is_public' => true,
                'is_active' => true,
                'position' => 20,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'business',
                'name' => 'Business',
                'description' => 'Teams, governance and higher quotas',
                'monthly_price' => 39,
                'yearly_price' => 390,
                'currency' => 'USD',
                'limits' => json_encode(['links' => 500000, 'domains' => 200, 'texts' => 50000, 'files' => 10000, 'storage_mb' => 1048576, 'profiles' => 500, 'members' => 100, 'api_requests_month' => 20000000]),
                'features' => json_encode(['analytics', 'advanced_routing', 'qr', 'files', 'profiles', 'webhooks', 'api', 'teams', 'audit']),
                'is_public' => true,
                'is_active' => true,
                'position' => 30,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ], ['code'], ['name', 'description', 'monthly_price', 'yearly_price', 'currency', 'limits', 'features', 'is_public', 'is_active', 'position', 'updated_at']);

        DB::table('users')->orderBy('id')->each(function (object $user) use ($now): void {
            $base = Str::slug((string) ($user->name ?: Str::before($user->email, '@'))) ?: 'workspace';
            $slug = $base.'-'.$user->id;

            $workspaceId = DB::table('workspaces')->where('owner_user_id', $user->id)->value('id');
            if (! $workspaceId) {
                $workspaceId = DB::table('workspaces')->insertGetId([
                    'owner_user_id' => $user->id,
                    'name' => ($user->name ?: 'Personal').' Workspace',
                    'slug' => $slug,
                    'status' => 'active',
                    'plan_code' => 'free',
                    'settings' => json_encode(['personal' => true]),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('workspace_members')->updateOrInsert(
                ['workspace_id' => $workspaceId, 'email' => strtolower($user->email)],
                ['user_id' => $user->id, 'role' => 'owner', 'status' => 'active', 'invited_at' => $now, 'accepted_at' => $now, 'created_at' => $now, 'updated_at' => $now],
            );

            foreach (['links', 'domains', 'api_tokens', 'campaigns', 'folders', 'tags'] as $tableName) {
                DB::table($tableName)->where('user_id', $user->id)->whereNull('workspace_id')->update(['workspace_id' => $workspaceId]);
            }
        });
    }

    public function down(): void
    {
        // Data backfills are intentionally retained during rollback.
    }
};
