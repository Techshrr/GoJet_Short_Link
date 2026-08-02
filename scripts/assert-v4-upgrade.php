<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$failures = [];
$expect = static function (bool $condition, string $message) use (&$failures): void {
    if (! $condition) {
        $failures[] = $message;
    }
};

foreach (['email_delivery_logs', 'analytics_ingest_failures'] as $table) {
    $expect(Schema::hasTable($table), "Missing V4 table: {$table}");
}
foreach (['event_uuid', 'referrer_url', 'referrer_type', 'source_channel', 'is_unique', 'ingestion_source'] as $column) {
    $expect(Schema::hasColumn('click_events', $column), "Missing click_events.{$column}");
}
foreach (['invitation_expires_at', 'revoked_at', 'last_sent_at', 'invitation_attempts'] as $column) {
    $expect(Schema::hasColumn('workspace_members', $column), "Missing workspace_members.{$column}");
}

$expect(DB::table('users')->count() >= 0, 'Users table is inaccessible.');
$expect(DB::table('links')->whereNull('slug')->count() === 0, 'A link lost its slug during upgrade.');
$expect(DB::table('workspaces')->count() >= DB::table('users')->whereNotNull('id')->count() || DB::table('users')->count() === 0, 'Personal workspace backfill appears incomplete.');

if ($failures !== []) {
    fwrite(STDERR, "GoJet V3 → V4 upgrade acceptance: FAIL\n- ".implode("\n- ", $failures)."\n");
    exit(1);
}

fwrite(STDOUT, "GoJet V3 → V4 upgrade acceptance: PASS\n");
