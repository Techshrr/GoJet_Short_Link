#!/usr/bin/env bash
set -euo pipefail

MYSQL_HOST=${MYSQL_HOST:-127.0.0.1}
MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_USER=${MYSQL_USER:-root}
MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
MYSQL_DATABASE=${MYSQL_DATABASE:-gojet_test}

MYSQL_PWD="$MYSQL_PASSWORD" mysql \
  -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" \
  -N -B "$MYSQL_DATABASE" <<'SQL' >/tmp/gojetschemanames.tsv
SELECT 'table', TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME;
SELECT 'column', CONCAT(TABLE_NAME, '.', COLUMN_NAME)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;
SELECT 'index', CONCAT(TABLE_NAME, '.', INDEX_NAME)
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME <> 'PRIMARY'
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;
SELECT 'constraint', CONCAT(TABLE_NAME, '.', CONSTRAINT_NAME)
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME <> 'PRIMARY'
ORDER BY TABLE_NAME, CONSTRAINT_NAME;
SQL

python3 - /tmp/gojetschemanames.tsv <<'PY'
from pathlib import Path
import re
import sys

identifier = re.compile(r'^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$')
rows = []
violations = []
counts = {'table': 0, 'column': 0, 'index': 0, 'constraint': 0}
for raw in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    if not raw.strip():
        continue
    kind, qualified = raw.split('\t', 1)
    counts[kind] = counts.get(kind, 0) + 1
    pieces = qualified.split('.', 1)
    table = pieces[0]
    name = pieces[-1]
    if not identifier.fullmatch(table):
        violations.append(f"{kind}: table '{table}' is not lower_snake_case")
    if kind != 'table' and not identifier.fullmatch(name):
        violations.append(f"{kind}: '{qualified}' is not lower_snake_case")
    rows.append((kind, qualified))

if not counts['table']:
    raise SystemExit('live schema contains no tables')
if violations:
    print('Live database schema naming violations:', file=sys.stderr)
    for item in violations:
        print(item, file=sys.stderr)
    raise SystemExit(1)

print('Database tables:')
for kind, qualified in rows:
    if kind == 'table':
        print(f'  {qualified}')
print(
    'Live database schema naming: PASS '
    f"({counts['table']} tables, {counts['column']} columns, "
    f"{counts['index']} indexes, {counts['constraint']} constraints; lower_snake_case)"
)
PY
