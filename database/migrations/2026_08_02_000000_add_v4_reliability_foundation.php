<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspace_members', function (Blueprint $table): void {
            $table->timestamp('invitation_expires_at')->nullable()->index()->after('accepted_at');
            $table->timestamp('revoked_at')->nullable()->index()->after('invitation_expires_at');
            $table->timestamp('last_sent_at')->nullable()->after('revoked_at');
            $table->unsignedSmallInteger('invitation_attempts')->default(0)->after('last_sent_at');
        });

        Schema::create('email_delivery_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('message_type', 60)->index();
            $table->string('recipient', 190)->index();
            $table->string('subject', 255)->nullable();
            $table->string('transport', 40)->default('smtp');
            $table->string('status', 20)->default('pending')->index();
            $table->unsignedSmallInteger('attempts')->default(1);
            $table->string('error_class', 190)->nullable();
            $table->text('error_message')->nullable();
            $table->json('context')->nullable();
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamps();
        });

        Schema::table('click_events', function (Blueprint $table): void {
            $table->uuid('event_uuid')->nullable()->unique()->after('id');
            $table->text('referrer_url')->nullable()->after('referrer_host');
            $table->string('referrer_type', 20)->default('direct')->index()->after('referrer_url');
            $table->string('source_channel', 40)->default('direct')->index()->after('referrer_type');
            $table->boolean('is_unique')->default(false)->index()->after('visit_type');
            $table->string('ingestion_source', 30)->default('laravel')->index()->after('is_unique');
            $table->unsignedInteger('response_ms')->nullable()->after('ingestion_source');
            $table->json('metadata')->nullable()->after('response_ms');
            $table->index(['link_id', 'is_unique', 'occurred_at'], 'click_events_link_unique_occurred_idx');
            $table->index(['link_id', 'referrer_type', 'occurred_at'], 'click_events_link_referrer_occurred_idx');
        });

        Schema::create('analytics_ingest_failures', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('link_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('event_uuid')->nullable()->index();
            $table->string('source', 30)->default('laravel')->index();
            $table->json('payload');
            $table->string('error_class', 190)->nullable();
            $table->text('error_message');
            $table->unsignedSmallInteger('attempts')->default(1);
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('resolved_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_ingest_failures');

        Schema::table('click_events', function (Blueprint $table): void {
            $table->dropIndex('click_events_link_unique_occurred_idx');
            $table->dropIndex('click_events_link_referrer_occurred_idx');
            $table->dropUnique('click_events_event_uuid_unique');
            $table->dropColumn([
                'event_uuid', 'referrer_url', 'referrer_type', 'source_channel',
                'is_unique', 'ingestion_source',
                'response_ms', 'metadata',
            ]);
        });

        Schema::dropIfExists('email_delivery_logs');

        Schema::table('workspace_members', function (Blueprint $table): void {
            $table->dropColumn(['invitation_expires_at', 'revoked_at', 'last_sent_at', 'invitation_attempts']);
        });
    }
};
