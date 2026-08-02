<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail as MustVerifyEmailContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class User extends Authenticatable implements MustVerifyEmailContract
{
    use HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'email_verified_at', 'is_admin', 'status'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['email_verified_at' => 'datetime', 'password' => 'hashed', 'is_admin' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::created(function (User $user): void {
            if (! Schema::hasTable('workspaces')) {
                return;
            }

            $workspace = $user->ownedWorkspaces()->create([
                'name' => $user->name.' Workspace',
                'slug' => (Str::slug($user->name) ?: 'workspace').'-'.$user->id,
                'status' => 'active',
                'plan_code' => 'free',
                'settings' => ['personal' => true],
            ]);

            $workspace->members()->create([
                'user_id' => $user->id,
                'email' => strtolower($user->email),
                'role' => 'owner',
                'status' => 'active',
                'invited_at' => now(),
                'accepted_at' => now(),
            ]);
        });
    }

    public function links(): HasMany
    {
        return $this->hasMany(Link::class);
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class);
    }

    public function folders(): HasMany
    {
        return $this->hasMany(Folder::class);
    }

    public function tags(): HasMany
    {
        return $this->hasMany(Tag::class);
    }

    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class);
    }

    public function apiTokens(): HasMany
    {
        return $this->hasMany(ApiToken::class);
    }

    public function textShares(): HasMany
    {
        return $this->hasMany(TextShare::class);
    }

    public function fileShares(): HasMany
    {
        return $this->hasMany(FileShare::class);
    }

    public function profilePages(): HasMany
    {
        return $this->hasMany(ProfilePage::class);
    }

    public function ownedWorkspaces(): HasMany
    {
        return $this->hasMany(Workspace::class, 'owner_user_id');
    }

    public function workspaceMemberships(): HasMany
    {
        return $this->hasMany(WorkspaceMember::class);
    }

    public function currentWorkspace(): ?Workspace
    {
        $requested = session('gojet.workspace_id');

        return $this->ownedWorkspaces()->whereKey($requested)->first()
            ?? Workspace::query()->whereHas('members', fn ($query) => $query->where('user_id', $this->id)->where('status', 'active'))->whereKey($requested)->first()
            ?? $this->ownedWorkspaces()->oldest()->first()
            ?? Workspace::query()->whereHas('members', fn ($query) => $query->where('user_id', $this->id)->where('status', 'active'))->oldest()->first();
    }
}
