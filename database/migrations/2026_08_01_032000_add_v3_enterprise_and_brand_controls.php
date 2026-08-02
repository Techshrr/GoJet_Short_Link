<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('domains', function (Blueprint $table): void {
            $table->text('not_found_url')->nullable()->after('provisioning_error');
            $table->json('branding_settings')->nullable()->after('not_found_url');
        });

        Schema::create('coupons', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 80)->unique();
            $table->string('name', 120);
            $table->string('discount_type', 20);
            $table->decimal('discount_value', 12, 2);
            $table->json('plan_codes')->nullable();
            $table->unsignedInteger('max_redemptions')->nullable();
            $table->unsignedInteger('redemptions_count')->default(0);
            $table->timestamp('starts_at')->nullable()->index();
            $table->timestamp('expires_at')->nullable()->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->foreignId('coupon_id')->nullable()->after('plan_id')->constrained()->nullOnDelete();
        });

        Schema::create('coupon_redemptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->timestamp('redeemed_at')->useCurrent();
            $table->unique(['coupon_id', 'workspace_id', 'subscription_id']);
        });

        Schema::create('workspace_ip_allowlists', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('cidr', 64);
            $table->string('label', 120)->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['workspace_id', 'cidr']);
        });

        Schema::create('sso_connections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 20);
            $table->string('name', 120);
            $table->text('configuration_encrypted');
            $table->json('domains')->nullable();
            $table->boolean('is_enabled')->default(false)->index();
            $table->boolean('enforce_for_members')->default(false);
            $table->timestamps();
            $table->unique(['workspace_id', 'provider', 'name']);
        });

        Schema::create('profile_feed_sources', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('profile_page_id')->constrained()->cascadeOnDelete();
            $table->string('adapter', 30);
            $table->string('name', 120);
            $table->text('source_url')->nullable();
            $table->json('configuration')->nullable();
            $table->json('cached_items')->nullable();
            $table->string('status', 20)->default('pending')->index();
            $table->text('last_error')->nullable();
            $table->timestamp('last_refreshed_at')->nullable()->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_feed_sources');
        Schema::dropIfExists('sso_connections');
        Schema::dropIfExists('workspace_ip_allowlists');
        Schema::dropIfExists('coupon_redemptions');
        Schema::table('subscriptions', fn (Blueprint $table) => $table->dropConstrainedForeignId('coupon_id'));
        Schema::dropIfExists('coupons');
        Schema::table('domains', fn (Blueprint $table) => $table->dropColumn(['not_found_url', 'branding_settings']));
    }
};
