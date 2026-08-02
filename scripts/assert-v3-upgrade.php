<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require dirname(__DIR__).'/vendor/autoload.php';

$app = require dirname(__DIR__).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$failures = [];
$expect = static function (bool $condition, string $message) use (&$failures): void {
    if (! $condition) {
        $failures[] = $message;
    }
};

foreach (['workspaces', 'workspace_members', 'plans', 'text_shares', 'file_shares', 'profile_pages', 'webhooks'] as $table) {
    $expect(Schema::hasTable($table), "Missing V3 table: {$table}");
}

$user = DB::table('users')->where('email', 'legacy@gojet.test')->first();
$expect($user !== null, 'Legacy V2 user was not preserved.');

if ($user !== null) {
    $workspace = DB::table('workspaces')->where('owner_user_id', $user->id)->first();
    $expect($workspace !== null, 'Personal workspace was not created for the V2 user.');

    if ($workspace !== null) {
        $member = DB::table('workspace_members')
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)
            ->first();
        $expect($member !== null, 'Owner membership was not created.');
        $expect(($member->role ?? null) === 'owner', 'Backfilled membership does not have owner role.');
        $expect(($member->status ?? null) === 'active', 'Backfilled membership is not active.');

        $link = DB::table('links')->where('slug', 'legacy-link')->first();
        $expect($link !== null, 'Legacy V2 link was not preserved.');
        $expect((int) ($link->workspace_id ?? 0) === (int) $workspace->id, 'Legacy link was not assigned to the personal workspace.');
        $expect(($link->target_url ?? null) === 'https://example.com/legacy', 'Legacy link target changed during upgrade.');

        $domain = DB::table('domains')->where('hostname', 'legacy.example.test')->first();
        $expect($domain !== null, 'Legacy V2 domain was not preserved.');
        $expect((int) ($domain->workspace_id ?? 0) === (int) $workspace->id, 'Legacy domain was not assigned to the personal workspace.');

        $token = DB::table('api_tokens')->where('name', 'Legacy integration')->first();
        $expect($token !== null, 'Legacy V2 API token was not preserved.');
        $expect((int) ($token->workspace_id ?? 0) === (int) $workspace->id, 'Legacy API token was not assigned to the personal workspace.');
    }
}

foreach (['free', 'pro', 'business'] as $plan) {
    $expect(DB::table('plans')->where('code', $plan)->where('is_active', true)->exists(), "Missing active plan: {$plan}");
}

if ($failures !== []) {
    fwrite(STDERR, "GoJet V2 → V3 upgrade acceptance: FAIL\n- ".implode("\n- ", $failures)."\n");
    exit(1);
}

fwrite(STDOUT, "GoJet V2 → V3 upgrade acceptance: PASS\n");
