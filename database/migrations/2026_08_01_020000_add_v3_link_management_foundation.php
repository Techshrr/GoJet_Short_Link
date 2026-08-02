<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('slug', 140);
            $table->text('description')->nullable();
            $table->string('color', 20)->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('starts_at')->nullable()->index();
            $table->timestamp('ends_at')->nullable()->index();
            $table->timestamps();
            $table->unique(['user_id', 'slug']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('folders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('folders')->nullOnDelete();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->string('color', 20)->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->index(['user_id', 'parent_id', 'position']);
        });

        Schema::create('tags', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('slug', 100);
            $table->string('color', 20)->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'slug']);
        });

        Schema::table('links', function (Blueprint $table): void {
            $table->foreignId('campaign_id')->nullable()->after('domain_id')->constrained()->nullOnDelete();
            $table->foreignId('folder_id')->nullable()->after('campaign_id')->constrained()->nullOnDelete();
            $table->text('description')->nullable()->after('title');
            $table->text('notes')->nullable()->after('description');
            $table->json('utm_parameters')->nullable()->after('notes');
            $table->json('qr_settings')->nullable()->after('utm_parameters');
            $table->timestamp('starts_at')->nullable()->after('password_hash')->index();
            $table->timestamp('archived_at')->nullable()->after('max_clicks')->index();
            $table->string('health_status', 20)->nullable()->after('clicks_count')->index();
            $table->unsignedSmallInteger('health_http_status')->nullable()->after('health_status');
            $table->text('health_error')->nullable()->after('health_http_status');
            $table->timestamp('last_health_checked_at')->nullable()->after('health_error')->index();
            $table->string('preview_title', 255)->nullable()->after('last_health_checked_at');
            $table->text('preview_description')->nullable()->after('preview_title');
            $table->text('preview_image_url')->nullable()->after('preview_description');
            $table->text('favicon_url')->nullable()->after('preview_image_url');
            $table->softDeletes();
            $table->index(['user_id', 'campaign_id', 'created_at']);
            $table->index(['user_id', 'folder_id', 'created_at']);
        });

        Schema::create('link_tag', function (Blueprint $table): void {
            $table->foreignId('link_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['link_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('link_tag');

        Schema::table('links', function (Blueprint $table): void {
            $table->dropIndex(['user_id', 'campaign_id', 'created_at']);
            $table->dropIndex(['user_id', 'folder_id', 'created_at']);
            $table->dropConstrainedForeignId('campaign_id');
            $table->dropConstrainedForeignId('folder_id');
            $table->dropColumn([
                'description',
                'notes',
                'utm_parameters',
                'qr_settings',
                'starts_at',
                'archived_at',
                'health_status',
                'health_http_status',
                'health_error',
                'last_health_checked_at',
                'preview_title',
                'preview_description',
                'preview_image_url',
                'favicon_url',
                'deleted_at',
            ]);
        });

        Schema::dropIfExists('tags');
        Schema::dropIfExists('folders');
        Schema::dropIfExists('campaigns');
    }
};
