<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->string('status', 20)->default('active')->index();
            $table->string('plan_code', 60)->default('free')->index();
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        Schema::create('workspace_members', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('email', 190);
            $table->string('role', 30)->default('viewer')->index();
            $table->string('status', 20)->default('invited')->index();
            $table->char('invitation_token_hash', 64)->nullable()->unique();
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
            $table->unique(['workspace_id', 'email']);
        });

        foreach (['links', 'domains', 'api_tokens', 'campaigns', 'folders', 'tags'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->foreignId('workspace_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
                $table->index(['workspace_id', 'created_at']);
            });
        }

        Schema::create('link_destinations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('link_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120)->nullable();
            $table->text('target_url');
            $table->unsignedSmallInteger('weight')->default(100);
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_fallback')->default(false);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->index(['link_id', 'position']);
        });

        Schema::create('routing_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('link_id')->constrained()->cascadeOnDelete();
            $table->foreignId('destination_id')->constrained('link_destinations')->cascadeOnDelete();
            $table->string('type', 40)->index();
            $table->string('operator', 30)->default('in');
            $table->json('values');
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->index(['link_id', 'priority']);
        });

        Schema::create('conversion_events', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignId('link_id')->constrained()->cascadeOnDelete();
            $table->foreignId('destination_id')->nullable()->constrained('link_destinations')->nullOnDelete();
            $table->string('event_name', 80)->index();
            $table->string('visitor_key', 96)->nullable()->index();
            $table->decimal('value', 14, 4)->nullable();
            $table->string('currency', 3)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });

        Schema::table('click_events', function (Blueprint $table): void {
            $table->foreignId('destination_id')->nullable()->after('link_id')->constrained('link_destinations')->nullOnDelete();
            $table->string('region', 120)->nullable()->index();
            $table->string('city', 120)->nullable()->index();
            $table->string('language', 20)->nullable()->index();
            $table->string('utm_source', 120)->nullable()->index();
            $table->string('utm_medium', 120)->nullable()->index();
            $table->string('utm_campaign', 160)->nullable()->index();
            $table->string('utm_content', 160)->nullable();
            $table->string('utm_term', 160)->nullable();
            $table->string('visit_type', 20)->default('link')->index();
        });

        Schema::create('text_shares', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->nullable()->constrained()->nullOnDelete();
            $table->string('slug', 80)->unique();
            $table->string('title', 190)->nullable();
            $table->longText('content');
            $table->string('format', 20)->default('plain')->index();
            $table->string('syntax_language', 60)->nullable();
            $table->string('visibility', 20)->default('unlisted')->index();
            $table->string('password_hash')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->boolean('burn_after_read')->default(false);
            $table->unsignedBigInteger('views_count')->default(0);
            $table->unsignedBigInteger('max_views')->nullable();
            $table->timestamp('last_viewed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('text_revisions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('text_share_id')->constrained()->cascadeOnDelete();
            $table->foreignId('editor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->longText('content');
            $table->string('format', 20);
            $table->string('syntax_language', 60)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('file_shares', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->nullable()->constrained()->nullOnDelete();
            $table->string('slug', 80)->unique();
            $table->string('disk', 40)->default('local');
            $table->text('path');
            $table->string('original_name', 255);
            $table->string('mime_type', 190)->nullable();
            $table->unsignedBigInteger('size_bytes');
            $table->char('sha256', 64)->index();
            $table->string('visibility', 20)->default('unlisted')->index();
            $table->string('password_hash')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->unsignedBigInteger('downloads_count')->default(0);
            $table->unsignedBigInteger('max_downloads')->nullable();
            $table->string('scan_status', 30)->default('pending')->index();
            $table->text('scan_result')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('file_upload_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('disk', 40)->default('local');
            $table->string('original_name', 255);
            $table->unsignedBigInteger('size_bytes');
            $table->unsignedBigInteger('received_bytes')->default(0);
            $table->unsignedInteger('chunk_size')->default(5242880);
            $table->string('status', 20)->default('pending')->index();
            $table->json('metadata')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });

        Schema::create('profile_pages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('domain_id')->nullable()->constrained()->nullOnDelete();
            $table->string('slug', 80);
            $table->string('title', 160);
            $table->text('bio')->nullable();
            $table->text('avatar_path')->nullable();
            $table->string('theme', 60)->default('aurora');
            $table->json('theme_settings')->nullable();
            $table->string('status', 20)->default('draft')->index();
            $table->timestamp('published_at')->nullable()->index();
            $table->unsignedBigInteger('views_count')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['domain_id', 'slug']);
        });

        Schema::create('profile_blocks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('profile_page_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30)->index();
            $table->json('content');
            $table->json('settings')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->unsignedBigInteger('clicks_count')->default(0);
            $table->timestamps();
            $table->index(['profile_page_id', 'position']);
        });

        Schema::create('plans', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 60)->unique();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->decimal('monthly_price', 12, 2)->default(0);
            $table->decimal('yearly_price', 12, 2)->default(0);
            $table->string('currency', 3)->default('USD');
            $table->json('limits');
            $table->json('features')->nullable();
            $table->boolean('is_public')->default(true)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained()->restrictOnDelete();
            $table->string('provider', 40)->default('manual');
            $table->string('provider_subscription_id')->nullable()->unique();
            $table->string('status', 30)->default('active')->index();
            $table->string('interval', 20)->default('monthly');
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable()->index();
            $table->timestamp('grace_ends_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->string('number', 80)->unique();
            $table->string('status', 20)->default('open')->index();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->string('currency', 3)->default('USD');
            $table->timestamp('issued_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('webhooks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->text('url');
            $table->char('secret_hash', 64);
            $table->text('secret_encrypted');
            $table->json('events');
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('last_success_at')->nullable();
            $table->timestamp('last_failure_at')->nullable();
            $table->timestamps();
        });

        Schema::create('webhook_deliveries', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignId('webhook_id')->constrained()->cascadeOnDelete();
            $table->uuid('event_id')->index();
            $table->string('event_name', 100)->index();
            $table->json('payload');
            $table->unsignedSmallInteger('attempt')->default(1);
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->text('response_body')->nullable();
            $table->string('status', 20)->default('pending')->index();
            $table->timestamp('next_attempt_at')->nullable()->index();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });

        Schema::create('system_settings', function (Blueprint $table): void {
            $table->string('key', 160)->primary();
            $table->longText('value')->nullable();
            $table->boolean('is_secret')->default(false);
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('webhook_deliveries');
        Schema::dropIfExists('webhooks');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
        Schema::dropIfExists('profile_blocks');
        Schema::dropIfExists('profile_pages');
        Schema::dropIfExists('file_upload_sessions');
        Schema::dropIfExists('file_shares');
        Schema::dropIfExists('text_revisions');
        Schema::dropIfExists('text_shares');

        Schema::table('click_events', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('destination_id');
            $table->dropColumn(['region', 'city', 'language', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'visit_type']);
        });

        Schema::dropIfExists('conversion_events');
        Schema::dropIfExists('routing_rules');
        Schema::dropIfExists('link_destinations');

        foreach (['links', 'domains', 'api_tokens', 'campaigns', 'folders', 'tags'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropConstrainedForeignId('workspace_id');
            });
        }

        Schema::dropIfExists('workspace_members');
        Schema::dropIfExists('workspaces');
    }
};
