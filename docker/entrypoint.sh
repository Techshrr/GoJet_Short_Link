#!/bin/sh
set -eu

mkdir -p \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  bootstrap/cache \
  public

# A named volume mounted over public/ starts empty. Restore the immutable files
# built into the image before Nginx serves the shared public volume.
if [ -d /opt/gojet-public ]; then
  cp -a /opt/gojet-public/. public/
fi

chown -R www-data:www-data storage bootstrap/cache public

run_as_app() {
  gosu www-data "$@"
}

if [ "${GOJET_AUTO_MIGRATE:-false}" = "true" ]; then
  run_as_app php artisan migrate --force
fi

run_as_app php artisan config:cache
run_as_app php artisan view:cache

case "${1:-}" in
  php-fpm|php-fpm8*|php-fpm*)
    exec "$@"
    ;;
  *)
    exec gosu www-data "$@"
    ;;
esac
