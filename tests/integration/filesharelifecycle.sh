#!/usr/bin/env bash
set -euo pipefail

BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
FILE_ROOT=${FILE_STORAGE_PATH:-/tmp/gojet/files}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}

for command in curl python3 mysql mktemp date cmp mkdir mv chown chmod; do command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }; done
mysqlq(){ MYSQL_PWD="$MYSQL_PASSWORD" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"; }
json(){ local expr=$1; python3 -c "import json,sys; d=json.load(sys.stdin); print(d$expr)"; }
api(){ local m=$1 p=$2 body=${3:-} token=${4:-}; local args=(-sS -X "$m" -H 'Content-Type: application/json' -w $'\n%{http_code}'); [[ -n "$token" ]]&&args+=(-H "Authorization: Bearer $token"); [[ -n "$body" ]]&&args+=(--data "$body"); curl "${args[@]}" "$BASE$p"; }
expect(){ local wanted=$1 raw=$2 label=$3; local code body; code=$(printf '%s\n' "$raw"|tail -n1); body=$(printf '%s\n' "$raw"|sed '$d'); [[ "$code" == "$wanted" ]]||{ echo "FAIL $label expected $wanted got $code" >&2; echo "$body" >&2; exit 1; }; printf '%s' "$body"; }

suffix=$(date +%s)
reg=$(expect 201 "$(api POST /api/auth/register "{\"email\":\"files-$suffix@example.test\",\"display_name\":\"文件分享验收\",\"password\":\"FileSharePassword!2026\"}")" register)
token=$(printf '%s' "$reg"|json "['token']")
spaces=$(expect 200 "$(api GET /api/workspaces '' "$token")" workspaces)
wid=$(printf '%s' "$spaces"|python3 -c 'import json,sys; print(json.load(sys.stdin)["data"][0]["id"])')

upload(){
  local file=$1 password=${2:-} max=${3:-} expires=${4:-}
  local args=(-sS -X POST -H "Authorization: Bearer $token" -F "file=@$file;type=text/plain" -w $'\n%{http_code}')
  [[ -z "$password" ]] || args+=(-F "password=$password")
  [[ -z "$max" ]] || args+=(-F "max_downloads=$max")
  [[ -z "$expires" ]] || args+=(-F "expires_at=$expires")
  curl "${args[@]}" "$BASE/api/workspaces/$wid/fileshares"
}

# This product-lifecycle test intentionally does not replace the separate real
# ClamAV/EICAR acceptance. It simulates the successful scanner transition using
# the same durable states and filesystem move used by FinishFileScan: pending ->
# scanning -> clean, quarantine/<storage_name> -> clean/<storage_name>.
activate(){
  local id=$1 storage source target changed
  storage=$(mysqlq "SELECT storage_name FROM file_shares WHERE id=$id AND deleted_at IS NULL;")
  [[ -n "$storage" && "$storage" != */* && "$storage" != .* ]] || { echo "invalid storage_name for file $id: $storage" >&2; exit 1; }
  source="$FILE_ROOT/quarantine/$storage"
  target="$FILE_ROOT/clean/$storage"
  [[ -f "$source" ]] || { echo "quarantined object missing for file $id: $source" >&2; exit 1; }

  changed=$(mysqlq "UPDATE file_shares SET scan_status='scanning',scan_attempts=scan_attempts+1,next_scan_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE) WHERE id=$id AND scan_status='pending'; SELECT ROW_COUNT();" | tail -n1)
  [[ "$changed" == 1 ]] || { echo "file $id could not enter scanning state" >&2; exit 1; }

  mkdir -p "$FILE_ROOT/clean"
  # In the Native Gate this script runs as root while platformapi/fileworker run
  # as the dedicated gojet user. FinishFileScan would create/move within a
  # gojet-owned object-store tree, so preserve the quarantine directory owner
  # and mode instead of accidentally creating root-owned clean/ and turning the
  # later production DeleteFile rename into EACCES.
  if [[ $(id -u) -eq 0 ]]; then
    chown --reference="$FILE_ROOT/quarantine" "$FILE_ROOT/clean"
    chmod --reference="$FILE_ROOT/quarantine" "$FILE_ROOT/clean"
  fi
  mv "$source" "$target"
  changed=$(mysqlq "UPDATE file_shares SET scan_status='clean',scan_result='clean',status='active',last_scanned_at=UTC_TIMESTAMP() WHERE id=$id AND scan_status='scanning'; SELECT ROW_COUNT();" | tail -n1)
  if [[ "$changed" != 1 ]]; then
    mv "$target" "$source" || true
    echo "file $id could not finish clean scan state" >&2
    exit 1
  fi
  [[ -f "$target" ]] || { echo "clean object missing for file $id: $target" >&2; exit 1; }
}

payload=$(mktemp)
printf 'GoJet protected file acceptance %s\n' "$suffix" >"$payload"
future=$(date -u -d '+10 minutes' '+%Y-%m-%dT%H:%M:%SZ')
body=$(expect 202 "$(upload "$payload" 'Secret123!' 2 "$future")" protected-upload)
id=$(printf '%s' "$body"|json "['id']")
slug=$(printf '%s' "$body"|json "['slug']")
protected=$(printf '%s' "$body"|json "['protected']")
[[ "$protected" == True ]] || { echo 'share was not marked protected' >&2; exit 1; }
activate "$id"

page_code=$(curl -sS -o /tmp/gojet-file-page.html -w '%{http_code}' -H 'X-GoJet-Public-File-Page: 1' "$BASE/api/public/files/$slug")
[[ "$page_code" == 200 ]] || { echo "file share page expected 200 got $page_code" >&2; exit 1; }
grep -q 'GoJet' /tmp/gojet-file-page.html
grep -q '下载文件' /tmp/gojet-file-page.html

raw_code=$(curl -sS -o /tmp/gojet-file-raw.json -w '%{http_code}' "$BASE/api/public/files/$slug")
[[ "$raw_code" == 403 ]] || { echo "protected legacy download expected 403 got $raw_code" >&2; exit 1; }
wrong_code=$(curl -sS -o /tmp/gojet-file-wrong.json -w '%{http_code}' -H 'X-GoJet-Public-File-Page: 1' -H 'X-GoJet-File-Password: wrong-password' "$BASE/api/public/files/$slug?download=1")
[[ "$wrong_code" == 403 ]] || { echo "wrong password expected 403 got $wrong_code" >&2; exit 1; }

for n in 1 2; do
  out=$(mktemp)
  code=$(curl -sS -o "$out" -w '%{http_code}' -H 'X-GoJet-Public-File-Page: 1' -H 'X-GoJet-File-Password: Secret123!' "$BASE/api/public/files/$slug?download=1")
  [[ "$code" == 200 ]] || { echo "download $n expected 200 got $code" >&2; exit 1; }
  cmp -s "$payload" "$out" || { echo "download $n content mismatch" >&2; exit 1; }
  rm -f "$out"
done
[[ "$(mysqlq "SELECT downloads FROM file_shares WHERE id=$id;")" == 2 ]] || { echo 'download counter did not reach 2' >&2; exit 1; }
limit_code=$(curl -sS -o /tmp/gojet-file-limit.json -w '%{http_code}' -H 'X-GoJet-Public-File-Page: 1' -H 'X-GoJet-File-Password: Secret123!' "$BASE/api/public/files/$slug?download=1")
[[ "$limit_code" == 404 ]] || { echo "download above max expected 404 got $limit_code" >&2; exit 1; }

expired=$(expect 202 "$(upload "$payload")" expiry-upload)
expired_id=$(printf '%s' "$expired"|json "['id']")
expired_slug=$(printf '%s' "$expired"|json "['slug']")
activate "$expired_id"
mysqlq "UPDATE file_shares SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE id=$expired_id;"
expiry_code=$(curl -sS -o /tmp/gojet-file-expired.json -w '%{http_code}' -H 'X-GoJet-Public-File-Page: 1' "$BASE/api/public/files/$expired_slug")
[[ "$expiry_code" == 404 ]] || { echo "expired share expected 404 got $expiry_code" >&2; exit 1; }

deleted=$(expect 202 "$(upload "$payload")" delete-upload)
deleted_id=$(printf '%s' "$deleted"|json "['id']")
deleted_slug=$(printf '%s' "$deleted"|json "['slug']")
activate "$deleted_id"
expect 204 "$(api DELETE "/api/workspaces/$wid/fileshares/$deleted_id?retention_days=0" '' "$token")" delete-share >/dev/null
deleted_code=$(curl -sS -o /tmp/gojet-file-deleted.json -w '%{http_code}' -H 'X-GoJet-Public-File-Page: 1' "$BASE/api/public/files/$deleted_slug")
[[ "$deleted_code" == 404 ]] || { echo "deleted share expected 404 got $deleted_code" >&2; exit 1; }

rm -f "$payload" /tmp/gojet-file-{page.html,raw.json,wrong.json,limit.json,expired.json,deleted.json}
printf 'GoJet protected file share lifecycle acceptance: PASS\n'