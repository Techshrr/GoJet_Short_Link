#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
version="rehearsal-$(git rev-parse --short HEAD)"
./scripts/packagerelease.sh "$version" >/tmp/gojet-release-path
archive="$(tail -1 /tmp/gojet-release-path)"
(cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256")
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
unzip -q "$archive" -d "$tmp"
root="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -1)"
(cd "$root" && sh -n install.sh installhostnginx.sh installnativelemp.sh launchwebinstaller.sh upgrade.sh rollback.sh scripts/lib.sh scripts/verifyrelease.sh)
(cd "$root" && php -l installer/index.php >/dev/null)
(cd "$root" && go build ./services/redirectengine/cmd/server ./services/analyticsworker/cmd/worker ./services/analyticsreconciler/cmd/reconciler ./services/platformapi/cmd/server ./services/platformapi/cmd/mailworker ./services/platformapi/cmd/fileworker ./services/platformapi/cmd/operationsmonitor ./services/logreceiver/cmd/server)
grep -q 'condition: service_healthy' "$root/deploy/compose.production.yaml"
grep -q 'profiles: \["bundled-nginx"\]' "$root/deploy/compose.hostnginx.yaml"
grep -q '127.0.0.1:18080:8080' "$root/deploy/compose.hostnginx.yaml"
grep -q 'server_name __GOJET_SERVER_NAME__' "$root/deploy/nginx/gojetnative.conf"
test -x "$root/bin/platformapi"
printf 'Linux release rehearsal passed: %s\n' "$archive"
