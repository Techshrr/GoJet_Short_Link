<?php

return [
    'default' => env('MAIL_MAILER', 'log'),
    'mailers' => [
        'smtp' => [
            'transport' => 'smtp',
            // Symfony Mailer accepts only smtp/smtps as the transport scheme.
            // Legacy MAIL_ENCRYPTION=tls/ssl is normalized for upgrades.
            'scheme' => env('MAIL_SCHEME', env('MAIL_ENCRYPTION') === 'ssl' ? 'smtps' : 'smtp'),
            'auto_tls' => env('MAIL_AUTO_TLS', env('MAIL_ENCRYPTION') !== 'none'),
            'require_tls' => env('MAIL_REQUIRE_TLS', in_array(env('MAIL_ENCRYPTION'), ['tls', 'starttls'], true)),
            'url' => env('MAIL_URL'),
            'host' => env('MAIL_HOST', '127.0.0.1'),
            'port' => env('MAIL_PORT', 2525),
            'username' => env('MAIL_USERNAME'),
            'password' => env('MAIL_PASSWORD'),
            'timeout' => null,
            'local_domain' => env('MAIL_EHLO_DOMAIN', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST)),
        ],
        'log' => ['transport' => 'log', 'channel' => env('MAIL_LOG_CHANNEL')],
        'array' => ['transport' => 'array'],
        'failover' => ['transport' => 'failover', 'mailers' => ['smtp', 'log'], 'retry_after' => 60],
    ],
    'from' => ['address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'), 'name' => env('MAIL_FROM_NAME', 'GoJet')],
];
