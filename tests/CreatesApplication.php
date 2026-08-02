<?php

namespace Tests;

use Illuminate\Foundation\Application;

trait CreatesApplication
{
    public function createApplication(): Application
    {
        return require __DIR__.'/../bootstrap/app.php';
    }
}
