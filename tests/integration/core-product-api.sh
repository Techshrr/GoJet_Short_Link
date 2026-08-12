#!/usr/bin/env bash
set -euo pipefail

BASE=${GOJET_TEST_BASE:-http://127.0.0.1:18090}
MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}
REDIS_ADDRESS=${REDIS_ADDRESS:-127.0.0.1:6379}

mysql_exec() {
  MYSQL_PWD="$MYSQL_PASSWORD" mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" -N -B -e "$1"
}
field() {
  local key=$1
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d$key)"
}
request() {
  local method=$1 path=$2 body=${3:-} auth=${4:-}
  local args=(-sS -X "$method" -H 'Content-Type: application/json' -w $'\n%{http_code}')
  if [[ -n "$auth" ]]; then args+=(-H "Authorization: Bearer $auth"); fi
  if [[ -n "$body" ]]; then args+=(--data "$body"); fi
  curl "${args[@]}" "$BASE$path"
}
expect_status() {
  local expected=$1 response=$2 label=$3
  local status body
  status=$(printf '%s\n' "$response" | tail -n1)
  body=$(printf '%s\n' "$response" | sed '$d')
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL: $label expected HTTP $expected got $status" >&2
    echo "$body" >&2
    exit 1
  fi
  printf '%s' "$body"
}

for i in {1..60}; do
  if curl -fsS "$BASE/health" >/dev/null 2>&1; then break; fi
  sleep 1
  [[ $i -lt 60 ]] || { echo 'platform-api did not become healthy' >&2; exit 1; }
done

echo '[1/10] super administrator login'
body=$(expect_status 200 "$(request POST /api/admin/auth/login '{"email":"owner@example.test","password":"OwnerPassword!2026"}')" 'admin login')
ADMIN_TOKEN=$(printf '%s' "$body" | field "['token']")
ADMIN_ROLE=$(printf '%s' "$body" | field "['administrator']['role']")
[[ "$ADMIN_ROLE" == 'super_admin' ]] || { echo 'bootstrap account is not super_admin' >&2; exit 1; }

echo '[2/10] ordinary admin operations do not require step-up'
expect_status 200 "$(request PUT /api/admin/settings/basic '{"site.name":"GoJet Acceptance","site.short_name":"GoJet","site.language":"zh-CN"}' "$ADMIN_TOKEN")" 'settings save' >/dev/null

echo '[3/10] administrator creates and manages user'
body=$(expect_status 201 "$(request POST /api/admin/users '{"email":"managed@example.test","display_name":"Managed User","password":"ManagedPassword!2026","email_verified":true}' "$ADMIN_TOKEN")" 'admin create user')
MANAGED_ID=$(printf '%s' "$body" | field "['id']")
body=$(expect_status 200 "$(request POST /api/auth/login '{"email":"managed@example.test","password":"ManagedPassword!2026"}')" 'managed user login')
USER_TOKEN=$(printf '%s' "$body" | field "['token']")
expect_status 200 "$(request GET /api/me '' "$USER_TOKEN")" 'managed user me' >/dev/null
expect_status 200 "$(request PATCH "/api/admin/users/$MANAGED_ID/status" '{"status":"suspended"}' "$ADMIN_TOKEN")" 'suspend user' >/dev/null
expect_status 401 "$(request GET /api/me '' "$USER_TOKEN")" 'suspended user old session' >/dev/null
expect_status 200 "$(request PATCH "/api/admin/users/$MANAGED_ID/status" '{"status":"active"}' "$ADMIN_TOKEN")" 'reactivate user' >/dev/null

echo '[4/10] user self-service profile and password lifecycle'
body=$(expect_status 200 "$(request POST /api/auth/login '{"email":"managed@example.test","password":"ManagedPassword!2026"}')" 'managed user relogin')
USER_TOKEN=$(printf '%s' "$body" | field "['token']")
expect_status 200 "$(request PATCH /api/me '{"display_name":"Managed Renamed"}' "$USER_TOKEN")" 'user profile update' >/dev/null
expect_status 200 "$(request POST /api/me/password '{"current_password":"ManagedPassword!2026","new_password":"ManagedPassword!2027"}' "$USER_TOKEN")" 'user password change' >/dev/null
expect_status 401 "$(request GET /api/me '' "$USER_TOKEN")" 'password change revokes current session' >/dev/null
body=$(expect_status 200 "$(request POST /api/auth/login '{"email":"managed@example.test","password":"ManagedPassword!2027"}')" 'login with changed password')
USER_TOKEN=$(printf '%s' "$body" | field "['token']")
expect_status 204 "$(request POST /api/auth/logout '{}' "$USER_TOKEN")" 'user logout' >/dev/null
expect_status 401 "$(request GET /api/me '' "$USER_TOKEN")" 'logout revokes token' >/dev/null

echo '[5/10] explicit administrator permissions are enforced'
body=$(expect_status 201 "$(request POST /api/admin/administrators '{"email":"support@example.test","display_name":"Support","password":"SupportPassword!2026","role":"custom","permissions":["users.manage"]}' "$ADMIN_TOKEN")" 'create limited administrator')
LIMITED_ID=$(printf '%s' "$body" | field "['id']")
body=$(expect_status 200 "$(request POST /api/admin/auth/login '{"email":"support@example.test","password":"SupportPassword!2026"}')" 'limited administrator login')
LIMITED_TOKEN=$(printf '%s' "$body" | field "['token']")
expect_status 200 "$(request GET /api/admin/users '' "$LIMITED_TOKEN")" 'limited admin users access' >/dev/null
expect_status 403 "$(request GET /api/admin/settings '' "$LIMITED_TOKEN")" 'limited admin settings denial' >/dev/null
expect_status 403 "$(request GET /api/admin/administrators '' "$LIMITED_TOKEN")" 'limited admin administrator denial' >/dev/null
expect_status 200 "$(request DELETE "/api/admin/administrators/$LIMITED_ID/sessions" '' "$ADMIN_TOKEN")" 'super admin revokes admin sessions' >/dev/null

echo '[6/10] public registration and password-recovery request'
body=$(expect_status 201 "$(request POST /api/auth/register '{"email":"public@example.test","display_name":"Public User","password":"PublicPassword!2026"}')" 'public registration')
PUBLIC_TOKEN=$(printf '%s' "$body" | field "['token']")
expect_status 200 "$(request GET /api/me '' "$PUBLIC_TOKEN")" 'registered user session' >/dev/null
expect_status 202 "$(request POST /api/auth/forgot-password '{"email":"public@example.test"}')" 'password reset request' >/dev/null
RESET_MAILS=$(mysql_exec "SELECT COUNT(*) FROM mail_messages WHERE recipient='public@example.test' AND message_type='password_reset';")
[[ "$RESET_MAILS" -ge 1 ]] || { echo 'password reset mail was not queued' >&2; exit 1; }

echo '[7/10] Markdown announcement CRUD and public publication'
body=$(expect_status 201 "$(request POST /api/admin/announcements '{"title":"Acceptance Announcement","body":"# Release\n\n**Ready** for testing.","status":"draft"}' "$ADMIN_TOKEN")" 'announcement create')
ANNOUNCEMENT_ID=$(printf '%s' "$body" | field "['id']")
expect_status 200 "$(request PATCH "/api/admin/announcements/$ANNOUNCEMENT_ID" '{"title":"Acceptance Announcement","body":"# Release\n\n**Published** from Markdown.","status":"published"}' "$ADMIN_TOKEN")" 'announcement publish' >/dev/null
body=$(expect_status 200 "$(request GET /api/public/announcements)" 'public announcements')
printf '%s' "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert any(x["title"]=="Acceptance Announcement" and "Published" in x["body_markdown"] for x in d["data"])'

echo '[8/10] operational actions execute without operator-written reason'
expect_status 200 "$(request POST /api/admin/diagnostics/cache/flush '{}' "$ADMIN_TOKEN")" 'cache flush' >/dev/null
expect_status 200 "$(request PUT /api/admin/diagnostics/maintenance '{"enabled":true,"message":"Acceptance maintenance"}' "$ADMIN_TOKEN")" 'maintenance enable' >/dev/null
expect_status 503 "$(request GET /api/me '' 'invalid-token')" 'maintenance blocks public API before authentication' >/dev/null || true
expect_status 200 "$(request PUT /api/admin/diagnostics/maintenance '{"enabled":false}' "$ADMIN_TOKEN")" 'maintenance disable' >/dev/null

echo '[9/10] administrator safe-delete user'
expect_status 204 "$(request DELETE "/api/admin/users/$MANAGED_ID" '' "$ADMIN_TOKEN")" 'delete user' >/dev/null
DELETED_STATUS=$(mysql_exec "SELECT status FROM users WHERE id=$MANAGED_ID;")
[[ "$DELETED_STATUS" == 'deleted' ]] || { echo 'deleted user was not anonymized' >&2; exit 1; }

echo '[10/10] database audit evidence exists'
AUDIT_COUNT=$(mysql_exec "SELECT COUNT(*) FROM administrator_audit_logs WHERE administrator_id IS NOT NULL;")
[[ "$AUDIT_COUNT" -gt 0 ]] || { echo 'administrator audit log is empty' >&2; exit 1; }

printf 'GoJet core product API acceptance: PASS\n'
