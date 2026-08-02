<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('domains', function (Blueprint $table): void {
            $table->text('provisioning_error')->nullable()->after('cloudflare_hostname_id');
        });

        Schema::table('abuse_reports', function (Blueprint $table): void {
            $table->foreignId('resolved_by_user_id')
                ->nullable()
                ->after('status')
                ->constrained('users')
                ->nullOnDelete();
            $table->text('resolution_notes')->nullable()->after('resolved_by_user_id');
        });

        Schema::create('blocked_targets', function (Blueprint $table): void {
            $table->id();
            $table->string('match_type', 20)->index();
            $table->text('value');
            $table->char('value_hash', 64);
            $table->text('reason')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['match_type', 'value_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blocked_targets');

        Schema::table('abuse_reports', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('resolved_by_user_id');
            $table->dropColumn('resolution_notes');
        });

        Schema::table('domains', function (Blueprint $table): void {
            $table->dropColumn('provisioning_error');
        });
    }
};
