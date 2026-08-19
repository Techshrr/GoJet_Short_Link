#!/usr/bin/env bash
set -euo pipefail

# Installer request contract: password is optional; host/port are required;
# username is optional but must be paired with a password.
grep -Fq 'REDIS_HOST|REDIS_PORT|REDIS_USERNAME|REDIS_PASSWORD' scripts/nativeinstallerapply.sh
grep -Fq 'REDIS_HOST REDIS_PORT PUBLIC_BASE_URL' scripts/nativeinstallerapply.sh
if grep -Fq 'REDIS_HOST REDIS_PORT REDIS_PASSWORD PUBLIC_BASE_URL' scripts/nativeinstallerapply.sh; then
  echo 'REDIS_PASSWORD became required again' >&2
  exit 1
fi
grep -Fq 'Redis ACL 用户名已填写时必须同时填写密码' scripts/nativeinstallerapply.sh
grep -Fq '远程 Redis 不允许无认证连接' scripts/nativeinstallerapply.sh
grep -Fq 'REDISCLI_AUTH="$redis_password"' scripts/nativeinstallerapply.sh
if grep -Eq 'redis-cli.*-a|redis_args\+\=\(-a' scripts/nativeinstallerapply.sh; then
  echo 'Redis password leaked back onto command argv' >&2
  exit 1
fi

# Web Installer must expose the same policy before the root task is queued.
grep -Fq 'function redisLoopback' installer/index.php
grep -Fq 'function redisCheck(string $host, int $port, string $username, string $password)' installer/index.php
grep -Fq 'Redis ACL 用户名（可选）' installer/index.php
grep -Fq '远程 Redis 不允许无认证连接' installer/index.php
grep -Fq "'REDIS_HOST' =>" installer/index.php
grep -Fq "'REDIS_USERNAME' =>" installer/index.php

# Runtime contract: every Redis-consuming production process must understand
# ACL username as well as empty/password-only authentication.
grep -Fq 'REDIS_USERNAME' services/platformapi/cmd/server/main.go
grep -Fq 'REDIS_USERNAME' services/platformapi/cmd/operationsmonitor/main.go
grep -Fq 'REDIS_USERNAME' services/analyticsworker/cmd/worker/main.go
grep -Fq 'REDIS_USERNAME' services/analyticsreconciler/cmd/reconciler/main.go
grep -Fq 'REDIS_USERNAME' services/redirectengine/cmd/server/main.go
grep -Fq 'AUTH", s.username, s.password' services/redirectengine/internal/store/redis.go

grep -Fq 'REDIS_USERNAME=' deploy/native/gojet.env.example
grep -Fxq 'REDIS_PASSWORD=' deploy/native/gojet.env.example

# P21 is forbidden from changing installer/security semantics after checkout.
grep -Fq 'P21 source/package integrity failure' scripts/packagev5native.sh
for rel in 'installer/index.php' 'scripts/nativeinstallerapply.sh' 'scripts/nativeinstallerrun.sh' 'deploy/native/gojet.env.example' 'install.sh'; do
  grep -Fq "$rel" scripts/packagev5native.sh || { echo "P21 integrity path missing: $rel" >&2; exit 1; }
done
if grep -Fq 'normalize staged installer' scripts/packagev5native.sh; then
  echo 'packaging-time installer semantic mutation returned' >&2
  exit 1
fi

printf 'v5.0.1 Redis installer/runtime/package-integrity contract: PASS\n'
