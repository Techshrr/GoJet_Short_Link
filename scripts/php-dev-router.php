<?php

/**
 * Router for PHP's built-in server during local and CI browser acceptance.
 * Existing files under public/ must be served directly so Vite assets retain
 * their correct MIME types; all other requests are delegated to Laravel.
 */

$public = dirname(__DIR__).'/public';
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$file = $public.$path;

if ($path !== '/' && is_file($file)) {
    return false;
}

require $public.'/index.php';
