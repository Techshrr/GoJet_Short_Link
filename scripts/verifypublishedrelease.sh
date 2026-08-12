#!/usr/bin/env sh
set -eu
[ "$#" -eq 1 ] || { echo "usage: $0 <tag>" >&2; exit 2; }
TAG=$1
REPO=${GOJET_GITHUB_REPOSITORY:-Techshrr/GoJet_Short_Link}
NAME="gojet-${TAG}-linux-production.zip"
BASE="https://github.com/$REPO/raw/refs/tags/$TAG/dist"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT INT TERM
for tool in curl sha256sum unzip; do command -v "$tool" >/dev/null 2>&1 || { echo "$tool is required" >&2; exit 1; }; done
curl --fail --location --retry 3 --silent --show-error "$BASE/$NAME" -o "$TMP/$NAME"
curl --fail --location --retry 3 --silent --show-error "$BASE/$NAME.sha256" -o "$TMP/$NAME.sha256"
(cd "$TMP" && sha256sum -c "$NAME.sha256")
unzip -tq "$TMP/$NAME" >/dev/null
printf 'published release is downloadable and valid: %s/%s\n' "$BASE" "$NAME"
