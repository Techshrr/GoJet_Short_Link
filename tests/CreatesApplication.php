<?php

namespace Tests;

use IlluminateFoundationApplication;

trait CreatesApplication
{
    public function createApplication(): Application
    {
        return require __DIR__.'/../bootstrap/app.php';
    }
}
