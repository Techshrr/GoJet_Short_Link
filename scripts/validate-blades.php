<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Filesystem\Filesystem;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

/** @var Filesystem $files */
$files = $app->make(Filesystem::class);
$compiler = $app->make('blade.compiler');
$count = 0;
foreach ($files->allFiles(__DIR__.'/../resources/views') as $file) {
    if (! str_ends_with($file->getFilename(), '.blade.php')) {
        continue;
    }
    $compiler->compile($file->getPathname());
    $count++;
}
printf("    %d Blade templates compiled\n", $count);
