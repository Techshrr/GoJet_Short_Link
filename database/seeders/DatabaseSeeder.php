<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('GOJET_ADMIN_EMAIL');
        $password = env('GOJET_ADMIN_PASSWORD');

        if ($email && $password) {
            User::updateOrCreate(
                ['email' => $email],
                ['name' => env('GOJET_ADMIN_NAME', 'GoJet Administrator'), 'password' => $password, 'is_admin' => true, 'status' => 'active', 'email_verified_at' => now()],
            );
        }
    }
}
