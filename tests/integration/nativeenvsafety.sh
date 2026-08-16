#!/usr/bin/env bash
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
SOURCE="$ROOT/scripts/nativeinstallerrun.sh"
TMPDIR=$(mktemp -d)
MARKER1=/tmp/gojetnativeenvowned1
MARKER2=/tmp/gojetnativeenvowned2
cleanup(){
  rm -rf "$TMPDIR"
  rm -f "$MARKER1" "$MARKER2"
}
trap cleanup EXIT
rm -f "$MARKER1" "$MARKER2"

# The generated runtime env contains web-installer supplied credentials. The
# root installer runner must parse it as data and must never source/eval it.
test -z "$(grep -F 'source "$ROOT/deploy/native/gojet.env"' "$SOURCE" || true)"
grep -Fq 'read_generated_env "$env_file" generated_env' "$SOURCE"

awk '
  /^read_generated_env\(\)\{/ {capture=1}
  capture {print}
  capture && /^}$/ {exit}
' "$SOURCE" > "$TMPDIR/parser.sh"
# shellcheck disable=SC1090
source "$TMPDIR/parser.sh"

cat > "$TMPDIR/gojet.env" <<'EOF'
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"
MYSQL_DATABASE="gojet_test"
MYSQL_USER="gojet_test"
MYSQL_PASSWORD="literal$(touch /tmp/gojetnativeenvowned1)\\slash\"quote`touch /tmp/gojetnativeenvowned2`$HOME"
ADMIN_BOOTSTRAP_EMAIL="admin@example.test"
EOF

declare -A parsed=()
read_generated_env "$TMPDIR/gojet.env" parsed
expected='literal$(touch /tmp/gojetnativeenvowned1)\slash"quote`touch /tmp/gojetnativeenvowned2`$HOME'
[[ "${parsed[MYSQL_PASSWORD]}" == "$expected" ]]
[[ "${parsed[MYSQL_HOST]}" == '127.0.0.1' ]]
[[ "${parsed[ADMIN_BOOTSTRAP_EMAIL]}" == 'admin@example.test' ]]
test ! -e "$MARKER1"
test ! -e "$MARKER2"

printf 'native generated env parser safety: PASS\n'
