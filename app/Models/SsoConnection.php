<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class SsoConnection extends Model
{
    protected $fillable = ['workspace_id', 'provider', 'name', 'configuration_encrypted', 'domains', 'is_enabled', 'enforce_for_members'];

    protected $hidden = ['configuration_encrypted'];

    protected function casts(): array
    {
        return ['domains' => 'array', 'is_enabled' => 'boolean', 'enforce_for_members' => 'boolean'];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function configuration(): array
    {
        return json_decode(Crypt::decryptString($this->configuration_encrypted), true, flags: JSON_THROW_ON_ERROR);
    }

    public function setConfiguration(array $configuration): void
    {
        $this->configuration_encrypted = Crypt::encryptString(json_encode($configuration, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }
}
