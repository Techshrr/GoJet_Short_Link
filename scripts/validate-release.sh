#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '==> PHP syntax\n'
find app bootstrap config database routes tests -type f -name '*.php' -print0 \
  | xargs -0 -n1 php -l >/tmp/gojet-php-lint.log
printf '    %s PHP files passed\n' "$(wc -l </tmp/gojet-php-lint.log)"

printf '==> Laravel routes\n'
php artisan route:list --json >/tmp/gojet-routes.json
php -r '$r=json_decode(file_get_contents("/tmp/gojet-routes.json"), true, 512, JSON_THROW_ON_ERROR); printf("    %d routes, %d named routes\n", count($r), count(array_filter($r, fn($x)=>!empty($x["name"]))));'

printf '==> Blade compilation\n'
php scripts/validate-blades.php

printf '==> Go redirect plane\n'
(
  cd redirector
  test -z "$(gofmt -l .)" || { gofmt -l .; exit 1; }
  go test ./...
  go test -race ./...
  go vet ./...
  CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o ../bin/gojet-redirector .
)

printf '==> Deployment scripts\n'
bash -n scripts/*.sh

printf '==> Required release assets\n'
test -f public/build/manifest.json
test -f public/assets/gojet-v4.css
test -x bin/gojet-redirector
test -f deploy/systemd/gojet-redirector.service
test -f deploy/nginx/gojet.conf

printf '==> No fake production claims\n'
! grep -RInE '180,000\+|★★★★★|XTOM' resources/views README.md docs --exclude='VALIDATION_REPORT.md'

printf 'GoJet static and Go release validation passed.\n'
