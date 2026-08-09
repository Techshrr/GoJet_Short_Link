#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
version="rehearsal-$(git rev-parse --short HEAD)"
./scripts/package-release.sh "$version" >/tmp/gojet-release-path
archive="$(tail -1 /tmp/gojet-release-path)"
(cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256")
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
unzip -q "$archive" -d "$tmp"
root="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -1)"
(cd "$root" && sh -n install.sh install-host-nginx.sh install-native-lemp.sh launch-web-installer.sh upgrade.sh rollback.sh scripts/lib.sh scripts/verify-release.sh)
(cd "$root" && php -l installer/index.php >/dev/null)
(cd "$root" && go build ./services/redirect-engine/cmd/server ./services/analytics-worker/cmd/worker ./services/analytics-reconciler/cmd/reconciler ./services/platform-api/cmd/server ./services/platform-api/cmd/mail-worker ./services/platform-api/cmd/file-worker ./services/platform-api/cmd/operations-monitor ./services/log-receiver/cmd/server)
grep -q 'condition: service_healthy' "$root/deploy/compose.production.yaml"
grep -q 'profiles: \["bundled-nginx"\]' "$root/deploy/compose.host-nginx.yaml"
grep -q '127.0.0.1:18080:8080' "$root/deploy/compose.host-nginx.yaml"
grep -q 'server_name __GOJET_SERVER_NAME__' "$root/deploy/nginx/gojet-native.conf"
test -x "$root/bin/platform-api"
printf 'Linux release rehearsal passed: %s\n' "$archive"
