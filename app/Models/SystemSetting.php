<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;
use Throwable;

class SystemSetting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public const CREATED_AT = null;

    public const UPDATED_AT = 'updated_at';

    protected $fillable = ['key', 'value', 'is_secret'];

    protected function casts(): array
    {
        return ['is_secret' => 'boolean'];
    }

    public static function read(string $key, mixed $default = null): mixed
    {
        $setting = static::query()->find($key);
        if (! $setting || $setting->value === null) {
            return $default;
        }

        try {
            $value = $setting->is_secret ? Crypt::decryptString((string) $setting->value) : (string) $setting->value;
        } catch (Throwable) {
            return $default;
        }

        $decoded = json_decode($value, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }

    public static function write(string $key, mixed $value, bool $secret = false): self
    {
        $encoded = is_string($value)
            ? $value
            : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        if ($secret) {
            $encoded = Crypt::encryptString($encoded);
        }

        return static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $encoded, 'is_secret' => $secret, 'updated_at' => now()],
        );
    }

    public static function merge(string $key, array $values, bool $secret = false): self
    {
        $current = static::read($key, []);

        return static::write($key, array_replace_recursive(is_array($current) ? $current : [], $values), $secret);
    }
}
