<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 80);
            $table->string('email', 190)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->boolean('is_admin')->default(false)->index();
            $table->string('status', 20)->default('active')->index();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table): void {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('domains', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('hostname', 253)->unique();
            $table->string('verification_token', 96);
            $table->timestamp('verified_at')->nullable();
            $table->string('status', 20)->default('pending')->index();
            $table->boolean('is_default')->default(false);
            $table->string('certificate_status', 30)->default('pending');
            $table->string('cloudflare_hostname_id')->nullable()->unique();
            $table->timestamps();
        });

        Schema::create('links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('domain_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('host', 253);
            $table->string('slug', 64);
            $table->text('target_url');
            $table->string('title', 190)->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->unsignedSmallInteger('redirect_type')->default(302);
            $table->string('password_hash')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->unsignedBigInteger('max_clicks')->nullable();
            $table->unsignedBigInteger('clicks_count')->default(0);
            $table->timestamps();
            $table->unique(['host', 'slug']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('api_tokens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->char('token_hash', 64)->unique();
            $table->json('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('click_events', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignId('link_id')->constrained()->cascadeOnDelete();
            $table->timestamp('occurred_at')->index();
            $table->char('ip_hash', 64)->index();
            $table->char('country_code', 2)->nullable()->index();
            $table->string('device_type', 20)->nullable();
            $table->string('browser', 40)->nullable();
            $table->string('platform', 40)->nullable();
            $table->string('referrer_host', 253)->nullable()->index();
            $table->boolean('is_bot')->default(false)->index();
            $table->index(['link_id', 'occurred_at']);
        });

        Schema::create('link_daily_stats', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('link_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->unsignedBigInteger('clicks')->default(0);
            $table->unsignedBigInteger('unique_clicks')->default(0);
            $table->timestamps();
            $table->unique(['link_id', 'date']);
        });

        Schema::create('abuse_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('link_id')->nullable()->constrained()->nullOnDelete();
            $table->string('short_url', 2048);
            $table->string('reporter_email', 190);
            $table->string('reason', 30)->index();
            $table->text('details');
            $table->string('status', 20)->default('open')->index();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100)->index();
            $table->nullableMorphs('subject');
            $table->json('metadata')->nullable();
            $table->char('ip_hash', 64)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });

        Schema::create('cache', function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });
        Schema::create('cache_locks', function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });
        Schema::create('sessions', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
        Schema::create('jobs', function (Blueprint $table): void {
            $table->id();
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedTinyInteger('attempts');
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });
        Schema::create('job_batches', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name');
            $table->integer('total_jobs');
            $table->integer('pending_jobs');
            $table->integer('failed_jobs');
            $table->longText('failed_job_ids');
            $table->mediumText('options')->nullable();
            $table->integer('cancelled_at')->nullable();
            $table->integer('created_at');
            $table->integer('finished_at')->nullable();
        });
        Schema::create('failed_jobs', function (Blueprint $table): void {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('job_batches');
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('abuse_reports');
        Schema::dropIfExists('link_daily_stats');
        Schema::dropIfExists('click_events');
        Schema::dropIfExists('api_tokens');
        Schema::dropIfExists('links');
        Schema::dropIfExists('domains');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
