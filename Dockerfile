# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS assets
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY resources ./resources
COPY vite.config.js ./
RUN npm run build

FROM php:8.4-fpm-bookworm AS php-base
RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu libcurl4-openssl-dev libfreetype6-dev libicu-dev libjpeg62-turbo-dev \
    libonig-dev libpng-dev libxml2-dev libzip-dev unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" bcmath curl dom exif fileinfo gd intl mbstring opcache pcntl pdo_mysql xml zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

FROM php-base AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts --no-progress
COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-interaction

FROM php-base AS runtime
WORKDIR /var/www/html
COPY --from=vendor /app /var/www/html
COPY --from=assets /app/public/build /var/www/html/public/build
COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-gojet.ini
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/10-opcache.ini
COPY docker/entrypoint.sh /usr/local/bin/gojet-entrypoint

RUN chmod +x /usr/local/bin/gojet-entrypoint \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && cp -a public /opt/gojet-public \
    && chown -R www-data:www-data storage bootstrap/cache public /opt/gojet-public

ENTRYPOINT ["gojet-entrypoint"]
CMD ["php-fpm", "-F"]
